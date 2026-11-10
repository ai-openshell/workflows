// SPDX-License-Identifier: Apache-2.0

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { headerSource, listFiles } from '../files.mjs';

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function writeFiles(root, paths) {
  for (const path of paths) {
    const full = join(root, ...path.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, '');
  }
}

function makeRepo(paths) {
  const root = mkdtempSync(join(tmpdir(), 'spdx-files-'));
  tempDirs.push(root);
  execFileSync('git', ['init', '-q'], { cwd: root });
  writeFiles(root, paths);
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

function sorted(list) {
  return [...list].sort();
}

test('*.py matches at root and at depth', () => {
  const cwd = makeRepo(['a.py', 'pkg/b.py', 'pkg/sub/c.py', 'README.md']);
  const files = listFiles({ include: ['*.py'], cwd });
  assert.deepEqual(sorted(files), ['a.py', 'pkg/b.py', 'pkg/sub/c.py']);
});

test('Dockerfile* matches root-level files only', () => {
  const cwd = makeRepo(['Dockerfile', 'Dockerfile.dev', 'deploy/Dockerfile']);
  const files = listFiles({ include: ['Dockerfile*'], cwd });
  assert.deepEqual(sorted(files), ['Dockerfile', 'Dockerfile.dev']);
});

test('*/Dockerfile* matches nested files only', () => {
  const cwd = makeRepo(['Dockerfile', 'deploy/Dockerfile', 'deploy/Dockerfile.prod']);
  const files = listFiles({ include: ['*/Dockerfile*'], cwd });
  assert.deepEqual(sorted(files), ['deploy/Dockerfile', 'deploy/Dockerfile.prod']);
});

test('scripts/bin/* matches an extensionless file', () => {
  const cwd = makeRepo(['scripts/bin/run', 'scripts/other']);
  const files = listFiles({ include: ['scripts/bin/*'], cwd });
  assert.deepEqual(files, ['scripts/bin/run']);
});

test('excludes remove matching files', () => {
  const cwd = makeRepo(['a.py', 'third_party/x.py', 'proto/m_pb2.py']);
  const files = listFiles({
    include: ['*.py'],
    exclude: ['third_party/*', '*_pb2.py'],
    cwd,
  });
  assert.deepEqual(files, ['a.py']);
});

test('untracked files are ignored', () => {
  const cwd = makeRepo(['a.py']);
  writeFiles(cwd, ['b.py']);
  assert.deepEqual(listFiles({ include: ['*.py'], cwd }), ['a.py']);
});

test('multiple include patterns combine', () => {
  const cwd = makeRepo(['a.py', 'b.mjs', 'c.md']);
  const files = listFiles({ include: ['*.py', '*.mjs'], cwd });
  assert.deepEqual(sorted(files), ['a.py', 'b.mjs']);
});

test('headerSource returns the sidecar when it exists', () => {
  const cwd = makeRepo(['x.json', 'x.json.license']);
  assert.equal(headerSource('x.json', cwd), 'x.json.license');
});

test('headerSource returns the path when there is no sidecar', () => {
  const cwd = makeRepo(['y.json']);
  assert.equal(headerSource('y.json', cwd), 'y.json');
});

test('headerSource works for nested paths', () => {
  const cwd = makeRepo(['conf/x.json', 'conf/x.json.license']);
  assert.equal(headerSource('conf/x.json', cwd), 'conf/x.json.license');
});
