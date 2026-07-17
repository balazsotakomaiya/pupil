#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
coverage_dir="$repo_root/apps/app/coverage/rust"
manifest_path="$repo_root/apps/app/src-tauri/Cargo.toml"
ignore_filename_regex='(^|/)(main|lib|app|commands)\.rs$|(^|/)ai/(secrets|provider)\.rs$'

# cargo install places subcommands here, even when this directory is not on PATH.
cargo_bin_dir="${CARGO_HOME:-$HOME/.cargo}/bin"
export PATH="$cargo_bin_dir:$PATH"

# Homebrew Rust does not ship rustup's llvm-tools-preview component. On macOS,
# use Xcode's equivalent tools; rustup-managed toolchains use llvm-tools-preview.
if ! command -v rustup >/dev/null && command -v xcrun >/dev/null; then
  export LLVM_COV="$(xcrun --find llvm-cov)"
  export LLVM_PROFDATA="$(xcrun --find llvm-profdata)"
fi

mkdir -p "$coverage_dir"

cargo llvm-cov \
  --manifest-path "$manifest_path" \
  --all-targets \
  --ignore-filename-regex "$ignore_filename_regex"

cargo llvm-cov report \
  --manifest-path "$manifest_path" \
  --lcov \
  --output-path "$coverage_dir/lcov.info" \
  --ignore-filename-regex "$ignore_filename_regex"
