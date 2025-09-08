#!/usr/bin/env bash
set -euo pipefail

ORIGIN="${1:-}" # pass full origin like https://wheresmystipend-env-1.eba-xxxxx.ap-south-1.elasticbeanstalk.com
if [ -z "$ORIGIN" ]; then
  echo "Usage: ./scripts/smoke.sh <backend-origin>" >&2
  exit 1
fi

set -o pipefail
echo "[SMOKE] Health" && HEALTH=$(curl -fsS -m 5 "$ORIGIN/health" | tee /dev/stderr)
if [[ "$HEALTH" != *'"ok"'* ]]; then
  echo "[SMOKE][FAIL] Health not ok" >&2; exit 1; fi
echo "[SMOKE] Search" && RESP=$(curl -s -m 25 -X POST "$ORIGIN/api/search" -H 'Content-Type: application/json' \
  -d '{"query":"software","filters":{"location":"India"}}') || true
echo "$RESP" | head -c 600; echo
if [[ -z "$RESP" ]]; then echo "[SMOKE][WARN] Empty search response" >&2; fi
echo "[SMOKE] Done"
