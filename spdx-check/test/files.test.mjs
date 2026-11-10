// SPDX-License-Identifier: Apache-2.0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { headerSource, listFiles } from '../files.mjs';
import { makeRepo, writeFiles } from './repo.mjs';

// Listing only looks at paths, so every file can be empty.
function repo(paths) {
  return makeRepo(Object.fromEntries(paths.map((path) => [path, ''])));
}

function sorted(list) {
  return [...list].sort();
}

test('*.py matches at root and at depth', () => {
  const cwd = repo(['a.py', 'pkg/b.py', 'pkg/sub/c.py', 'README.md']);
  const files = listFiles({ include: ['*.py'], cwd });
  assert.deepEqual(sorted(files), ['a.py', 'pkg/b.py', 'pkg/sub/c.py']);
});

test('Dockerfile* matches root-level files only', () => {
  const cwd = repo(['Dockerfile', 'Dockerfile.dev', 'deploy/Dockerfile']);
  const files = listFiles({ include: ['Dockerfile*'], cwd });
  assert.deepEqual(sorted(files), ['Dockerfile', 'Dockerfile.dev']);
});

test('*/Dockerfile* matches nested files only', () => {
  const cwd = repo(['Dockerfile', 'deploy/Dockerfile', 'deploy/Dockerfile.prod']);
  const files = listFiles({ include: ['*/Dockerfile*'], cwd });
  assert.deepEqual(sorted(files), ['deploy/Dockerfile', 'deploy/Dockerfile.prod']);
});

test('scripts/bin/* matches an extensionless file', () => {
  const cwd = repo(['scripts/bin/run', 'scripts/other']);
  const files = listFiles({ include: ['scripts/bin/*'], cwd });
  assert.deepEqual(files, ['scripts/bin/run']);
});

test('excludes remove matching files', () => {
  const cwd = repo(['a.py', 'third_party/x.py', 'proto/m_pb2.py']);
  const files = listFiles({
    include: ['*.py'],
    exclude: ['third_party/*', '*_pb2.py'],
    cwd,
  });
  assert.deepEqual(files, ['a.py']);
});

test('exclude patterns keep their own pathspec magic', () => {
  const cwd = repo(['src/z.go', 'vendor/y.go', 'vendor/a/x.go']);
  const files = listFiles({ include: ['*.go'], exclude: [':(glob)vendor/**'], cwd });
  assert.deepEqual(files, ['src/z.go']);
});

test('untracked files are ignored', () => {
  const cwd = repo(['a.py']);
  writeFiles(cwd, { 'b.py': '' });
  assert.deepEqual(listFiles({ include: ['*.py'], cwd }), ['a.py']);
});

test('multiple include patterns combine', () => {
  const cwd = repo(['a.py', 'b.mjs', 'c.md']);
  const files = listFiles({ include: ['*.py', '*.mjs'], cwd });
  assert.deepEqual(sorted(files), ['a.py', 'b.mjs']);
});

test('headerSource returns the sidecar when it exists', () => {
  const cwd = repo(['x.json', 'x.json.license']);
  assert.equal(headerSource('x.json', cwd), 'x.json.license');
});

test('headerSource returns the path when there is no sidecar', () => {
  const cwd = repo(['y.json']);
  assert.equal(headerSource('y.json', cwd), 'y.json');
});

test('headerSource works for nested paths', () => {
  const cwd = repo(['conf/x.json', 'conf/x.json.license']);
  assert.equal(headerSource('conf/x.json', cwd), 'conf/x.json.license');
});
