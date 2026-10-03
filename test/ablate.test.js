import test from 'node:test';
import assert from 'node:assert/strict';
import { replaceLine, ABLATED } from '../src/ablate.js';

test('replaceLine swaps exactly one line and keeps numbering and indent', () => {
  const out = replaceLine('a\n  b\nc\n', 2);
  assert.equal(out, `a\n  ${ABLATED}\nc\n`);
});

test('replaceLine rejects out-of-range lines', () => {
  assert.equal(replaceLine('a\nb', 0), null);
  assert.equal(replaceLine('a\nb', 9), null);
});
