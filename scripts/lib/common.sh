#!/bin/bash
# Shared config + helpers for the deploy-*.sh scripts. Source, don't run.
#
# Server layout (matches the other apps on the box):
#   /data/apps/montessori360/compose.yaml     ← infra/docker/compose.yaml
#   /data/apps/montessori360/api/             ← Docker build context + .env.production
#   /data/apps/montessori360/ams-api/         ← Docker build context + .env.production + uploads/
#   /data/apps/montessori360/web/www          ← SIS Angular build
#   /data/apps/montessori360/ams-web/www      ← AMS Angular build
#   /data/reverse-proxy/nginx/conf.d/montessori360-*.conf

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="${DEPLOY_CONFIG:-$REPO_ROOT/scripts/deploy.env}"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

SERVER="${SERVER:-pwms-server}"
REMOTE_BASE="${REMOTE_BASE:-/data/apps/montessori360}"
REVERSE_PROXY_DIR="${REVERSE_PROXY_DIR:-/data/reverse-proxy}"
REVERSE_PROXY_CONTAINER="${REVERSE_PROXY_CONTAINER:-reverse-proxy}"
SIS_WEB_HOSTS="${SIS_WEB_HOSTS:-tajione.ahamsys.com}"
AMS_WEB_HOSTS="${AMS_WEB_HOSTS:-tajiams.ahamsys.com}"

# Reuse one SSH connection across all ssh/rsync calls.
SSH_OPTS=(-o ControlMaster=auto
  -o "ControlPath=$HOME/.ssh/cm-m360-%r@%h:%p"
  -o ControlPersist=10m)

cd "$REPO_ROOT"

remote()     { ssh "${SSH_OPTS[@]}" "$SERVER" "$@"; }
remote_tty() { ssh -t "${SSH_OPTS[@]}" "$SERVER" "$@"; }
push()       { rsync -az -e "ssh ${SSH_OPTS[*]}" "$@"; }

# ── Backend (Docker) ──────────────────────────────────────────────────────────

# Build an API locally and push its Docker build context to the server.
# Usage: stage_api <workspace-dir> <service-name>
stage_api() {
  local app_dir="$1" svc="$2"
  local ctx
  ctx="$(mktemp -d)"
  trap 'rm -rf "$ctx"' RETURN

  echo "→ Building $app_dir..."
  npm run build --workspace="$app_dir"

  echo "→ Staging Docker build context..."
  cp -R "$app_dir/dist" "$ctx/dist"
  cp infra/docker/api.Dockerfile "$ctx/Dockerfile"
  printf 'node_modules\n.env*\nuploads\n' > "$ctx/.dockerignore"
  # Runtime package.json: no devDeps, no @montessori360/* workspace deps (their
  # imports are type-only), versions pinned to what's installed locally.
  node - "$app_dir" "$ctx/package.json" <<'NODE'
const fs = require('fs'), path = require('path');
const [appDir, out] = process.argv.slice(2);
const pkg = JSON.parse(fs.readFileSync(path.join(appDir, 'package.json'), 'utf8'));
const deps = {};
for (const [name, range] of Object.entries(pkg.dependencies || {})) {
  if (name.startsWith('@montessori360/')) continue;
  const candidates = [path.join(appDir, 'node_modules', name, 'package.json'),
                      path.join('node_modules', name, 'package.json')];
  const found = candidates.find(f => fs.existsSync(f));
  deps[name] = found ? JSON.parse(fs.readFileSync(found, 'utf8')).version : range;
}
// Dockerfile runs `node .`, so "main" must be the entry — fall back to `start`
const main = pkg.main || (pkg.scripts?.start || '').replace(/^node\s+/, '');
if (!main) { console.error(`No "main" or "start" script in ${appDir}/package.json`); process.exit(1); }
fs.writeFileSync(out, JSON.stringify({
  name: pkg.name, version: pkg.version, private: true,
  type: pkg.type, main, dependencies: deps,
}, null, 2) + '\n');
NODE

  echo "→ Syncing to $SERVER:$REMOTE_BASE/$svc/..."
  remote "mkdir -p $REMOTE_BASE/$svc"
  # P = protect server-only files from --delete
  push --delete --filter='P .env.production' --filter='P uploads/' \
    "$ctx/" "$SERVER:$REMOTE_BASE/$svc/"
  push infra/docker/compose.yaml "$SERVER:$REMOTE_BASE/compose.yaml"
}

# Upload <workspace-dir>/.env.production to the server (only with --env).
push_env() {
  local app_dir="$1" svc="$2" src="$1/.env.production"
  if [ ! -f "$src" ]; then
    echo "❌ $src not found — create it with production values and retry"
    exit 1
  fi
  echo "→ Uploading $src"
  chmod 600 "$src"
  push "$src" "$SERVER:$REMOTE_BASE/$svc/.env.production"
}

require_env() {
  local svc="$1" app_dir="$2"
  if ! remote "test -f $REMOTE_BASE/$svc/.env.production"; then
    echo "❌ $REMOTE_BASE/$svc/.env.production is missing on the server."
    echo "   Create $app_dir/.env.production locally and re-run with --env."
    exit 1
  fi
}

# Rebuild + restart one compose service, then wait for its /health endpoint.
# Usage: compose_up <service> <container> <port>
compose_up() {
  local svc="$1" container="$2" port="$3"
  echo "→ docker compose up -d --build $svc..."
  remote "cd $REMOTE_BASE && docker compose up -d --build $svc"

  echo "→ Waiting for $container health..."
  for _ in $(seq 1 20); do
    if remote "docker exec $container node -e \"fetch('http://localhost:$port/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" 2>/dev/null; then
      echo "   healthy"
      return 0
    fi
    sleep 3
  done
  echo "❌ $container did not become healthy — recent logs:"
  remote "docker logs --tail 40 $container"
  exit 1
}

# ── Frontend (shared reverse-proxy) ───────────────────────────────────────────

# Fail if the reverse-proxy container doesn't mount <dir> yet.
require_proxy_mount() {
  local dir="$1"
  if ! remote "docker inspect $REVERSE_PROXY_CONTAINER --format '{{range .Mounts}}{{.Source}} {{end}}' | tr ' ' '\n' | grep -qx '$dir'"; then
    echo "❌ $REVERSE_PROXY_CONTAINER does not mount $dir — run ./scripts/setup-server.sh first"
    exit 1
  fi
}

# Render an nginx server block for an Angular SPA + API proxy to stdout.
# Upstreams use variables + Docker DNS so nginx still starts (and the other
# sites stay up) if a montessori360 container is down.
# Usage: render_nginx "<hosts>" <root-in-proxy> <container> <port> [extra-proxy-path...]
render_nginx() {
  local hosts="$1" root="$2" container="$3" port="$4"; shift 4
  cat <<NGINX
# Generated by scripts/deploy-*.sh (montessori360) — re-run with --nginx to update
server {
    listen 80;
    server_name $hosts;

    root $root;
    index index.html;
    client_max_body_size 20m;

    resolver 127.0.0.11 valid=30s;
NGINX
  for p in /api/ /health "$@"; do
    cat <<NGINX

    location $p {
        set \$upstream http://$container:$port;
        proxy_pass \$upstream;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }
NGINX
  done
  cat <<'NGINX'

    location = /index.html {
        add_header Cache-Control "no-store";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX
}

# Install a conf.d file into the shared proxy, test, reload; roll back on failure.
# Usage: install_proxy_conf <name> <local-file>
install_proxy_conf() {
  local name="$1" file="$2"
  local dest="$REVERSE_PROXY_DIR/nginx/conf.d/$name.conf"
  echo "→ Installing proxy config $dest..."
  remote "test -f $dest && cp $dest /tmp/$name.conf.prev || rm -f /tmp/$name.conf.prev"
  push "$file" "$SERVER:$dest"
  if ! remote "docker exec $REVERSE_PROXY_CONTAINER nginx -t"; then
    echo "❌ nginx config test failed — restoring previous config"
    remote "if [ -f /tmp/$name.conf.prev ]; then mv /tmp/$name.conf.prev $dest; else rm -f $dest; fi"
    exit 1
  fi
  remote "docker exec $REVERSE_PROXY_CONTAINER nginx -s reload"
}

proxy_conf_exists() {
  remote "test -f $REVERSE_PROXY_DIR/nginx/conf.d/$1.conf"
}
