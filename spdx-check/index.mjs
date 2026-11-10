// SPDX-License-Identifier: Apache-2.0

import { appendFileSync, closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { headerSource, listFiles } from "./files.mjs";
import { hasHeaderLines, hasSpdxHeader } from "./header.mjs";

const LICENSE = "SPDX-License-Identifier: Apache-2.0";
const head = Buffer.alloc(8192);

function patterns(value = "") {
  return value.split(/\s+/).filter(Boolean);
}

// Grows past 8 KiB only until the header lines are complete, so a long line
// can't hide the header or cut a license expression short.
function readHead(path) {
  // TODO: handle unreadable entries (submodules, dangling symlinks, deleted files).
  const fd = openSync(path, "r");
  let buf = head;
  let size = readSync(fd, buf, 0, buf.length, 0);
  while (size === buf.length && !hasHeaderLines(buf)) {
    buf = Buffer.concat([buf], buf.length * 2);
    size += readSync(fd, buf, size, buf.length - size, size);
  }
  closeSync(fd);
  return buf.subarray(0, size);
}

// GitHub's escaping rules for workflow command property values.
function escapeProperty(value) {
  return value
    .replaceAll("%", "%25")
    .replaceAll("\r", "%0D")
    .replaceAll("\n", "%0A")
    .replaceAll(":", "%3A")
    .replaceAll(",", "%2C");
}

function findFailures(files, cwd) {
  const failures = [];
  for (const file of files) {
    const src = headerSource(file, cwd);
    if (!hasSpdxHeader(readHead(join(cwd, src)))) failures.push(src);
  }
  return failures.sort();
}

function writeSummary(path, total, failures) {
  const lines = [
    "### SPDX check",
    "",
    `Checked ${total} files, ${failures.length} missing \`${LICENSE}\`.`,
    "",
    ...failures.map((failure) => `- \`${failure}\``),
  ];
  appendFileSync(path, lines.join("\n") + "\n");
}

function main() {
  const cwd = process.cwd();
  // TODO: reject an empty include; git ls-files with no pathspec lists every file.
  const include = patterns(process.env.INPUT_INCLUDE);
  const exclude = patterns(process.env.INPUT_EXCLUDE);
  const files = listFiles({ include, exclude, cwd });
  const failures = findFailures(files, cwd);
  for (const src of failures) {
    console.log(`::error file=${escapeProperty(src)},line=1::Missing ${LICENSE}`);
  }
  console.log(
    `Checked ${files.length} files, ${failures.length} missing ${LICENSE}`,
  );
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) writeSummary(summaryPath, files.length, failures);
  if (failures.length > 0) process.exitCode = 1;
}

main();
