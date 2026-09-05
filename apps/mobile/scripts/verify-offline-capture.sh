#!/usr/bin/env bash
#
# Verify the Phase 2 exit criterion: "airplane-mode capture uploads on
# reconnect."
#
# The app cannot stop its own backend, so the scenario is orchestrated here:
#
#   1. count the closet
#   2. stop the API
#   3. capture a photo   → must appear as a pending tile, and stay
#   4. start the API
#   5. relaunch the app  → the queue must drain with no user action
#   6. count again       → exactly one more garment
#
# Step 6 is the part that matters. The UI assertions can pass while nothing
# reaches the server; only the count proves the photo actually arrived.
#
# Usage: ./scripts/verify-offline-capture.sh
set -euo pipefail

export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

cd "$(dirname "$0")/.."
REPO="$(cd ../.. && pwd)"

UDID="${MIRA_SIM_UDID:-$(xcrun simctl list devices booted -j \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const l of Object.values(j.devices))for(const d of l)if(d.state==='Booted'){console.log(d.udid);process.exit(0)}process.exit(1)})")}"
[ -n "$UDID" ] || { echo "No booted simulator." >&2; exit 1; }

PSQL=(docker exec -i mira-postgres psql -U mira -d mira -t -A -c)

garment_count() {
  "${PSQL[@]}" "select count(*) from garments where deleted_at is null;"
}

start_api() {
  # DEV_AUTH_SECRET is deliberately NOT set here.
  #
  # `createDevVerifier` already defaults it to `mira-local-dev-secret`, which is
  # what every dev token is minted with. Hardcoding a different value started an
  # API that rejected the app's own token with 401 — whereupon the app correctly
  # showed the signed-out welcome screen, which has no tab bar, and the test
  # reported "Closet tab never appeared. Is Metro running?".
  #
  # An exported DEV_AUTH_SECRET still propagates into the subshell on its own.
  # MIRA_ENV=local is what selects the dev verifier; the secret does not.
  (cd "$REPO/apps/api" && \
    JWT_AUDIENCE=mira MIRA_ENV=local \
    nohup node dist/index.js > /tmp/mira-api.log 2>&1 &)
  for _ in $(seq 1 20); do
    if curl -fsS -o /dev/null http://localhost:4000/v1/health; then return 0; fi
    sleep 0.5
  done
  echo "API did not come up" >&2
  return 1
}

# `lsof` lives in /usr/sbin. On a PATH that omits it, the cwd lookup below
# returns nothing, every candidate process is silently skipped, and the only
# symptom is the confusing "API is still reachable" abort further down —
# pointing at the API when the actual fault is this script's own toolchain.
command -v lsof >/dev/null || {
  echo "lsof not found on PATH (it lives in /usr/sbin) — cannot identify the API process" >&2
  exit 1
}

stop_api() {
  # Matches BOTH `node dist/index.js` and the `node --watch dist/index.js` that
  # `npm run api` actually starts — the command this script's own header tells
  # you to run.
  #
  # Matching only the former killed the WATCHER'S CHILD, which the watcher then
  # immediately respawned. The API stayed up, and the guard below stopped the
  # run with "API is still reachable" — so the one scenario this script exists
  # to verify could not be run by following its own instructions.
  #
  # Killed in two passes because order matters: a surviving supervisor restarts
  # a dead child faster than the check below can notice it is gone.
  for _ in 1 2 3; do
    for pid in $(pgrep -f "dist/index.js" || true); do
      cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | grep ^n | cut -c2- || true)
      case "$cwd" in *apps/api) kill "$pid" 2>/dev/null || true;; esac
    done
    sleep 1
    curl -fsS -o /dev/null --max-time 2 http://localhost:4000/v1/health || return 0
  done
  sleep 1
}

run_test() {
  xcodebuild test \
    -workspace Mira.xcworkspace -scheme Mira -configuration Debug \
    -destination "platform=iOS Simulator,id=$UDID" \
    -derivedDataPath build \
    -only-testing:"MiraUITests/CaptureOfflineTests/$1" \
    > "/tmp/mira-offline-$1.log" 2>&1
}

# A clean device, so the count at the end means what it says. A capture left
# queued by an earlier run would upload too and turn "+1" into "+2".
APP="build/Build/Products/Debug-iphonesimulator/Mira.app"
echo "→ resetting app state on the simulator"
xcrun simctl uninstall "$UDID" app.mira.ios >/dev/null 2>&1 || true
(cd ios && xcrun simctl install "$UDID" "$APP")

BEFORE=$(garment_count)
echo "closet before: $BEFORE"

echo "→ stopping the API"
stop_api
if curl -fsS -o /dev/null --max-time 2 http://localhost:4000/v1/health; then
  echo "API is still reachable; the test would not be testing anything" >&2
  exit 1
fi

echo "→ capturing while offline"
cd ios
if ! run_test testCaptureSurvivesAnUnreachableServer; then
  echo "FAILED: offline capture" >&2
  tail -30 /tmp/mira-offline-testCaptureSurvivesAnUnreachableServer.log >&2
  cd .. && start_api
  exit 1
fi
cd ..

echo "→ restoring the API"
start_api

echo "→ relaunching; the queue must drain on its own"
cd ios
if ! run_test testQueuedCaptureUploadsOnReconnect; then
  echo "FAILED: did not upload on reconnect" >&2
  tail -30 /tmp/mira-offline-testQueuedCaptureUploadsOnReconnect.log >&2
  exit 1
fi
cd ..

AFTER=$(garment_count)
echo "closet after: $AFTER"

if [ "$AFTER" -ne "$((BEFORE + 1))" ]; then
  echo "FAILED: expected exactly one new garment, got $((AFTER - BEFORE))" >&2
  exit 1
fi

echo "PASS: a capture taken offline reached the closet after reconnect."
