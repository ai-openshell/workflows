// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { REGISTRY } from "./quay.mjs";

export const CLIENTS = {
  docker: ["docker", "login"],
  podman: ["podman", "login"],
  helm: ["helm", "registry", "login"],
};

export function login(client, username, password) {
  const [command, ...args] = CLIENTS[client];
  // TODO: say "<command> is not installed" instead of a bare ENOENT.
  execFileSync(
    command,
    [...args, REGISTRY, "--username", username, "--password-stdin"],
    { input: password, stdio: ["pipe", "inherit", "inherit"] },
  );
}
