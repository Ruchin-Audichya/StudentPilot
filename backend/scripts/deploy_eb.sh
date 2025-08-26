#!/usr/bin/env bash
set -euo pipefail

# Move to backend directory (script is in backend/scripts/)
cd "$(dirname "${BASH_SOURCE[0]}")"
cd ..

ENVFILE="${1:-./env.eb}"
echo "🔹 Using env file: $ENVFILE"

# Detect EB CLI
if command -v eb >/dev/null 2>&1; then
  EB="eb"
elif command -v python >/dev/null 2>&1; then
  EB="python -m awsebcli"
elif command -v py >/dev/null 2>&1; then
  EB="py -m awsebcli"
else
  echo "Install EB CLI: pip install --upgrade awsebcli" >&2
  exit 1
fi

# Source optional env file
if [ -f "$ENVFILE" ]; then
  echo "🔹 Loading environment variables from $ENVFILE"
  set -a
  # Support lines with optional leading 'export '
  # shellcheck disable=SC2013
  while IFS= read -r line; do
    # strip comments and blank
    case "$line" in ''|\#*) continue ;; esac
    line_no_export="${line#export }"
    # ensure has equals
    if [[ "$line_no_export" == *"="* ]]; then
      key="${line_no_export%%=*}"; val="${line_no_export#*=}"
      # remove surrounding quotes if present
      val="${val%\r}"; key="${key%\r}"; key="${key// }"
      eval "${key}=${val}"
    fi
  done < "$ENVFILE"
  set +a
else
  echo "⚠️  Env file $ENVFILE not found (continuing with existing shell vars)"
fi

# Defaults if unset
: "${PORT:=8000}"
: "${WORKERS:=2}"
: "${TIMEOUT:=120}"

# Initialize EB app if config missing
if [ ! -f ".elasticbeanstalk/config.yml" ]; then
  echo "🔹 Initializing Elastic Beanstalk application (region ap-south-1)..."
  $EB init --region ap-south-1
fi

# Create environment if not present
if ! $EB list 2>/dev/null | grep -q '^wheresmystipend-env-1$'; then
  echo "🔹 Creating EB environment 'wheresmystipend-env-1' (single)..."
  $EB create wheresmystipend-env-1 --single
fi

# Collect environment variables that are currently defined
ENV_VARS=(
  PORT WORKERS TIMEOUT
  OPENROUTER_API_KEY OPENROUTER_MODELS OPENROUTER_BASE
  OPENROUTER_SITE_URL OPENROUTER_SITE_NAME
  GOOGLE_API_KEY
  FIREBASE_PROJECT_ID FIREBASE_CLIENT_EMAIL FIREBASE_PRIVATE_KEY
)

SETENV_ARGS=()
for var in "${ENV_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    value="${!var//$'\n'/\\n}"
    SETENV_ARGS+=("$var=$value")
  fi
done

if [ "${#SETENV_ARGS[@]}" -gt 0 ]; then
  echo "🔹 Syncing environment variables (${#SETENV_ARGS[@]})"
  $EB setenv "${SETENV_ARGS[@]}"
else
  echo "ℹ️  No environment variables to set."
fi

echo "🚀 Deploying application..."
$EB deploy

echo "🔍 Fetching status..."
STATUS_OUTPUT="$($EB status)"
echo "$STATUS_OUTPUT"

CNAME="$(echo "$STATUS_OUTPUT" | awk -F': ' '/CNAME/ {print $2; exit}')"
if [ -n "$CNAME" ]; then
  echo "✅ Deployment complete. CNAME: $CNAME"
  echo "Health: http://$CNAME/health"
else
  echo "⚠️  CNAME not found in status output."
fi
