import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { timeStartup } from './trace.js';
import { median, mad } from './stats.js';

export const ABLATED = ': slowrc-ablated';

/** Replace one 1-based line with a no-op, keeping line numbers stable. */
export function replaceLine(text, line) {
  const lines = text.split('\n');
  if (line < 1 || line > lines.length) return null;
  const indent = /^\s*/.exec(lines[line - 1])[0];
  lines[line - 1] = indent + ABLATED;
  return lines.join('\n');
}

function syntaxOk(shellName, file) {
  return spawnSync(shellName, ['-n', file], { stdio: 'ignore' }).status === 0;
}

function real(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

/**
 * Measure what each candidate line really costs by running startup with that
 * one line turned into a no-op. Runs against a throwaway copy of the startup
 * files (via ZDOTDIR), so your real dotfiles are never touched. Baseline and
 * variants are timed in interleaved rounds so slow drift hits them equally.
 *
 * Only zsh is supported: ZDOTDIR is what makes the copy possible.
 */
export function whatIf(shell, { mode, env, cwd, rcDir, candidates, rounds = 5, onProgress = () => {} }) {
  if (shell.name !== 'zsh') {
    throw new Error('--whatif currently supports zsh only (it relies on ZDOTDIR)');
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slowrc-'));
  try {
    const sources = new Map(); // real path -> basename in the copy
    for (const name of shell.rootFiles) {
      const src = path.join(rcDir, name);
      const rp = real(src);
      if (rp) {
        sources.set(rp, name);
        fs.writeFileSync(path.join(tmp, name), fs.readFileSync(rp));
      }
    }

    const variants = [{ label: 'baseline', dir: tmp, samples: [] }];
    const skipped = [];
    for (const c of candidates) {
      const name = sources.get(real(c.file));
      if (!name) {
        skipped.push({ ...c, reason: 'not in a copyable startup file' });
        continue;
      }
      const vdir = fs.mkdtempSync(path.join(tmp, 'v-'));
      for (const n of sources.values()) fs.copyFileSync(path.join(tmp, n), path.join(vdir, n));
      const target = path.join(vdir, name);
      const changed = replaceLine(fs.readFileSync(target, 'utf8'), c.line);
      if (changed === null) {
        skipped.push({ ...c, reason: 'line out of range' });
        continue;
      }
      fs.writeFileSync(target, changed);
      if (!syntaxOk(shell.name, target)) {
        skipped.push({ ...c, reason: 'removing this line alone breaks the file (part of a block)' });
        continue;
      }
      variants.push({ label: `${c.file}:${c.line}`, dir: vdir, candidate: c, samples: [] });
    }

    // One warm-up pass so caches (compdump, disk) are in the same state for everyone.
    for (const v of variants) timeStartup(shell, { mode, env: { ...env, ZDOTDIR: v.dir }, cwd });

    for (let r = 0; r < rounds; r++) {
      for (const v of variants) {
        v.samples.push(timeStartup(shell, { mode, env: { ...env, ZDOTDIR: v.dir }, cwd }));
      }
      onProgress(r + 1, rounds);
    }

    const base = variants[0];
    const baseMed = median(base.samples);
    const noise = Math.max(mad(base.samples) * 2, 5);
    const results = variants.slice(1).map((v) => {
      const saved = baseMed - median(v.samples);
      return {
        file: v.candidate.file,
        line: v.candidate.line,
        savedMs: saved,
        pct: baseMed > 0 ? (saved / baseMed) * 100 : 0,
        significant: saved > noise,
      };
    });
    results.sort((a, b) => b.savedMs - a.savedMs);
    return { baselineMs: baseMed, noiseMs: noise, rounds, results, skipped };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
