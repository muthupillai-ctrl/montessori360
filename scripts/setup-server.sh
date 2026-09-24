#!/bin/bash
# One-time wiring of Montessori360 into the home Linux server's existing setup.
# Installs nothing — the box already runs Docker, the shared `reverse-proxy`
# nginx container and the Cloudflare tunnel. This script:
#   1. creates /data/apps/montessori360/{api,ams-api,web,ams-web}
#   2. adds the two web roots as read-only mounts on the reverse-proxy container
#      (backs up compose.yaml first, then recreates the proxy — a few seconds of
#      downtime for every site on the box)
#   3. adds the public hostnames to the Cloudflare tunnel and creates DNS routes
#      (needs sudo on the server for /etc/cloudflared/config.yml)
# Each shared-infra step asks for confirmation. Safe to re-run.
# Flags:
#   --yes        don't prompt (answer yes to every step)
#   --no-tunnel  skip step 3 (e.g. when sudo can't prompt)
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

YES=false; TUNNEL=true
for arg in "$@"; do
  case "$arg" in
    --yes)       YES=true ;;
    --no-tunnel) TUNNEL=false ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

confirm() {
  if $YES; then echo "$1 → yes (--yes)"; return 0; fi
  read -r -p "$1 [y/N] " ans
  [[ "$ans" =~ ^[Yy]$ ]]
}

echo "🛠  Wiring Montessori360 into $SERVER"

# ── 1. Directories ────────────────────────────────────────────────────────────
echo "→ Creating $REMOTE_BASE..."
remote "mkdir -p $REMOTE_BASE/api $REMOTE_BASE/ams-api/uploads $REMOTE_BASE/web/www $REMOTE_BASE/ams-web/www"
push "$REPO_ROOT/infra/docker/compose.yaml" "$SERVER:$REMOTE_BASE/compose.yaml"

# ── 2. Reverse-proxy mounts ───────────────────────────────────────────────────
MOUNTS=(
  "$REMOTE_BASE/web/www:/usr/share/nginx/montessori360-web:ro"
  "$REMOTE_BASE/ams-web/www:/usr/share/nginx/montessori360-ams-web:ro"
)
RP_COMPOSE="$REVERSE_PROXY_DIR/compose.yaml"

MISSING=()
for m in "${MOUNTS[@]}"; do
  remote "grep -qF -- '$m' $RP_COMPOSE" || MISSING+=("$m")
done

if [ ${#MISSING[@]} -eq 0 ]; then
  echo "→ Reverse-proxy mounts already present"
elif confirm "Add ${#MISSING[@]} mount(s) to $RP_COMPOSE and recreate the reverse-proxy (brief downtime for all sites)?"; then
  remote bash -s -- "$RP_COMPOSE" "${MISSING[@]}" <<'REMOTE'
set -euo pipefail
f="$1"; shift
cp "$f" "$f.bak.$(date +%Y%m%d%H%M%S)"
tmp="$(mktemp)"
# Insert after the last existing ":/usr/share/nginx/" volume line
awk -v add="$(printf '      - %s\n' "$@")" '
  { lines[NR] = $0 }
  /:\/usr\/share\/nginx\// { last = NR }
  END {
    if (!last) { print "no nginx volume lines found" > "/dev/stderr"; exit 1 }
    for (i = 1; i <= NR; i++) { print lines[i]; if (i == last) printf "%s", add }
  }' "$f" > "$tmp"
cat "$tmp" > "$f"; rm -f "$tmp"
cd "$(dirname "$f")"
docker compose config -q
docker compose up -d
REMOTE
  echo "   reverse-proxy recreated"
else
  echo "   skipped — web deploys will refuse to run until the mounts exist"
fi

# ── 3. Cloudflare tunnel ──────────────────────────────────────────────────────
HOSTS=($SIS_WEB_HOSTS $AMS_WEB_HOSTS)
CF_CONFIG=/etc/cloudflared/config.yml

NEW_HOSTS=()
for h in "${HOSTS[@]}"; do
  remote "grep -q 'hostname: $h\$' $CF_CONFIG" || NEW_HOSTS+=("$h")
done

if ! $TUNNEL; then
  echo "→ Skipping tunnel (--no-tunnel); not yet routed: ${NEW_HOSTS[*]:-none}"
elif [ ${#NEW_HOSTS[@]} -eq 0 ]; then
  echo "→ Tunnel already routes: ${HOSTS[*]}"
elif confirm "Add ${NEW_HOSTS[*]} to the Cloudflare tunnel (sudo) and create DNS records?"; then
  CF_SCRIPT="$(mktemp)"
  trap 'rm -f "$CF_SCRIPT"' EXIT
  cat > "$CF_SCRIPT" <<'REMOTE'
set -euo pipefail
cfg=/etc/cloudflared/config.yml
tunnel="$(awk '/^tunnel:/ {print $2; exit}' "$cfg")"
sudo cp "$cfg" "$cfg.bak.$(date +%Y%m%d%H%M%S)"
tmp="$(mktemp)"
# Insert before the catch-all "- service: http_status:404" rule
awk -v add="$(printf '  - hostname: %s\n    service: http://localhost:80\n' "$@")" '
  /^[[:space:]]*- service: http_status:404/ && !done { printf "%s", add; done = 1 }
  { print }' "$cfg" > "$tmp"
sudo cp "$tmp" "$cfg"; rm -f "$tmp"
cloudflared tunnel ingress validate --config "$cfg" 2>/dev/null || sudo cloudflared tunnel ingress validate --config "$cfg"
sudo systemctl restart cloudflared
for h in "$@"; do
  cloudflared tunnel route dns "$tunnel" "$h" || echo "⚠️  DNS route for $h failed — add a CNAME to $tunnel.cfargotunnel.com in Cloudflare"
done
REMOTE
  push "$CF_SCRIPT" "$SERVER:/tmp/m360-cf.sh"
  remote_tty "bash /tmp/m360-cf.sh ${NEW_HOSTS[*]}; rc=\$?; rm -f /tmp/m360-cf.sh; exit \$rc"
else
  echo "   skipped"
fi

cat <<NEXT

✅ Server wiring done. Next:
  1. Create production env files locally (gitignored):
       apps/api/.env.production      — copy apps/api/.env, set APP_URL=https://${SIS_WEB_HOSTS%% *}
       apps/ams-api/.env.production  — copy apps/ams-api/.env
     PORT, NODE_ENV, REDIS_URL and SIS_API_URL are set by infra/docker/compose.yaml.
  2. ./scripts/deploy-all.sh --env
NEXT
