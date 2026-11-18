// SPDX-License-Identifier: Apache-2.0

export const REGISTRY = "quay.io";

const FEDERATION_URL = `https://${REGISTRY}/oauth2/federation/robot/token`;

// Quay hands out a one-hour robot token only when the robot trusts the JWT's
// issuer and subject exactly.
export async function exchangeForRobotToken(robot, jwt) {
  const basic = Buffer.from(`${robot}:${jwt}`).toString("base64");
  const response = await fetch(FEDERATION_URL, {
    headers: { Authorization: `Basic ${basic}` },
  });
  // Quay's body says why (unknown robot, untrusted subject) and never echoes the JWT.
  if (!response.ok) {
    const reason = await response.text();
    throw new Error(`${REGISTRY} refused the exchange for ${robot}: ${reason}`);
  }
  const { token } = await response.json();
  return token;
}
