// SPDX-License-Identifier: Apache-2.0

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const INDEX = fileURLToPath(new URL('../index.mjs', import.meta.url));
const HEADER = '# SPDX-License-Identifier: Apache-2.0\n';

const tempDirs = [];
after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'spdx-index-'));
  tempDirs.push(dir);
  return dir;
}

function makeRepo(files) {
  const root = tempDir();
  execFileSync('git', ['init', '-q'], { cwd: root });
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, ...path.split('/'));
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  execFileSync('git', ['add', '-A'], { cwd: root });
  return root;
}

// Under GitHub Actions the parent env carries the real job's INPUT_* and
// GITHUB_* (step summary, outputs); the child must never see them.
function childEnv(vars) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    const upper = key.toUpperCase();
    if (upper.startsWith('INPUT_') || upper.startsWith('GITHUB_')) continue;
    env[key] = value;
  }
  return { ...env, ...vars };
}

function run(cwd, vars) {
  const result = spawnSync(process.execPath, [INDEX], {
    cwd,
    env: childEnv(vars),
    encoding: 'utf8',
  });
  const lines = result.stdout.split(/\r?\n/);
  const errors = lines.filter((l) => l.startsWith('::error'));
  return { status: result.status, lines, errors, stderr: result.stderr };
}

function annotation(path) {
  return `::error file=${path},line=1::Missing SPDX-License-Identifier: Apache-2.0`;
}

test('all files with headers pass', () => {
  const cwd = makeRepo({ 'a.py': `${HEADER}print(1)\n`, 'pkg/b.py': HEADER });
  const { status, errors, stderr } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, []);
  assert.equal(status, 0, stderr);
});

test('failures are annotated in sorted order', () => {
  const cwd = makeRepo({ 'z.py': 'x\n', 'a.py': 'x\n', 'm/b.py': 'x\n', 'ok.py': HEADER });
  const { status, errors } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, [annotation('a.py'), annotation('m/b.py'), annotation('z.py')]);
  assert.equal(status, 1);
});

// git lists x.json before x.json.d/y.py, but x.json is reported as
// x.json.license, which sorts after x.json.d/y.py.
test('sidecar paths are sorted by their reported name', () => {
  const cwd = makeRepo({
    'x.json': '{}\n',
    'x.json.license': 'nothing\n',
    'x.json.d/y.py': 'x\n',
  });
  const { errors } = run(cwd, { INPUT_INCLUDE: '*.json *.py' });
  assert.deepEqual(errors, [annotation('x.json.d/y.py'), annotation('x.json.license')]);
});

test('sidecar with header makes the file pass', () => {
  const cwd = makeRepo({ 'cfg.json': '{}\n', 'cfg.json.license': HEADER });
  const { status, errors, stderr } = run(cwd, { INPUT_INCLUDE: '*.json' });
  assert.deepEqual(errors, []);
  assert.equal(status, 0, stderr);
});

test('sidecar without header is annotated by its own path', () => {
  const cwd = makeRepo({ 'cfg.json': '{}\n', 'cfg.json.license': 'nothing\n' });
  const { status, errors } = run(cwd, { INPUT_INCLUDE: '*.json' });
  assert.deepEqual(errors, [annotation('cfg.json.license')]);
  assert.equal(status, 1);
});

test('newline-separated include patterns all apply', () => {
  const cwd = makeRepo({ 'a.py': 'x\n', 'b.sh': 'x\n', 'c.md': 'x\n' });
  const { errors } = run(cwd, { INPUT_INCLUDE: '  *.py\n  *.sh\n' });
  assert.deepEqual(errors, [annotation('a.py'), annotation('b.sh')]);
});

test('exclude patterns are honoured', () => {
  const cwd = makeRepo({ 'a.py': HEADER, 'third_party/x.py': 'x\n', 'm_pb2.py': 'x\n' });
  const { status, errors, stderr } = run(cwd, {
    INPUT_INCLUDE: '*.py',
    INPUT_EXCLUDE: 'third_party/*\n*_pb2.py\n',
  });
  assert.deepEqual(errors, []);
  assert.equal(status, 0, stderr);
});

test('annotation file property is escaped', () => {
  const cwd = makeRepo({ 'a,b%.py': 'x\n' });
  const { errors } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, [annotation('a%2Cb%25.py')]);
});

// Windows forbids newlines and colons in filenames.
test('a filename cannot inject a workflow command', { skip: process.platform === 'win32' }, () => {
  const cwd = makeRepo({ 'x\n::add-mask::DUMMY\n.py': 'x\n' });
  const { lines, errors } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, [annotation('x%0A%3A%3Aadd-mask%3A%3ADUMMY%0A.py')]);
  assert.ok(!lines.some((l) => l.startsWith('::add-mask')), lines.join('\n'));
});

test('a long first line does not hide a header on line 2', () => {
  const cwd = makeRepo({ 'a.py': `#${'x'.repeat(10000)}\n${HEADER}` });
  const { status, errors, stderr } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, []);
  assert.equal(status, 0, stderr);
});

// Line 1 is 8155 bytes, so "Apache-2.0" on line 2 ends exactly at byte 8192.
test('a license expression cut at 8 KiB is not accepted', () => {
  const line1 = `#${'x'.repeat(8153)}\n`;
  const cwd = makeRepo({ 'a.py': `${line1}# SPDX-License-Identifier: Apache-2.0 OR MIT\n` });
  const { status, errors } = run(cwd, { INPUT_INCLUDE: '*.py' });
  assert.deepEqual(errors, [annotation('a.py')]);
  assert.equal(status, 1);
});

test('step summary is appended with failing paths', () => {
  const cwd = makeRepo({ 'a.py': 'x\n', 'm/b.py': 'x\n' });
  const summary = join(tempDir(), 'summary.md');
  writeFileSync(summary, 'existing\n');
  const { status } = run(cwd, { INPUT_INCLUDE: '*.py', GITHUB_STEP_SUMMARY: summary });
  const text = readFileSync(summary, 'utf8');
  assert.ok(text.startsWith('existing\n'), text);
  assert.ok(text.includes('a.py'), text);
  assert.ok(text.includes('m/b.py'), text);
  assert.equal(status, 1);
});
