// SPDX-License-Identifier: Apache-2.0

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hasSpdxHeader } from '../header.mjs';

const ID = 'SPDX-License-Identifier: Apache-2.0';

function check(text) {
  return hasSpdxHeader(Buffer.from(text));
}

function filler(n) {
  return 'x\n'.repeat(n);
}

test('empty buffer passes', () => {
  assert.equal(hasSpdxHeader(Buffer.alloc(0)), true);
});

test('hash comment passes', () => {
  assert.equal(check(`# ${ID}\nprint("hi")\n`), true);
});

test('double-slash comment passes', () => {
  assert.equal(check(`// ${ID}\nconsole.log(1);\n`), true);
});

test('multi-line block comment passes', () => {
  assert.equal(check(`/*\n * Copyright Foo\n * ${ID}\n */\nint x;\n`), true);
});

test('single-line block comment passes', () => {
  assert.equal(check(`/* ${ID} */\nint x;\n`), true);
});

test('html comment passes', () => {
  assert.equal(check(`<!-- ${ID} -->\n<p>hi</p>\n`), true);
});

test('shebang then header passes', () => {
  assert.equal(check(`#!/usr/bin/env python3\n# ${ID}\n`), true);
});

test('header on line 10 passes', () => {
  assert.equal(check(`${filler(9)}# ${ID}\n`), true);
});

test('header on line 11 fails', () => {
  assert.equal(check(`${filler(10)}# ${ID}\n`), false);
});

test('CRLF file passes', () => {
  assert.equal(check(`#!/bin/sh\r\n# ${ID}\r\necho hi\r\n`), true);
});

test('file without header fails', () => {
  assert.equal(check('print("hi")\n'), false);
});

test('MIT fails', () => {
  assert.equal(check('# SPDX-License-Identifier: MIT\n'), false);
});

test('Apache-2.0-only is rejected', () => {
  assert.equal(check(`# ${ID}-only\n`), false);
});

test('Apache-2.0 OR MIT is rejected', () => {
  assert.equal(check(`# ${ID} OR MIT\n`), false);
});

test('Apache-2.0 AND MIT is rejected', () => {
  assert.equal(check(`# ${ID} AND MIT\n`), false);
});

test('Apache-2.0 WITH an exception is rejected', () => {
  assert.equal(check(`# ${ID} WITH LLVM-exception\n`), false);
});

test('UTF-16 BOM bytes before header still pass', () => {
  const buf = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(`# ${ID}\n`)]);
  assert.equal(hasSpdxHeader(buf), true);
});

test('Latin-1 byte before header still passes', () => {
  const buf = Buffer.concat([
    Buffer.from('# Caf'),
    Buffer.from([0xe9]),
    Buffer.from(`\n# ${ID}\n`),
  ]);
  assert.equal(hasSpdxHeader(buf), true);
});

test('NUL bytes around header still pass', () => {
  const buf = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x0a]),
    Buffer.from(`# ${ID}\n`),
    Buffer.from([0x00, 0xff]),
  ]);
  assert.equal(hasSpdxHeader(buf), true);
});
