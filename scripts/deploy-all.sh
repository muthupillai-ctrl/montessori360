#!/bin/bash
# Deploy all apps to the home Linux server
# Usage:
#   ./scripts/deploy-all.sh                  — deploy everything
#   ./scripts/deploy-all.sh api web          — deploy specific apps (api | web | ams-api | ams-web)
#   ./scripts/deploy-all.sh --env --nginx    — flags go to the scripts that accept them
#                                              (api/ams-api: --env, web/ams-web: --nginx)
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

TARGETS=(); API_FLAGS=(); WEB_FLAGS=()
for arg in "$@"; do
  case "$arg" in
    --env)   API_FLAGS+=("$arg") ;;
    --nginx) WEB_FLAGS+=("$arg") ;;
    api|web|ams-api|ams-web) TARGETS+=("$arg") ;;
    *)
      echo "Unknown argument: $arg"
      echo "Valid targets: api | web | ams-api | ams-web; flags: --env --nginx"
      exit 1
      ;;
  esac
done
# SIS API first — AMS API calls it
[ ${#TARGETS[@]} -eq 0 ] && TARGETS=(api ams-api web ams-web)

for target in "${TARGETS[@]}"; do
  case "$target" in
    api|ams-api) bash "$SCRIPTS_DIR/deploy-$target.sh" ${API_FLAGS[@]+"${API_FLAGS[@]}"} ;;
    web|ams-web) bash "$SCRIPTS_DIR/deploy-$target.sh" ${WEB_FLAGS[@]+"${WEB_FLAGS[@]}"} ;;
  esac
done

echo ""
echo "🎉 Deploy complete"
