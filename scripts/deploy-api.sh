#!/bin/bash
# Deploy SIS API (apps/api) to the home Linux server as Docker container 'montessori360-api'.
# Builds locally, syncs dist + runtime package.json, then rebuilds the image
# on the server with docker compose (same pattern as the other apps there).
# Flags:
#   --env   upload apps/api/.env.production to the server (required on first deploy)
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

ENV=false
for arg in "$@"; do
  case "$arg" in
    --env) ENV=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

echo "🚀 Deploying SIS API → $SERVER:$REMOTE_BASE/api"

stage_api apps/api api
if $ENV; then push_env apps/api api; fi
require_env api apps/api
compose_up api montessori360-api 3001

echo "✅ SIS API deployed (logs: ssh $SERVER docker logs -f montessori360-api)"
