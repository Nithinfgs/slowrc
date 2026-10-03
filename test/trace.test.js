import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTrace } from '../src/trace.js';

test('parses zsh entries and sorts interleaved subshell output by timestamp', () => {
  const raw = [
    'some noise before the first marker',
    '@@SLOWRC@@100.500000||/home/u/.zshrc|3| export FOO=1',
    '@@SLOWRC@@100.700000||/home/u/.zshrc|4| [[@@SLOWRC@@100.600000||/home/u/.zshrc|4| locale',
    ' US-ASCII == UTF-8 ]]',
    '',
  ].join('\n');
  const e = parseTrace(raw);
  assert.equal(e.length, 3);
  assert.deepEqual(e.map((x) => x.t), [100.5, 100.6, 100.7]);
  assert.equal(e[0].file, '/home/u/.zshrc');
  assert.equal(e[0].line, 3);
  assert.equal(e[0].cmd, 'export FOO=1');
  assert.equal(e[0].depth, null);
});

test('parses bash entries with explicit depth and comma decimals', () => {
  const e = parseTrace('@@SLOWRC@@1791004270,123456|2|/home/u/.bashrc|10| source x\n');
  assert.equal(e[0].depth, 2);
  assert.ok(Math.abs(e[0].t - 1791004270.123456) < 1e-6);
});

test('keeps only the first line of a multi-line command', () => {
  const e = parseTrace('@@SLOWRC@@1.0||f|1| echo a\nb\nc\n');
  assert.equal(e[0].cmd, 'echo a');
});

test('ignores malformed markers', () => {
  assert.deepEqual(parseTrace('@@SLOWRC@@garbage'), []);
});
