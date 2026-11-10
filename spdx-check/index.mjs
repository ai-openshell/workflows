// SPDX-License-Identifier: Apache-2.0

import { appendFileSync, closeSync, openSync, readSync } from "node:fs";
import { join } from "node:path";
import { headerSource, listFiles } from "./files.mjs";
import { hasHeaderLines, hasSpdxHeader } from "./header.mjs";

const LICENSE = "SPDX-License-Identifier: Apache-2.0";
const ESCAPES = {
  "%": "%25",
  "\r": "%0D",
  "\n": "%0A",
  ":": "%3A",
  ",": "%2C",
};
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

function findFailures(files, cwd) {
  return files
    .map((file) => headerSource(file, cwd))
    .filter((src) => !hasSpdxHeader(readHead(join(cwd, src))))
    .sort();
}

// Escaped so a file name can't break out of the workflow command.
function annotation(src) {
  const file = src.replace(/[%\r\n:,]/g, (char) => ESCAPES[char]);
  return `::error file=${file},line=1::Missing ${LICENSE}`;
}

function writeSummary(path, result, failures) {
  const list = failures.map((src) => `- \`${src}\`\n`).join("");
  appendFileSync(path, `### SPDX check\n\n${result}\n\n${list}`);
}

function main() {
  const cwd = process.cwd();
  // TODO: reject an empty include; git ls-files with no pathspec lists every file.
  const include = patterns(process.env.INPUT_INCLUDE);
  const exclude = patterns(process.env.INPUT_EXCLUDE);
  const files = listFiles({ include, exclude, cwd });
  const failures = findFailures(files, cwd);
  const result = `Checked ${files.length} files, ${failures.length} missing ${LICENSE}`;
  failures.forEach((src) => console.log(annotation(src)));
  console.log(result);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) writeSummary(summary, result, failures);
  if (failures.length > 0) process.exitCode = 1;
}

main();
