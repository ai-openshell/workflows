# spdx-check

Fails the job if a tracked file lacks `SPDX-License-Identifier: Apache-2.0`
in its first 10 lines. It's a JavaScript action with no dependencies, so it
runs as a step in a job you already have, with no setup step.

```yaml
- uses: actions/checkout@v7
- uses: ai-openshell/workflows/spdx-check@main
  with:
    include: "*.py *.rs *.go Dockerfile* */Dockerfile* scripts/bin/*"
    exclude: "third_party/* *_pb2.py"
```

## Inputs

- `include` (required): which files to check.
- `exclude` (optional): which of those files to skip.

Both are
[git pathspecs](https://git-scm.com/docs/gitglossary#def_pathspec),
separated by spaces or newlines. Only tracked files are checked, so gitignored
paths like `node_modules/` never show up. Under git's default pathspec rules,
`*` also matches `/`:

- `*.py` matches Python files at any depth.
- `Dockerfile*` matches only root-level Dockerfiles. Add `*/Dockerfile*` for
  nested ones.
- `scripts/bin/*` matches everything under `scripts/bin/`.

## Rules

- The license must be exactly `Apache-2.0`. The check rejects
  `Apache-2.0-only` and `Apache-2.0 OR MIT`.
- Empty files pass.
- For files that can't hold a comment, such as JSON, put the header in a
  [REUSE](https://reuse.software/spec/) sidecar named `<file>.license`. When a
  sidecar exists, the check reads it instead of the file.

Each failing file gets an error annotation on line 1, and the job summary lists
all of them.
