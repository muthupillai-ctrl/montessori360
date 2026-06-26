#!/bin/bash
set -e

EC2_HOST="ubuntu@3.25.186.29"
EC2_KEY="$HOME/.ssh/montessori3.pem"
REMOTE_DIR="/home/ubuntu/montessori360"
PM2_APP="montessori360-api"

echo "==> Syncing source to EC2..."
rsync -avz --delete \
  -e "ssh -i $EC2_KEY" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='apps/web' \
  --exclude='.env' \
  ./ "$EC2_HOST:$REMOTE_DIR/"

echo "==> Installing dependencies and building on EC2..."
ssh -i "$EC2_KEY" "$EC2_HOST" << 'ENDSSH'
set -e
cd /home/ubuntu/montessori360

# Install root + workspace deps
npm ci --omit=dev --workspaces --include-workspace-root 2>/dev/null || npm install --workspaces --include-workspace-root

# Build shared package first, then API
npm run build -w packages/shared 2>/dev/null || true
npm run build -w apps/api

echo "==> Restarting API with PM2..."
if pm2 describe montessori360-api > /dev/null 2>&1; then
  pm2 reload montessori360-api
else
  pm2 start apps/api/dist/apps/api/src/index.js \
    --name montessori360-api \
    --cwd apps/api \
    --env production
  pm2 save
fi

pm2 status montessori360-api
ENDSSH

echo "==> API deployment complete."
