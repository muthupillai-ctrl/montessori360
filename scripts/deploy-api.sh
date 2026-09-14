#!/bin/bash
# Deploy SIS API (apps/api) to EC2 — build locally, rsync dist, PM2 restart
# Pass --deps to also sync package files and run npm ci (only needed when deps change)
set -euo pipefail

EC2_HOST="ubuntu@3.25.186.29"
EC2_KEY="${EC2_KEY:-$HOME/.ssh/montessori3.pem}"
REMOTE_DIR="${REMOTE_DIR:-/home/ubuntu/montessori360}"
PM2_NAME="montessori360-api"
LOCAL_DIST="apps/api/dist"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "🚀 Deploying SIS API → $EC2_HOST:$REMOTE_DIR"

echo "→ Building..."
npm run build --workspace=apps/api

echo "→ Syncing dist to EC2..."
ssh -i "$EC2_KEY" "$EC2_HOST" "mkdir -p $REMOTE_DIR/apps/api/dist"
rsync -avz --delete \
  -e "ssh -i $EC2_KEY" \
  "$LOCAL_DIST/" \
  "$EC2_HOST:$REMOTE_DIR/apps/api/dist/"

# Optional: sync package files and install deps (pass --deps flag)
if [[ "${1:-}" == "--deps" ]]; then
  echo "→ Syncing workspace package files..."
  rsync -avz \
    -e "ssh -i $EC2_KEY" \
    package.json package-lock.json \
    "$EC2_HOST:$REMOTE_DIR/"
  rsync -avz \
    -e "ssh -i $EC2_KEY" \
    apps/api/package.json \
    "$EC2_HOST:$REMOTE_DIR/apps/api/"
  rsync -avz --delete \
    -e "ssh -i $EC2_KEY" \
    packages/ \
    "$EC2_HOST:$REMOTE_DIR/packages/"

  echo "→ Installing production dependencies on EC2..."
  ssh -i "$EC2_KEY" "$EC2_HOST" \
    "cd $REMOTE_DIR && npm ci --workspace=apps/api --omit=dev 2>&1 | tail -5"
fi

echo "→ Restarting PM2..."
ssh -i "$EC2_KEY" "$EC2_HOST" bash <<REMOTE
  if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
    pm2 restart "$PM2_NAME"
  else
    pm2 start "node dist/apps/api/src/index.js" \
      --name "$PM2_NAME" \
      --cwd "$REMOTE_DIR/apps/api" \
      --env production
    pm2 save
  fi
REMOTE

echo "✅ SIS API deployed"
