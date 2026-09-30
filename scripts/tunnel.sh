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
CF_PID=""
trap '[ -n "$CF_PID" ] && kill "$CF_PID" 2>/dev/null || true; rm -f "$LOG"' EXIT

# Only the tunnel's own URL counts. cloudflared's errors mention api.trycloudflare.com, and
# advertising that sends Expo Go to Cloudflare's API ("405 Method Not Allowed").
tunnel_host() {
  grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$LOG" | grep -v '^https://api\.' | head -1 | sed 's#^https://##' || true
}

# WSL's DNS sometimes times out on the first lookup, so give cloudflared a few tries.
HOST=""
for attempt in 1 2 3; do
  : >"$LOG"
  # http2 (TCP), not the default QUIC: WSL's UDP drops QUIC connections, and each drop is a 530 on the phone.
  cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$PORT" >"$LOG" 2>&1 &
  CF_PID=$!
  for _ in $(seq 1 30); do
    HOST="$(tunnel_host)"
    [ -n "$HOST" ] && break 2
    kill -0 "$CF_PID" 2>/dev/null || break
    sleep 1
  done
  kill "$CF_PID" 2>/dev/null || true
  CF_PID=""
  echo "Cloudflare tunnel attempt $attempt failed:"
  tail -3 "$LOG"
  sleep 2
done
if [ -z "$HOST" ]; then
  echo "Couldn't start a Cloudflare tunnel. Not starting Metro with a bad address."
  exit 1
fi

# The URL is printed before the tunnel can carry traffic; wait until Cloudflare has a live connection.
for _ in $(seq 1 30); do
  grep -q 'Registered tunnel connection' "$LOG" && break
  sleep 1
done

echo "Tunnel ready: exp://$HOST (scan the QR code below with the iPhone camera)"
# Expo Go speaks plain HTTP for exp:// links; the quick tunnel serves both.
EXPO_PACKAGER_PROXY_URL="http://$HOST" npx expo start --port "$PORT" --clear "$@"
