// SPDX-License-Identifier: Apache-2.0

// Rejects suffixes (-only, +) and compound expressions (OR/AND/WITH).
const SPDX =
  /SPDX-License-Identifier:[ \t]*Apache-2\.0(?![A-Za-z0-9.+-]|[ \t]+(?:OR|AND|WITH)\b)/;

export function hasSpdxHeader(buf) {
  // An empty file has no content to license.
  if (buf.length === 0) return true;
  // latin1 maps every byte to a char, so binary or non-UTF-8 input never throws.
  const lines = buf.toString("latin1").split("\n", 10);
  return lines.some((line) => SPDX.test(line));
}
