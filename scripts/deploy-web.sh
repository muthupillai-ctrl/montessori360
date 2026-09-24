#!/bin/bash
# Deploy SIS Web (apps/web) to the home Linux server — build locally, rsync static files
# into $REMOTE_BASE/web/www, which the shared reverse-proxy container serves.
# Flags:
#   --nginx  (re)write the reverse-proxy site config (done automatically the first time)
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

LOCAL_DIST="apps/web/dist/web/browser"
REMOTE_WWW="$REMOTE_BASE/web/www"
PROXY_ROOT="/usr/share/nginx/montessori360-web"
SITE="montessori360-web"

NGINX=false
for arg in "$@"; do
  case "$arg" in
    --nginx) NGINX=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

echo "🚀 Deploying SIS Web → $SERVER:$REMOTE_WWW ($SIS_WEB_HOSTS)"
require_proxy_mount "$REMOTE_WWW"

echo "→ Building Angular app..."
npm run build --workspace=apps/web

if [ ! -d "$LOCAL_DIST" ]; then
  echo "❌ Build output not found at $LOCAL_DIST"
  exit 1
fi

echo "→ Syncing static files..."
push --delete "$LOCAL_DIST/" "$SERVER:$REMOTE_WWW/"

if $NGINX || ! proxy_conf_exists "$SITE"; then
  CONF="$(mktemp)"
  trap 'rm -f "$CONF"' EXIT
  render_nginx "$SIS_WEB_HOSTS" "$PROXY_ROOT" montessori360-api 3001  > "$CONF"
  install_proxy_conf "$SITE" "$CONF"
fi

echo "✅ SIS Web deployed → $(for h in $SIS_WEB_HOSTS; do printf 'https://%s ' "$h"; done)"
