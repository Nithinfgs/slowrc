import { spawnSync } from 'node:child_process';
import { MARK } from './shells.js';

const ENTRY = /^(\d+(?:[.,]\d+)?)\|(\d*)\|([\s\S]*?)\|(\d*)\| ?([\s\S]*)$/;

/**
 * Parse raw xtrace output into ordered entries.
 * Command substitutions write to the same stream as their parent, so lines can
 * interleave and arrive slightly out of order; entries are sorted by timestamp.
 */
export function parseTrace(text) {
  const entries = [];
  const parts = text.split(MARK);
  for (let i = 1; i < parts.length; i++) {
    const m = ENTRY.exec(parts[i]);
    if (!m) continue;
    const cmd = m[5].split('\n')[0].trim();
    entries.push({
      t: Number(m[1].replace(',', '.')),
      depth: m[2] === '' ? null : Number(m[2]),
      file: m[3],
      line: Number(m[4] || 0),
      cmd,
      seq: entries.length,
    });
  }
  entries.sort((a, b) => a.t - b.t || a.seq - b.seq);
  return entries;
}

export function runTraced(shell, { mode, env, cwd }) {
  const started = process.hrtime.bigint();
  const r = spawnSync(shell.name, shell.traceArgs(mode), {
    env: { ...env, PS4: shell.ps4 },
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'ignore', 'pipe'],
    maxBuffer: 512 * 1024 * 1024,
    timeout: 120_000,
  });
  const wallMs = Number(process.hrtime.bigint() - started) / 1e6;
  if (r.error) throw new Error(`could not run ${shell.name}: ${r.error.message}`);
  return { entries: parseTrace(r.stderr || ''), wallMs, stderr: r.stderr || '' };
}

/** Wall-clock time of an untraced startup, in ms. */
export function timeStartup(shell, { mode, env, cwd }) {
  const started = process.hrtime.bigint();
  const r = spawnSync(shell.name, shell.plainArgs(mode), {
    env,
    cwd,
    stdio: ['ignore', 'ignore', 'ignore'],
    timeout: 120_000,
  });
  if (r.error) throw new Error(`could not run ${shell.name}: ${r.error.message}`);
  return Number(process.hrtime.bigint() - started) / 1e6;
}
