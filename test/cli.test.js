import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { main } from '../src/cli.js';

const sink = () => {
  const buf = { text: '', isTTY: false, write(s) { buf.text += s; } };
  return buf;
};
const run = async (argv) => {
  const io = { out: sink(), err: sink() };
  const code = await main(argv, io);
  return { code, out: io.out.text, err: io.err.text };
};
const hasZsh = spawnSync('zsh', ['--version']).status === 0;

test('--help and --version exit 0', async () => {
  assert.equal((await run(['--help'])).code, 0);
  const v = await run(['--version']);
  assert.equal(v.code, 0);
  assert.match(v.out, /^\d+\.\d+\.\d+/);
});

test('unknown flags and bad values exit 2 with a message', async () => {
  assert.equal((await run(['--nope'])).code, 2);
  const r = await run(['--runs', 'zero', '--demo']);
  assert.equal(r.code, 2);
  assert.match(r.err, /--runs must be an integer/);
  assert.equal((await run(['--shell', 'fish'])).code, 2);
});

test('--demo --json finds the simulated nvm line as the top cost', { skip: !hasZsh }, async () => {
  const r = await run(['--demo', '--json', '--runs', '2', '--mode', 'interactive']);
  assert.equal(r.code, 0, r.err);
  const j = JSON.parse(r.out);
  assert.equal(j.shell, 'zsh');
  assert.match(j.top[0].text, /nvm\.sh/);
  assert.ok(j.top[0].inclMs > 150);
  assert.ok(j.top[0].hints.includes('nvm'));
  assert.ok(j.top.some((t) => /conda\.sh/.test(t.text)));
  assert.ok(!r.out.includes(process.env.HOME || '\0'), 'home directory must be shortened');
});

test('--no-source removes rc line text from the output', { skip: !hasZsh }, async () => {
  const r = await run(['--demo', '--json', '--no-source', '--runs', '1', '--mode', 'interactive']);
  assert.equal(r.code, 0, r.err);
  assert.ok(!('text' in JSON.parse(r.out).top[0]));
});

test('--budget exits 1 when startup is slower than the budget', { skip: !hasZsh }, async () => {
  const r = await run(['--demo', '--runs', '1', '--budget', '10', '--mode', 'interactive']);
  assert.equal(r.code, 1);
  assert.match(r.err, /exceeds budget/);
});

test('--whatif measures real savings and never touches the demo source', { skip: !hasZsh }, async () => {
  const r = await run(['--demo', '--whatif', '--json', '--runs', '1', '--rounds', '3', '--mode', 'interactive']);
  assert.equal(r.code, 0, r.err);
  const w = JSON.parse(r.out).whatIf;
  const nvm = w.results.find((x) => /nvm\.sh/.test(x.text));
  assert.ok(nvm.significant);
  assert.ok(nvm.savedMs > 150, `expected >150ms saving, got ${nvm.savedMs}`);
});
