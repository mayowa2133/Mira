#!/usr/bin/env bash
#
# Run Mira's XCUITest suite against a booted simulator.
#
# These drive the real app against the real stack, so the API must be running
# and the closet seeded:
#
#   npm run db:up && npm run db:migrate && npm run db:seed -- --set=realistic
#   npm run api
#
# Usage: npm run test:ui --workspace @mira/mobile [-- --only <TestClass>]
set -euo pipefail

# CocoaPods needs a UTF-8 locale or it dies with an ASCII-8BIT unicode error.
export LANG="${LANG:-en_US.UTF-8}"
export LC_ALL="${LC_ALL:-en_US.UTF-8}"

cd "$(dirname "$0")/.."

if [ ! -d ios ]; then
  echo "ios/ is generated; running prebuild first…"
  npx expo prebuild --platform ios --no-install
  (cd ios && pod install)
fi

# A UDID, never a name: given a name it cannot match, xcodebuild silently falls
# back to "Any iOS Device" and reports a missing SDK, which reads like a broken
# toolchain rather than a wrong destination.
UDID="${MIRA_SIM_UDID:-$(xcrun simctl list devices booted -j \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);for(const l of Object.values(j.devices))for(const d of l)if(d.state==='Booted'){console.log(d.udid);process.exit(0)}process.exit(1)})")}"

if [ -z "$UDID" ]; then
  echo "No booted simulator. Boot one, e.g.:" >&2
  echo "  xcrun simctl boot 'iPhone 17 Pro'" >&2
  exit 1
fi

echo "Running UI tests on $UDID"

ONLY=""
if [ "${1:-}" = "--only" ] && [ -n "${2:-}" ]; then
  ONLY="-only-testing:MiraUITests/$2"
fi

cd ios
# xcodebuild refuses to overwrite an existing result bundle, so a second run
# fails with exit 64 before a single test executes.
rm -rf build/MiraUITests.xcresult

# shellcheck disable=SC2086
xcodebuild test \
  -workspace Mira.xcworkspace \
  -scheme Mira \
  -configuration Debug \
  -destination "platform=iOS Simulator,id=$UDID" \
  -derivedDataPath build \
  -resultBundlePath build/MiraUITests.xcresult \
  $ONLY \
  -quiet
