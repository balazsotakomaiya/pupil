#!/usr/bin/env bash
# Makes the Linux AppImage prefer the host's libwayland-client.so.0.
#
#   scripts/patch-linuxdeploy-gtk-plugin.sh ~/.cache/tauri/linuxdeploy-plugin-gtk.sh
#
# The AppImage bundles libwayland-client from the build machine (Ubuntu 22.04), and AppRun puts
# the bundle's lib directory first in LD_LIBRARY_PATH. Mesa's EGL is *not* bundled, so it is loaded
# from the host and binds to that stale copy. On hosts with a newer Mesa (Fedora 44, for example)
# libEGL_mesa fails to load, and WebKit aborts with "Could not create default EGL display".
#
# The linuxdeploy GTK plugin writes the only hook AppRun sources (apprun-hooks/linuxdeploy-plugin-gtk.sh)
# from a quoted heredoc, so lines added after its `export GDK_BACKEND=x11` line land in every AppImage
# verbatim. They preload the host copy when one exists and do nothing otherwise.
#
# Fails loudly if the anchor line is missing or ambiguous, because that means the upstream plugin
# changed and this patch has to be revisited rather than silently skipped.

set -euo pipefail

plugin="${1:?usage: patch-linuxdeploy-gtk-plugin.sh <path to linuxdeploy-plugin-gtk.sh>}"
anchor='^export GDK_BACKEND=x11'
marker='PUPIL: prefer the host libwayland-client'

if [ ! -f "$plugin" ]; then
  echo "error: $plugin does not exist" >&2
  exit 1
fi

if grep -q "$marker" "$plugin"; then
  echo "$plugin is already patched"
  exit 0
fi

matches="$(grep -c "$anchor" "$plugin" || true)"
if [ "$matches" != "1" ]; then
  echo "error: expected exactly one line matching '$anchor' in $plugin, found $matches." >&2
  echo "The upstream linuxdeploy GTK plugin changed; review scripts/patch-linuxdeploy-gtk-plugin.sh." >&2
  exit 1
fi

block="$(mktemp)"
trap 'rm -f "$block"' EXIT
cat > "$block" <<'HOOK'
# PUPIL: prefer the host libwayland-client. Mesa's EGL is loaded from the host and must bind to the
# host's Wayland client library; the older bundled copy shadows it through LD_LIBRARY_PATH and makes
# WebKit abort ("Could not create default EGL display") on distros with a newer Mesa.
for _pupil_wl_dir in /usr/lib64 /usr/lib/x86_64-linux-gnu /usr/lib; do
  if [ -e "$_pupil_wl_dir/libwayland-client.so.0" ]; then
    export LD_PRELOAD="$_pupil_wl_dir/libwayland-client.so.0${LD_PRELOAD:+:$LD_PRELOAD}"
    break
  fi
done
unset _pupil_wl_dir
HOOK

sed -i "/$anchor/r $block" "$plugin"

if ! grep -q "$marker" "$plugin" || ! bash -n "$plugin"; then
  echo "error: patching $plugin failed" >&2
  exit 1
fi

echo "patched $plugin"
