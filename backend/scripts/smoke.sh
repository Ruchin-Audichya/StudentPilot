#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${1:-}" # pass full origin like https://wheresmystipend-env-1.eba-xxxxx.ap-south-1.elasticbeanstalk.com
if [ -z "$ORIGIN" ]; then
  echo "Usage: ./scripts/smoke.sh <backend-origin>" >&2
  exit 1
fi

echo "[SMOKE] Health" && curl -fsS "$ORIGIN/health" | head -c 400; echo
echo "[SMOKE] Search" && curl -s -X POST "$ORIGIN/api/search" -H 'Content-Type: application/json' \
  -d '{"query":"software","location":"","mode":"","min_stipend":0,"skills":[],"domains":[]}' | head -c 600; echo
echo "[SMOKE] Done"
