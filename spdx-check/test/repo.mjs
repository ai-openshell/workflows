// SPDX-License-Identifier: Apache-2.0

import { after } from 'node:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const dirs = [];
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

export function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'spdx-'));
  dirs.push(dir);
  return dir;
}

// `files` maps a /-separated path to its content.
export function writeFiles(root, files) {
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, ...path.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

// Files are staged but never committed: git ls-files lists the index, and
// skipping commits avoids needing a git identity on CI.
export function makeRepo(files) {
  const root = tempDir();
  execFileSync('git', ['init', '-q'], { cwd: root });
  writeFiles(root, files);
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}
