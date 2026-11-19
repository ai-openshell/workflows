# core-sync

Keeps an SDK repository in step with OpenShell core
([NVIDIA/OpenShell](https://github.com/NVIDIA/OpenShell)): one pin,
`OPENSHELL_CORE_REF` in `mise.toml`, a bump pull request for each new core
release, a nightly drift check against core `main`, and a release tag when a
stable pin lands on `main`.

The language-independent part lives here: the scripts in this directory and
the reusable workflows
[`core-watch.yml`](../.github/workflows/core-watch.yml) and
[`core-drift.yml`](../.github/workflows/core-drift.yml). The SDK repository
provides the language-specific part as mise tasks.

## Scripts

| Script                  | Task                  | What it does                                                                                                                                        |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core-tags.sh`          | `core:tags`           | Lists core release tags newer than the pin.                                                                                                         |
| `open-bump-pr.sh`       | `core:bump`           | Moves the pin to a tag, regenerates, refreshes copied core files, and opens the `chore(core): track <tag>` pull request.                            |
| `drift-check.sh`        | `core:drift`          | Compares core `main` with the pin: `buf breaking`, regenerate then `check` and `test`, uncovered RPCs. Writes a markdown report.                    |
| `update-drift-issue.sh` | `core:drift-issue`    | Creates, updates, or closes the "Core main drift" issue from a report.                                                                              |
| `report-failure.sh`     | `core:report-failure` | Records a failed automation run in the drift issue.                                                                                                 |
| `tag-release.sh`        | `release:tag`         | Tags `vX.Y.Z` and drafts the GitHub release when a stable pin lands on `main`. The repository's own `release.yml` builds and publishes the package. |

Each script documents its arguments in its header. All of them run from the
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

Point the core-sync tasks at the scripts with mise
[remote tasks](https://mise.jdx.dev/tasks/toml-tasks.html#remote-tasks),
pinned to a commit of this repository:

```toml
[tasks."core:tags"]
description = "List core release tags newer than the pin"
file = "git::https://github.com/ai-openshell/workflows.git//core-sync/core-tags.sh?ref=<sha>"
```

and call the reusable workflows at the same commit:

```yaml
name: core-watch

on:
  schedule:
    - cron: "17 * * * *"
  workflow_dispatch:
    inputs:
      tag:
        description: Core tag to propose; empty proposes every new tag
        required: false
        default: ""

permissions:
  contents: read

jobs:
  watch:
    uses: ai-openshell/workflows/.github/workflows/core-watch.yml@<sha>
    with:
      tag: ${{ inputs.tag }}
    secrets: inherit
```

The workflow and the scripts are pinned separately, so update both refs
together.
