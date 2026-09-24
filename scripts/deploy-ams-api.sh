#!/bin/bash
# Deploy AMS API (apps/ams-api) to the home Linux server as Docker container 'montessori360-ams-api'.
# Builds locally, syncs dist + runtime package.json, then rebuilds the image
# on the server with docker compose (same pattern as the other apps there).
# Flags:
#   --env   upload apps/ams-api/.env.production to the server (required on first deploy)
set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

ENV=false
for arg in "$@"; do
  case "$arg" in
    --env) ENV=true ;;
    *) echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

echo "🚀 Deploying AMS API → $SERVER:$REMOTE_BASE/ams-api"

stage_api apps/ams-api ams-api
if $ENV; then push_env apps/ams-api ams-api; fi
require_env ams-api apps/ams-api
compose_up ams-api montessori360-ams-api 3002

echo "✅ AMS API deployed (logs: ssh $SERVER docker logs -f montessori360-ams-api)"
