# quay-login

Logs docker, podman or helm in to quay.io as a robot account, with no stored
secret. The step asks GitHub for the job's OIDC token and trades it at Quay's
robot federation endpoint for a robot token that lasts one hour. It's a
JavaScript action with no dependencies.

```yaml
jobs:
  publish:
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: ai-openshell/workflows/quay-login@main
        with:
          robot: ai-openshell+console_release
          clients: docker helm
      - run: docker push quay.io/ai-openshell/console:${{ github.sha }}
```

## Inputs

- `robot` (required): the robot account, written `namespace+name`.
- `clients` (optional, default `docker`): any of `docker`, `podman` and
  `helm`, separated by spaces or newlines. A client that isn't installed fails
  the step.
- `audience` (optional, default `quay`): the audience of the GitHub token. It
  must be one the robot's federation lists.

## Trust

Quay gives out a robot token only when the robot's federation trusts the
GitHub token's issuer (`https://token.actions.githubusercontent.com`) and its
subject, compared exactly. Bind each robot to a GitHub environment, for
example `repo:ai-openshell/console:environment:release`. A job outside that
environment then gets nothing, whatever its workflow file says.

The job needs `permissions: id-token: write`. Pull requests from forks never
get an OIDC token, so the step fails there.

Both tokens are masked in the job log. The robot token expires after an hour,
so a job that runs longer must log in again.
