# core-sync

Keeps an SDK repository in step with OpenShell core
([NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell)): one pin,
`OPENSHELL_CORE_REF` in `mise.toml`, a bump pull request for each new core
release, a nightly drift check against core `main`, and a release tag when a
stable pin lands on `main`.

The language-independent part lives here: the scripts in this directory and
the reusable workflows
[`core-watch.yml`](../.github/workflows/core-watch.yml),
[`core-drift.yml`](../.github/workflows/core-drift.yml), and
[`release-tag.yml`](../.github/workflows/release-tag.yml). The SDK repository
provides the language-specific part as mise tasks.

The SDK pins one commit of this repository, in the `uses:` lines of its
workflows. The reusable workflows run the scripts of that same commit: they
load this directory as an action with `uses: $/core-sync`, which resolves to
the workflow's own repository at the commit being run, and the action sets
`CORE_SYNC_DIR`. Locally, the SDK's copy of `core-sync.sh` reads the commit
from `.github/workflows/core-drift.yml` and downloads that commit's scripts.

## Scripts

| Script                  | Task                  | What it does                                                                                                                                        |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core-tags.sh`          | `core:tags`           | Lists core release tags newer than the pin.                                                                                                         |
| `open-bump-pr.sh`       | `core:bump`           | Moves the pin to a tag, regenerates, refreshes copied core files, and opens the `chore(core): track <tag>` pull request.                            |
| `drift-check.sh`        | `core:drift`          | Compares core `main` with the pin: `buf breaking`, regenerate then `check` and `test`, uncovered RPCs. Writes a markdown report.                    |
| `update-drift-issue.sh` | `core:drift-issue`    | Creates, updates, or closes the "Core main drift" issue from a report.                                                                              |
| `report-failure.sh`     | `core:report-failure` | Records a failed automation run in the drift issue.                                                                                                 |
| `tag-release.sh`        | `release:tag`         | Tags `vX.Y.Z` and drafts the GitHub release when a stable pin lands on `main`. The repository's own `release.yml` builds and publishes the package. |

`core-sync.sh` is the SDK-side entry point that finds the scripts, and `action.yml` sets `CORE_SYNC_DIR` in the reusable workflows. Each script documents its arguments in its header. All of them run from the
root of the SDK clone and use `gh`, `git`, and `mise`.

## Contract

The SDK repository's `mise.toml` provides:

| Name                        | Kind | Used by          | What it does                                                                                             |
| --------------------------- | ---- | ---------------- | -------------------------------------------------------------------------------------------------------- |
| `OPENSHELL_CORE_REF`        | env  | all              | The pin, a core release tag (`vX.Y.Z` or `vX.Y.Z-pre.N`), as `OPENSHELL_CORE_REF = "<tag>"` on one line. |
| `OPENSHELL_GENERATED_PATHS` | env  | bump, drift      | Space-separated paths of the committed generated bindings, for the summaries.                            |
| `core:version`              | task | core-watch       | Prints the pin.                                                                                          |
| `proto:fetch`               | task | drift            | Exports the protos the SDK generates from, at the pin, into `proto/`.                                    |
| `proto:gen`                 | task | bump, drift      | Regenerates the committed bindings from the pin.                                                         |
| `proto:buf`                 | task | drift            | Runs `buf` with the given arguments.                                                                     |
| `check`, `test`             | task | drift            | The repository's checks (including a type check, if the language has one) and unit tests.                |
| `core:uncovered-rpcs`       | task | drift (optional) | Prints the RPCs in the bindings that the curated SDK doesn't call, one `Service.Method` per line.        |

Files copied from core, listed as `<path in core> <path here>` lines in
`scripts/vendored-core-files.txt`, are refreshed by bump pull requests when
the file exists.

The repository also needs:

- The `sdk-bot` environment, deployable only from `main`, with the
  `SDK_BOT_CLIENT_ID` and `SDK_BOT_PRIVATE_KEY` secrets of a GitHub App that
  can write contents, pull requests, and issues.
- The labels `core-bump`, `stable`, `prerelease`, and `core-drift`.

## Using it

Copy [`core-sync.sh`](core-sync.sh) to `scripts/core-sync.sh` and point the
tasks at it:

```toml
[tasks."core:tags"]
description = "List core release tags newer than the pin"
run = "scripts/core-sync.sh core-tags.sh"
```

The same for `core:bump` (`open-bump-pr.sh`), `core:drift`
(`drift-check.sh`), `core:drift-issue` (`update-drift-issue.sh`),
`core:report-failure` (`report-failure.sh`), and `release:tag`
(`tag-release.sh`, for running it locally).

Call the reusable workflows, all at the same commit:

```yaml
name: core-drift

on:
  schedule:
    - cron: "41 4 * * *"
  workflow_dispatch:

permissions:
  contents: read

jobs:
  drift:
    uses: ai-openshell/workflows/.github/workflows/core-drift.yml@<sha>
```

`core-watch.yml` takes an optional `tag` input. In the release workflow, the
tag job is a call to `release-tag.yml` that grants `contents: write` and
`pull-requests: read` and passes `sha` on `workflow_dispatch`; its `tag`
output gates the build and publish jobs.

The caller passes no secrets: the called jobs declare the `sdk-bot`
environment and read the App secrets from it.

## Security

The scripts and workflows here run in SDK repositories with their bot App's
secrets, so:

- Changes here need an infra review (`.github/CODEOWNERS`).
- SDKs pin a full commit SHA of `main`. Run `scripts/core-sync.sh --check-pin`
  in the SDK's CI: it fails when the workflows call the shared workflows at
  different refs, or at a commit that isn't on this repository's `main`. A
  commit that only exists in a fork is reachable through this repository's
  name too, so a pin bump could otherwise point at one. The check runs from
  the SDK's own copy of `core-sync.sh`, not from the pinned commit, and runs
  again before a local download.
- `core-watch` keeps the App token out of the checkout's git config and out
  of the environment while `open-bump-pr.sh` regenerates the bindings, which
  installs the SDK's dependencies and runs their install scripts. `git push`
  gets the token from gh.
- The workflows that hold the token use a fixed mise version.
