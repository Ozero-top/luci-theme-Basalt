#!/bin/sh
# Assemble a static site tree combining the *real* LuCI core JS from a given
# openwrt/luci branch with this theme's menu renderer, styles and the browser
# harness. The assembled tree is what run-browser-tests.mjs drives.
#
# usage: assemble-site.sh <luci-branch> <dest-dir>
# e.g. : assemble-site.sh openwrt-25.12 site
set -eu

BRANCH="${1:?luci branch required, e.g. openwrt-25.12}"
DEST="${2:?destination directory required}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="https://raw.githubusercontent.com/openwrt/luci/${BRANCH}/modules/luci-base/htdocs/luci-static/resources"

RES="$DEST/luci-static/resources"
MEDIA="$DEST/luci-static/basalt"
mkdir -p "$RES/icons" "$MEDIA/css" "$MEDIA/pattern"

# Core runtime files as served by luci-base (jsmin-minified in real builds,
# the unminified branch sources behave identically for API purposes).
for f in cbi.js luci.js form.js ui.js uci.js rpc.js fs.js validation.js xhr.js; do
  curl -fsSL --retry 3 "$RAW/$f" -o "$RES/$f"
done
# baseclass is a standalone file on old branches and built into luci.js on
# newer ones; fetch it when present but do not fail the assembly otherwise.
curl -fsSL --retry 3 "$RAW/baseclass.js" -o "$RES/baseclass.js" || rm -f "$RES/baseclass.js"

# Static asset placeholders (spinner etc.) so startup emits no 404 noise.
cp "$REPO_ROOT/tests/harness/assets/icons/loading.svg" "$RES/icons/"

# Theme menu renderer, stylesheet and media under test.
cp "$REPO_ROOT/htdocs/luci-static/resources/menu-basalt.js" "$RES/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/css/cascade.css" "$MEDIA/css/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/pattern/texture.svg" "$MEDIA/pattern/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/logo.svg" "$MEDIA/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/logo_48.png" "$MEDIA/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/app-icon-192.png" "$MEDIA/"
cp "$REPO_ROOT/htdocs/luci-static/basalt/manifest.json" "$MEDIA/"
cp "$REPO_ROOT/tests/harness/shell.html" "$DEST/shell.html"

echo "assembled site for luci branch '$BRANCH' at $DEST"
