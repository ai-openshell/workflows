#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# core-sync.sh: run a shared core-sync script from ai-openshell/workflows.
# SDK repositories keep a copy of this file as scripts/core-sync.sh and point
# their core-sync mise tasks at it.
#
# Usage: scripts/core-sync.sh <script> [args...]
#        scripts/core-sync.sh --check-pin
#
# In CI, the shared workflows set CORE_SYNC_DIR to the scripts of the commit
# they run from. Locally, the commit is the one .github/workflows/core-drift.yml
# calls (the single pin), and its core-sync/ is downloaded once into
# ${XDG_CACHE_HOME:-~/.cache}/openshell-core-sync/<sha>.
#
# --check-pin (run in CI) checks the pin itself, with this file rather than
# with code from the pinned commit: every workflow calls the shared workflows
# at the same <owner>/<repo>@<sha>, and that commit is on the repository's
# main. A commit from a fork is reachable through the upstream repository's
# name too, so a pin that only exists in a fork would otherwise pass for one
# of the repository's own. The same check runs before a local download.
# CORE_SYNC_ALLOW_UNMERGED=1 skips the main check, to try an unmerged commit.
set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }

# The "<owner>/<repo> <sha>" of every call to a shared workflow, one per line.
pins() {
  sed -nE 's#^ *uses: *([^/ ]+/[^/ ]+)/\.github/workflows/(core-watch|core-drift|release-tag)\.yml@([^ ]*).*#\1 \3#p' \
    .github/workflows/*.yml | sort -u
}

# check_pin <repo> <sha>: the commit is on <repo>'s main.
check_pin() {
  local auth=() status
  [ -z "${GH_TOKEN:-}" ] || auth=(-H "Authorization: Bearer $GH_TOKEN")
  status=$(curl -fsS "${auth[@]}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$1/compare/main...$2?per_page=1" |
    sed -nE 's/^  "status": "([a-z]+)",$/\1/p') ||
    die "cannot compare $2 with $1 main"
  case $status in
  identical | behind) ;;
  *)
    [ "${CORE_SYNC_ALLOW_UNMERGED:-}" = 1 ] ||
      die "the core-sync pin $1@$2 is not on $1 main (compare status: ${status:-unknown}); pin a commit from main"
    echo "WARNING: the core-sync pin $1@$2 is not on $1 main (CORE_SYNC_ALLOW_UNMERGED=1)" >&2
    ;;
  esac
}

# The single pin, from all calls to the shared workflows.
pin=$(pins)
[ -n "$pin" ] || die "no workflow under .github/workflows calls a shared core-sync workflow"
[ "$(wc -l <<<"$pin")" -eq 1 ] || die "the shared core-sync workflows are called at different refs:
$pin"
read -r repo sha <<<"$pin"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "the shared core-sync workflows are called at '$sha', not a full commit SHA"

if [ "${1:-}" = --check-pin ]; then
  check_pin "$repo" "$sha"
  echo "core-sync pin: $repo@$sha"
  exit 0
fi

script=${1:?usage: $0 <script> [args...] | --check-pin}
shift
if [ -z "${CORE_SYNC_DIR:-}" ]; then
  CORE_SYNC_DIR=${XDG_CACHE_HOME:-$HOME/.cache}/openshell-core-sync/$sha/core-sync
  if [ ! -d "$CORE_SYNC_DIR" ]; then
    check_pin "$repo" "$sha"
    tmp=$(mktemp -d)
    curl -fsSL "https://codeload.github.com/$repo/tar.gz/$sha" | tar -xz -C "$tmp" --strip-components=1
    mkdir -p "$(dirname "$CORE_SYNC_DIR")"
    mv "$tmp/core-sync" "$CORE_SYNC_DIR"
    rm -rf "$tmp"
  fi
fi
exec "$CORE_SYNC_DIR/$script" "$@"
