// SPDX-License-Identifier: Apache-2.0

import { CLIENTS, login } from "./clients.mjs";
import { requestIdToken } from "./oidc.mjs";
import { exchangeForRobotToken } from "./quay.mjs";

function parseClients(value = "") {
  const clients = value.split(/\s+/).filter(Boolean);
  const unknown = clients.filter((client) => !Object.hasOwn(CLIENTS, client));
  if (unknown.length > 0) {
    const known = Object.keys(CLIENTS).join(", ");
    throw new Error(
      `Unknown clients: ${unknown.join(", ")} (expected ${known})`,
    );
  }
  return clients;
}

// Masked before anything else can print it.
function mask(secret) {
  console.log(`::add-mask::${secret}`);
}

async function main() {
  const robot = process.env.INPUT_ROBOT;
  const clients = parseClients(process.env.INPUT_CLIENTS);
  const jwt = await requestIdToken(process.env.INPUT_AUDIENCE);
  mask(jwt);
  const token = await exchangeForRobotToken(robot, jwt);
  mask(token);
  clients.forEach((client) => login(client, robot, token));
}

main().catch((error) => {
  console.log(`::error::${error.message}`);
  process.exitCode = 1;
});
