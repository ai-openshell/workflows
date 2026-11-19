# workflows

Reusable GitHub Actions workflows for the ai-openshell organization.

## Actions

- [`spdx-check`](spdx-check/): fails the job if source files lack an
  `SPDX-License-Identifier: Apache-2.0` header.
- [`quay-login`](quay-login/): logs docker, podman or helm in to quay.io as a
  robot account, using the job's GitHub OIDC token instead of a secret.

## Workflows

- [`core-watch.yml`, `core-drift.yml`, `release-tag.yml`](core-sync/): keep an SDK repository in
  step with OpenShell core, with the core-sync scripts behind mise tasks.
