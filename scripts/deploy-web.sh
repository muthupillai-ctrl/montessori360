#!/bin/bash
# Deploy SIS Web (apps/web) to EC2 — build locally, rsync static files, reload Nginx
# Pass --nginx to write/enable the Nginx config (first-time setup only)
set -euo pipefail

EC2_HOST="ubuntu@3.25.186.29"
EC2_KEY="${EC2_KEY:-$HOME/.ssh/montessori3.pem}"
REMOTE_WEB_DIR="/var/www/montessori360/web"
LOCAL_DIST="apps/web/dist/web/browser"
DOMAIN="pvns.ahamsys.com"
API_PORT=3001
NGINX_CONF="/etc/nginx/sites-available/sis-web"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Deploying SIS Web → $EC2_HOST ($DOMAIN)"

# ── 1. Build ──────────────────────────────────────────────────────────────────
echo "→ Building Angular app..."
npm run build --workspace=apps/web

if [ ! -d "$LOCAL_DIST" ]; then
  echo "❌ Build output not found at $LOCAL_DIST"
  exit 1
fi

# ── 2. Sync static files ──────────────────────────────────────────────────────
echo "→ Syncing to EC2..."
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo mkdir -p $REMOTE_WEB_DIR && sudo chown ubuntu:ubuntu $REMOTE_WEB_DIR"
rsync -avz --delete -e "ssh -i $EC2_KEY" "$LOCAL_DIST/" "$EC2_HOST:$REMOTE_WEB_DIR/"

# ── 3. Nginx config (--nginx flag = first-time setup) ─────────────────────────
if [[ "${1:-}" == "--nginx" ]]; then
  echo "→ Writing Nginx config for $DOMAIN..."
  ssh -i "$EC2_KEY" "$EC2_HOST" bash <<REMOTE
    sudo tee $NGINX_CONF > /dev/null <<'NGINX'
server {
    listen 80;
    server_name $DOMAIN;

    root $REMOTE_WEB_DIR;
    index index.html;

    # Proxy SIS API
    location /api/ {
        proxy_pass         http://localhost:$API_PORT;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    # Angular HTML5 routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static asset caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

    sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/sis-web
    sudo nginx -t
    echo "✅ Nginx config written and enabled"
    echo ""
    echo "⚠️  DNS: point $DOMAIN → 3.25.186.29, then run:"
    echo "   sudo certbot --nginx -d $DOMAIN"
REMOTE
fi

# ── 4. Reload Nginx ───────────────────────────────────────────────────────────
echo "→ Reloading Nginx..."
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo nginx -t && sudo systemctl reload nginx"

echo "✅ SIS Web deployed → http://$DOMAIN"
