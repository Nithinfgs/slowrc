import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { main } from '../src/cli.js';

const bashMajor = Number(
  spawnSync('bash', ['-c', 'echo ${BASH_VERSINFO[0]}'], { encoding: 'utf8' }).stdout.trim() || 0,
);

test('bash 5+: attributes a slow sourced file to the line that sources it', { skip: bashMajor < 5 }, async () => {
  const home = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'slowrc-bash-'));
  const saved = process.env.HOME;
  try {
    fs.writeFileSync(path.join(home, 'slow.sh'), 'sleep 0.25\n');
    fs.writeFileSync(path.join(home, '.bashrc'), `export A=1\nsource "${home}/slow.sh"\nexport B=2\n`);
    process.env.HOME = home;
    let out = '';
    const io = { out: { write: (s) => (out += s), isTTY: false }, err: { write() {}, isTTY: false } };
    const code = await main(['--shell', 'bash', '--mode', 'interactive', '--json', '--runs', '1'], io);
    assert.equal(code, 0);
    const j = JSON.parse(out);
    const top = j.top.find((t) => t.file === '~/.bashrc');
    assert.equal(top.line, 2);
    assert.ok(top.inclMs > 200, `expected >200ms, got ${top.inclMs}`);
  } finally {
    process.env.HOME = saved;
    fs.rmSync(home, { recursive: true, force: true });
  }
});

test('bash < 5 fails with an actionable message', { skip: bashMajor === 0 || bashMajor >= 5 }, async () => {
  let err = '';
  const io = { out: { write() {}, isTTY: false }, err: { write: (s) => (err += s), isTTY: false } };
  const code = await main(['--shell', 'bash', '--runs', '1'], io);
  assert.equal(code, 2);
  assert.match(err, /bash 5/);
});
