#!/bin/bash
# Build, install, and launch Sector Defense on a connected physical iPhone.
# Requires: Xcode, a paired iPhone with Developer Mode on, and the profile
# trusted on the phone (one-time setup; free Personal Team works).
set -euo pipefail
cd "$(dirname "$0")/.."

export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"

UDID="$(xcrun devicectl list devices 2>/dev/null | awk '/physical/ {for (i = 1; i <= NF; i++) if ($i ~ /^[0-9A-F]{8}-[0-9A-F]{16}$/) {print $i; exit}}')"
if [ -z "$UDID" ]; then
  echo "ERROR: No physical iPhone found. Plug it in via USB and re-run." >&2
  exit 1
fi
echo "==> Device: $UDID"

echo "==> Syncing web assets"
npm run cap:prepare --silent >/dev/null

echo "==> Building (signed for device)"
xcodebuild -project ios/App/App.xcodeproj -scheme App \
  -destination "id=$UDID" -configuration Debug \
  -derivedDataPath ios/DerivedDataDevice \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  build -quiet

APP="ios/DerivedDataDevice/Build/Products/Debug-iphoneos/App.app"
echo "==> Installing to device"
xcrun devicectl device install app --device "$UDID" "$APP" >/dev/null

echo "==> Launching"
xcrun devicectl device process launch --device "$UDID" io.github.markstyx.sectordefense
echo "==> Done. Game should now be running on your iPhone."
