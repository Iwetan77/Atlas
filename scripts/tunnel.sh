#!/usr/bin/env bash
# Expo Go on a phone can't reach Metro inside WSL (NAT), and Expo's built-in --tunnel ships an
# ngrok agent that ngrok now drops ("remote gone away"). This starts a free Cloudflare quick tunnel
# instead and tells Expo to advertise it, so the QR code points at the tunnel.
set -euo pipefail

PORT="${PORT:-8081}"
if ! command -v cloudflared >/dev/null; then
  echo "cloudflared not found. Install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

LOG="$(mktemp)"
cloudflared tunnel --no-autoupdate --url "http://localhost:$PORT" >"$LOG" 2>&1 &
CF_PID=$!
trap 'kill "$CF_PID" 2>/dev/null || true; rm -f "$LOG"' EXIT

HOST=""
for _ in $(seq 1 30); do
  HOST="$(grep -o '[a-z0-9-]*\.trycloudflare\.com' "$LOG" | head -1 || true)"
  [ -n "$HOST" ] && break
  sleep 1
done
if [ -z "$HOST" ]; then
  echo "Cloudflare tunnel didn't start:"
  cat "$LOG"
  exit 1
fi

echo "Tunnel ready: exp://$HOST (scan the QR code below with the iPhone camera)"
# Expo Go speaks plain HTTP for exp:// links; the quick tunnel serves both.
EXPO_PACKAGER_PROXY_URL="http://$HOST" npx expo start --port "$PORT" --clear "$@"
