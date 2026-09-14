#!/bin/bash
# Deploy all apps to EC2
# Usage:
#   ./scripts/deploy-all.sh          — deploy everything
#   ./scripts/deploy-all.sh api web  — deploy specific apps (api | web | ams-api | ams-web)
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

deploy_api()     { bash "$SCRIPTS_DIR/deploy-api.sh"; }
deploy_web()     { bash "$SCRIPTS_DIR/deploy-web.sh"; }
deploy_ams_api() { bash "$SCRIPTS_DIR/deploy-ams-api.sh"; }
deploy_ams_web() { bash "$SCRIPTS_DIR/deploy-ams-web.sh"; }

if [ $# -eq 0 ]; then
  # Deploy all
  deploy_api
  deploy_web
  deploy_ams_api
  deploy_ams_web
else
  for target in "$@"; do
    case "$target" in
      api)     deploy_api ;;
      web)     deploy_web ;;
      ams-api) deploy_ams_api ;;
      ams-web) deploy_ams_web ;;
      *)
        echo "Unknown target: $target"
        echo "Valid targets: api | web | ams-api | ams-web"
        exit 1
        ;;
    esac
  done
fi

echo ""
echo "🎉 Deploy complete"
