import fs from 'node:fs';
import path from 'node:path';
import { runTraced, timeStartup } from './trace.js';
import { buildTree, sortedChildren, descendantFiles } from './attribute.js';
import { matchHints } from './hints.js';
import { summarize } from './stats.js';
import { shellVersion } from './shells.js';
import { whatIf } from './ablate.js';

const MIN_ROW_MS = 1;

function sourceLine(file, line, cwd, fallback) {
  try {
    const p = path.resolve(cwd, file);
    if (line > 0 && fs.statSync(p).isFile()) {
      const text = fs.readFileSync(p, 'utf8').split('\n')[line - 1];
      if (text && text.trim()) return text.trim();
    }
  } catch {
    // not a readable file (function frame, eval, ...): use the traced command
  }
  return fallback;
}

// Files you cannot edit (macOS path_helper, distro profiles) get no advice.
const isSystemFile = (f) => f.startsWith('/etc/') || f.startsWith('/usr/');

function drill(n, cwd, depth = 0) {
  if (depth >= 3) return [];
  const [top] = sortedChildren(n);
  if (!top || top.incl < n.incl * 0.25 || top.incl < 5) return [];
  return [
    {
      file: top.file,
      line: top.line,
      text: sourceLine(top.file, top.line, cwd, top.cmd),
      inclMs: top.incl,
    },
    ...drill(top, cwd, depth + 1),
  ];
}

function describe(n, total, cwd) {
  const text = sourceLine(n.file, n.line, cwd, n.cmd);
  const haystack = [n.cmd, text, ...descendantFiles(n)].join(' ');
  return {
    file: n.file,
    line: n.line,
    text,
    inclMs: n.incl,
    selfMs: n.self,
    pct: total > 0 ? (n.incl / total) * 100 : 0,
    count: n.count,
    hints: (isSystemFile(n.file) ? [] : matchHints(haystack)).map(({ id, title, advice, snippet }) => ({ id, title, advice, snippet })),
    inside: drill(n, cwd),
  };
}

/**
 * Profile shell startup: untraced wall-clock timing, one traced run for
 * per-line attribution, and (optionally) measured what-if savings.
 */
export function profile({
  shell,
  mode,
  runs = 5,
  top = 8,
  env = process.env,
  cwd = process.cwd(),
  rcDir,
  withWhatIf = false,
  rounds = 5,
  onProgress = () => {},
}) {
  const version = shellVersion(shell.name);
  if (!version) throw new Error(`${shell.name} was not found on PATH`);
  if (shell.name === 'bash' && version.major < 5) {
    throw new Error(
      `per-line timing needs bash 5+ for $EPOCHREALTIME (found ${version.text}). ` +
        'macOS ships bash 3.2; install a newer one (brew install bash) or use zsh.',
    );
  }

  timeStartup(shell, { mode, env, cwd }); // warm-up: fills OS caches
  const samples = [];
  for (let i = 0; i < runs; i++) samples.push(timeStartup(shell, { mode, env, cwd }));
  const startup = summarize(samples);

  const traced = runTraced(shell, { mode, env, cwd });
  if (traced.entries.length === 0) {
    throw new Error(
      'the trace was empty. Your startup files may override PS4 or disable xtrace. ' +
        (env.SLOWRC_DEBUG ? `\n--- raw stderr (first 20 lines) ---\n${traced.stderr.split('\n').slice(0, 20).join('\n')}` : 'Try again with SLOWRC_DEBUG=1 to see the raw output.'),
    );
  }
  const { root, total, byFile } = buildTree(traced.entries, shell);

  const rows = sortedChildren(root)
    .filter((n) => n.incl >= MIN_ROW_MS)
    .slice(0, top)
    .map((n) => describe(n, total, cwd));

  const files = [...byFile.entries()]
    .map(([file, selfMs]) => ({ file, selfMs }))
    .sort((a, b) => b.selfMs - a.selfMs)
    .slice(0, 5);

  const report = {
    shell: shell.name,
    shellVersion: version.text,
    mode,
    startup,
    traced: {
      totalMs: total,
      wallMs: traced.wallMs,
      overhead: startup.median > 0 ? traced.wallMs / startup.median : null,
      entries: traced.entries.length,
    },
    top: rows,
    files,
    whatIf: null,
  };

  if (withWhatIf) {
    const candidates = sortedChildren(root)
      .filter((n) => n.incl >= 3 && !isSystemFile(n.file))
      .slice(0, Math.max(top, 6))
      .map((n) => ({ file: n.file, line: n.line, text: sourceLine(n.file, n.line, cwd, n.cmd) }));
    const result = whatIf(shell, { mode, env, cwd, rcDir, candidates, rounds, onProgress });
    const text = new Map(candidates.map((c) => [`${c.file}:${c.line}`, c.text]));
    for (const r of result.results) r.text = text.get(`${r.file}:${r.line}`);
    for (const s of result.skipped) s.text = text.get(`${s.file}:${s.line}`) ?? s.text;
    report.whatIf = result;
  }
  return report;
}
