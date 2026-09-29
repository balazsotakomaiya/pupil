#!/usr/bin/env bash
# Runs the e2e smoke test against a built Pupil binary on Linux, headlessly.
#
#   bun run --cwd apps/app tauri build --debug --no-bundle
#   apps/app/e2e/run-linux.sh
#
# Needs: xvfb, dbus-run-session, tauri-driver, WebKitWebDriver (webkit2gtk-driver).
# Data is isolated under a throwaway XDG tree, so nothing touches ~/.local/share.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
app_dir="$(dirname "$here")"
export PUPIL_BIN="${PUPIL_BIN:-$app_dir/src-tauri/target/debug/pupil-app}"
export E2E_OUT="${E2E_OUT:-$app_dir/e2e-out}"
export E2E_SCRIPT="${E2E_SCRIPT:-$here/smoke.mjs}"

sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT
export HOME="$sandbox/home"
export XDG_DATA_HOME="$sandbox/data" XDG_CONFIG_HOME="$sandbox/config" XDG_CACHE_HOME="$sandbox/cache"
mkdir -p "$HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

# Hand the window manager / keyring choices to the caller: RUN_WM=openbox, RUN_KEYRING=1.
inner='
  if [ -n "${RUN_WM:-}" ]; then "$RUN_WM" >/dev/null 2>&1 & sleep 1; fi
  if [ -n "${RUN_KEYRING:-}" ]; then
    eval "$(echo "" | gnome-keyring-daemon --unlock --components=secrets 2>/dev/null | sed "s/^/export /")"
  fi
  exec node "$E2E_SCRIPT"
'
exec xvfb-run -a -s "-screen 0 1440x1000x24" dbus-run-session -- bash -c "$inner"
