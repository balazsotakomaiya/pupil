#!/usr/bin/env bash
# Starts a packaged Pupil AppImage under Xvfb and checks that its window really comes up.
#
#   apps/app/e2e/appimage-launch-check.sh path/to/Pupil_x.y.z_amd64.AppImage
#
# This exists because an AppImage carries its own copies of many libraries and borrows the rest from
# the host, so it can break on a distro the build machine is not (a bundled libwayland-client that is
# older than the host's Mesa makes WebKit abort at startup). Run it inside the distro you care about.
#
# Passes when a screenshot of the display shows a rendered page (many distinct colours, where a blank
# window has a handful) and the app and its web process are still alive a few seconds later. Fails
# when the app exits, prints an EGL/crash message, or shows nothing before the timeout.
#
# Needs: xvfb-run, dbus-run-session, pgrep, ImageMagick (import + identify, or `magick`).
# Environment: E2E_OUT (default ./e2e-out), LAUNCH_TIMEOUT seconds (default 40).

set -uo pipefail

appimage="$(realpath "${1:?usage: appimage-launch-check.sh <path to AppImage>}")"
out="$(realpath -m "${E2E_OUT:-e2e-out}")"
mkdir -p "$out"

sandbox="$(mktemp -d)"
trap 'rm -rf "$sandbox"' EXIT
export HOME="$sandbox/home"
export XDG_DATA_HOME="$sandbox/data" XDG_CONFIG_HOME="$sandbox/config" XDG_CACHE_HOME="$sandbox/cache"
mkdir -p "$HOME" "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME"

# Containers usually have no FUSE, so let the AppImage unpack itself and run from there.
export APPIMAGE_EXTRACT_AND_RUN=1
export CHECK_APPIMAGE="$appimage" CHECK_OUT="$out"
chmod +x "$appimage"

inner='
  log="$CHECK_OUT/appimage.log"
  shot="$CHECK_OUT/appimage-window.png"
  "$CHECK_APPIMAGE" > "$log" 2>&1 &
  app=$!

  if command -v import >/dev/null 2>&1; then
    capture() { import -window root "$1"; }
    colours() { identify -format %k "$1"; }
  else
    capture() { magick import -window root "$1"; }
    colours() { magick identify -format %k "$1"; }
  fi

  failure=""
  rendered=""
  deadline=$((SECONDS + ${LAUNCH_TIMEOUT:-40}))
  while [ "$SECONDS" -lt "$deadline" ]; do
    sleep 1
    if ! kill -0 "$app" 2>/dev/null; then
      wait "$app"; failure="the app exited (status $?) before showing a window"; break
    fi
    crash="$(grep -m1 -E "Could not create default EGL display|Segmentation fault|core dumped|Aborted" "$log" || true)"
    if [ -n "$crash" ]; then failure="the app printed: $crash"; break; fi
    if capture "$shot" 2>/dev/null && [ "$(colours "$shot" 2>/dev/null || echo 0)" -gt 300 ]; then
      rendered=1; break
    fi
  done

  if [ -n "$rendered" ]; then
    sleep 5   # a crashing web process usually takes a moment to take the window with it
    pgrep -x pupil-app >/dev/null || failure="the app was gone 5s after its window appeared"
    pgrep -f WebKitWebProcess >/dev/null || failure="${failure:-the WebKit web process was gone 5s after the window appeared}"
    capture "$shot" 2>/dev/null
  elif [ -z "$failure" ]; then
    failure="no rendered window within ${LAUNCH_TIMEOUT:-40}s"
  fi

  pid="$(pgrep -x pupil-app | head -1)"
  if [ -n "$pid" ]; then
    echo "libwayland-client in the running app: $(grep -o "/[^ ]*libwayland-client[^ ]*" /proc/$pid/maps | sort -u | tr "\n" " ")"
    echo "LD_PRELOAD in the running app: $({ tr "\0" "\n" < /proc/$pid/environ | grep "^LD_PRELOAD=" || echo "(unset)"; } 2>/dev/null)"
  fi

  kill "$app" 2>/dev/null; pkill -x pupil-app 2>/dev/null; pkill -f WebKitWebProcess 2>/dev/null; wait 2>/dev/null

  if [ -n "$failure" ]; then
    echo "FAIL: $failure"
    echo "--- last lines of the app output"
    tail -n 15 "$log"
    exit 1
  fi
  echo "PASS: the window rendered and stayed up ($(colours "$shot") distinct colours)"
'

# Run the script from a file rather than `bash -c "$inner"`: the pgrep/pkill -f calls above match on
# full command lines, and would otherwise match (and kill) this script's own text.
printf '%s\n' "$inner" > "$sandbox/check.sh"
# Not `exec`: that would replace this shell and skip the cleanup trap above.
xvfb-run -a -s "-screen 0 1280x900x24" dbus-run-session -- bash "$sandbox/check.sh"
