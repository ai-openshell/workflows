#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# core-sync.sh: run a shared core-sync script from ai-openshell/workflows.
# SDK repositories keep a copy of this file as scripts/core-sync.sh and point
# their core-sync mise tasks at it.
#
# Usage: scripts/core-sync.sh <script> [args...]
#
# In CI, the shared workflows set CORE_SYNC_DIR to the scripts of the commit
# they run from. Locally, the commit is the one .github/workflows/core-drift.yml
# calls (the single pin), and its core-sync/ is downloaded once into
# ${XDG_CACHE_HOME:-~/.cache}/openshell-core-sync/<sha>.
set -euo pipefail

script=${1:?usage: $0 <script> [args...]}
shift
if [ -z "${CORE_SYNC_DIR:-}" ]; then
  pin=$(sed -n 's#^ *uses: *\([^/ ]*/[^/ ]*\)/\.github/workflows/core-drift\.yml@\([0-9a-f]\{40\}\).*#\1 \2#p' \
    .github/workflows/core-drift.yml)
  [ -n "$pin" ] || {
    echo "ERROR: .github/workflows/core-drift.yml has no 'uses: <owner>/<repo>/.github/workflows/core-drift.yml@<sha>' line" >&2
    exit 1
  }
  read -r repo sha <<<"$pin"
  CORE_SYNC_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/openshell-core-sync/$sha/core-sync
  if [ ! -d "$CORE_SYNC_DIR" ]; then
    tmp=$(mktemp -d)
    curl -fsSL "https://codeload.github.com/$repo/tar.gz/$sha" | tar -xz -C "$tmp" --strip-components=1
    mkdir -p "$(dirname "$CORE_SYNC_DIR")"
    mv "$tmp/core-sync" "$CORE_SYNC_DIR"
    rm -rf "$tmp"
  fi
fi
exec "$CORE_SYNC_DIR/$script" "$@"
