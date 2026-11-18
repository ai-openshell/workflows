# workflows

Reusable GitHub Actions workflows for the ai-openshell organization.

## Actions

- [`spdx-check`](spdx-check/): fails the job if source files lack an
  `SPDX-License-Identifier: Apache-2.0` header.
- [`quay-login`](quay-login/): logs docker, podman or helm in to quay.io as a
  robot account, using the job's GitHub OIDC token instead of a secret.
