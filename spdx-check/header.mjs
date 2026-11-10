// SPDX-License-Identifier: Apache-2.0

const LINES = 10;
// Rejects suffixes (-only, +) and compound expressions (OR/AND/WITH).
const SPDX =
  /SPDX-License-Identifier:[ \t]*Apache-2\.0(?![A-Za-z0-9.+-]|[ \t]+(?:OR|AND|WITH)\b)/;

export function hasHeaderLines(buf) {
  let at = -1;
  for (let line = 0; line < LINES; line++) {
    at = buf.indexOf(0x0a, at + 1);
    if (at === -1) return false;
  }
  return true;
}

export function hasSpdxHeader(buf) {
  // An empty file has no content to license.
  if (buf.length === 0) return true;
  // latin1 maps every byte to a char, so binary or non-UTF-8 input never throws.
  const lines = buf.toString("latin1").split("\n", LINES);
  return lines.some((line) => SPDX.test(line));
}
