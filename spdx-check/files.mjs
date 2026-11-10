// SPDX-License-Identifier: Apache-2.0

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Git reads a second ":(...)" prefix as literal text, so long-form magic
// must be merged into the exclude prefix.
function excludeSpec(pattern) {
  return pattern.startsWith(":(")
    ? `:(exclude,${pattern.slice(2)}`
    : `:(exclude)${pattern}`;
}

export function listFiles({ include, exclude = [], cwd }) {
  const excludes = exclude.map(excludeSpec);
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
