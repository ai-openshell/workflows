// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function listFiles({ include, exclude = [], cwd }) {
  const excludes = exclude.map((pattern) => `:(exclude)${pattern}`);
  const args = ["ls-files", "-z", "--", ...include, ...excludes];
  // TODO: report git's error clearly (not a repo, invalid pathspec).
  const stdout = execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout.split("\0").filter(Boolean);
}

export function headerSource(path, cwd) {
  const sidecar = `${path}.license`;
  return existsSync(join(cwd, sidecar)) ? sidecar : path;
}
