// SPDX-License-Identifier: Apache-2.0

export async function requestIdToken(audience) {
  const {
    ACTIONS_ID_TOKEN_REQUEST_URL: url,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: bearer,
  } = process.env;
  if (!url || !bearer) {
    throw new Error(
      "No GitHub OIDC token available; the job needs 'permissions: id-token: write'",
    );
  }
  const request = new URL(url);
  request.searchParams.set("audience", audience);
  const response = await fetch(request, {
    headers: { Authorization: `bearer ${bearer}` },
  });
  // TODO: report GitHub's status and body when the request fails.
  const { value } = await response.json();
  return value;
}
