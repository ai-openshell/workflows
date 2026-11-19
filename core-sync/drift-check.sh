#!/usr/bin/env bash
# SPDX-License-Identifier: Apache-2.0

# drift-check.sh: compare core main with the pinned core tag.
#
# Usage: drift-check.sh --out <report.md>
#
# Run from the root of an SDK clone that implements the core-sync contract
# (README.md). Works in a temporary worktree of HEAD. Three checks:
#   1. buf breaking (FILE rules) between the protos `mise run proto:fetch`
#      exports at the pin and at core main, so only the files the SDK
#      generates from count
#   2. regenerate and test: `mise run proto:gen` with the pin moved to core
#      main, then `mise run check` and `mise run test`. The type check in
#      `check` matters: a new enum value can pass buf breaking and the unit
#      tests and still break an exhaustive map.
#   3. uncovered RPCs: `mise run core:uncovered-rpcs` on the regenerated
#      bindings, when the repository has that task; informational, it does
#      not fail the check
# Writes a markdown report with the header
# "Pin: <tag> | Core main: <sha> | Result: pass|fail" and one section per
# check. Exits 0 when checks 1 and 2 pass, 1 otherwise; when the check itself
# cannot run, it exits 1 without writing a report.
set -euo pipefail

core_url=${CORE_URL:-https://github.com/NVIDIA/OpenShell.git}
out=
while [ $# -gt 0 ]; do
  case $1 in
  --out) out=${2:?--out needs a file}; shift 2 ;;
  *) echo "usage: $0 --out <report.md>" >&2; exit 2 ;;
  esac
done
[ -n "$out" ] || { echo "usage: $0 --out <report.md>" >&2; exit 2; }
[ "$(git rev-parse --show-toplevel)" = "$(pwd -P)" ] || {
  echo "ERROR: run this from the root of the SDK clone" >&2
  exit 1
}
case $out in /*) ;; *) out="$(pwd)/$out" ;; esac
rm -f "$out"

pin_of() { sed -n 's/^OPENSHELL_CORE_REF = "\(.*\)"$/\1/p'; }
pin=$(pin_of <mise.toml)
[ -n "$pin" ] || { echo "ERROR: no OPENSHELL_CORE_REF in mise.toml" >&2; exit 1; }
[[ "$pin" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-pre\.[0-9]+)?$ ]] || {
  echo "ERROR: pin '$pin' is not a release tag; commit SHA pins are not supported by core-sync" >&2
  exit 1
}
main_sha=$(git ls-remote "$core_url" refs/heads/main | cut -f1)
[ -n "$main_sha" ] || { echo "ERROR: cannot resolve core main" >&2; exit 1; }

work=$(mktemp -d)
cleanup() { git worktree remove --force "$work/wt" >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT
result=pass
fence() { printf '```text\n%s\n```\n' "$1"; }
has_task() { mise tasks info "$1" >/dev/null 2>&1; }

git worktree add --quiet --detach "$work/wt" HEAD
cd "$work/wt"
mise trust --quiet mise.toml

# The protos at the pin, for buf breaking. proto:fetch writes them to proto/.
log=$(mise run --quiet proto:fetch 2>&1) || {
  printf '%s\n' "$log" >&2
  echo "ERROR: mise run proto:fetch failed at the pin $pin" >&2
  exit 1
}
mv proto "$work/pinned"
files=$(cd "$work/pinned" && find . -name '*.proto' | sed 's#^\./##' | sort)

# 2. Move the pin to core main and regenerate. proto:gen exports main's protos
# into proto/ on the way.
sed -i.bak "s/^OPENSHELL_CORE_REF = \".*\"$/OPENSHELL_CORE_REF = \"$main_sha\"/" mise.toml
rm -f mise.toml.bak
mise trust --quiet mise.toml
# proto:check compares the bindings with the last commit, so commit the
# regenerated ones in the throwaway worktree before running check.
commit_regenerated() {
  git add -A &&
    git -c user.name=core-drift -c user.email=core-drift@localhost -c commit.gpgsign=false \
      commit --quiet --no-verify --allow-empty -m "regenerate from core main"
}
if build=$(
  mise run --quiet proto:gen 2>&1 &&
    commit_regenerated 2>&1 &&
    mise run --quiet check 2>&1 &&
    mise run --quiet test 2>&1
); then
  # shellcheck disable=SC2086 # a space-separated list of paths
  changed=$(git diff --stat HEAD~1 HEAD -- ${OPENSHELL_GENERATED_PATHS:-.} | tail -1 | sed 's/^ *//')
  build_section="Bindings from main pass \`mise run check\` and \`mise run test\` (${changed:-no generated files change})."
else
  result=fail
  build_section="Regenerating from main, checking or testing against it fails:

$(fence "$(tail -n 60 <<<"$build")")"
fi
# proto/ exists when proto:gen got as far as exporting main's protos.
generated=no
if [ -d proto ]; then generated=yes; fi

# 1. buf breaking between the two exports. Without a buf.yaml the directories
# are plain modules, so FILE rules compare file by file.
if [ "$generated" = no ]; then
  result=fail
  breaking_section="Not run: exporting core main's protos failed (see below)."
elif breaking=$(mise run --quiet proto:buf -- breaking proto --against "$work/pinned" \
  --config '{"version":"v2","breaking":{"use":["FILE"]}}' 2>&1); then
  breaking_section="No breaking changes in $(echo $files | sed 's/ /, /g') between \`$pin\` and main."
else
  result=fail
  breaking_section="Breaking changes between \`$pin\` and main:

$(fence "$breaking")"
fi

# 3. RPCs the SDK does not call yet, from the repository's own task: one
# "Service.Method" per line.
if ! has_task core:uncovered-rpcs; then
  uncovered_section="Not reported: the repository has no \`core:uncovered-rpcs\` task."
elif [ "$generated" = no ]; then
  uncovered_section="Not reported: regenerating from main failed."
elif ! uncovered=$(mise run --quiet core:uncovered-rpcs 2>&1); then
  uncovered_section="\`mise run core:uncovered-rpcs\` failed:

$(fence "$uncovered")"
elif [ -z "$uncovered" ]; then
  uncovered_section="Every RPC in the regenerated bindings is called by the SDK."
else
  uncovered_section="RPCs in core main that the SDK does not call yet ($(grep -c . <<<"$uncovered")):

$(sed 's/^/- /' <<<"$uncovered")"
fi

cat >"$out" <<REPORT
Pin: $pin | Core main: $main_sha | Result: $result

## buf breaking

$breaking_section

## Regenerate and test

$build_section

## Uncovered RPCs

$uncovered_section
REPORT

echo "Drift check against core main $main_sha: $result (report: $out)"
[ "$result" = pass ]
