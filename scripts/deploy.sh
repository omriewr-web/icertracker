#!/usr/bin/env bash
set -euo pipefail

# Source .env.local if it exists and vars aren't already set
if [[ -z "${VERCEL_TOKEN:-}" && -z "${VERCEL_OIDC_TOKEN:-}" ]]; then
  if [[ -f .env.local ]]; then
    set -a
    source .env.local
    set +a
  fi
fi

# Pick the first available token
if [[ -n "${VERCEL_TOKEN:-}" ]]; then
  TOKEN="$VERCEL_TOKEN"
elif [[ -n "${VERCEL_OIDC_TOKEN:-}" ]]; then
  TOKEN="$VERCEL_OIDC_TOKEN"
else
  echo "Deploy failed: set VERCEL_TOKEN or VERCEL_OIDC_TOKEN in .env.local"
  exit 1
fi

npx vercel --prod --force --token "$TOKEN"

echo ""
echo "✅ ODK page will reflect latest TRACKER.md on next page load"
