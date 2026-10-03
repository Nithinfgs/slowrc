const CODES = { bold: 1, dim: 2, red: 31, green: 32, yellow: 33, cyan: 36, gray: 90 };

export function painter(enabled) {
  const paint = (code, s) => (enabled ? `\x1b[${code}m${s}\x1b[0m` : String(s));
  const out = {};
  for (const [name, code] of Object.entries(CODES)) out[name] = (s) => paint(code, s);
  return out;
}

export function makeShortener(pairs) {
  const sorted = [...pairs].filter(([from]) => from).sort((a, b) => b[0].length - a[0].length);
  return (p) => {
    for (const [from, to] of sorted) {
      if (p === from) return to;
      if (p.startsWith(from + '/')) return to + p.slice(from.length);
    }
    return p;
  };
}

function bar(fraction, width, c) {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return c.red('█'.repeat(filled)) + c.gray('░'.repeat(width - filled));
}

function clip(s, n) {
  s = s.replace(/\s+/g, ' ');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

const ms = (x) => `${Math.round(x)} ms`.padStart(8);

function where(file, line, short) {
  return line > 0 ? `${short(file)}:${line}` : short(file);
}

/**
 * Render a report for the terminal.
 * @param {object} report from profile()
 * @param {{color: boolean, short: (p: string) => string, showSource: boolean, snippets: boolean, version: string}} o
 */
export function renderText(report, o) {
  const c = painter(o.color);
  const lines = [];
  const { startup, traced } = report;

  lines.push(
    `${c.bold('slowrc')} ${c.dim(o.version)}  ${report.shell} ${report.shellVersion} · ${report.mode === 'login' ? 'login, interactive' : 'interactive'} · ${startup.runs} runs`,
  );
  lines.push('');
  lines.push(
    `startup  ${c.bold(`${Math.round(startup.median)} ms`)} median   ${c.dim(
      `min ${Math.round(startup.min)}  max ${Math.round(startup.max)}`,
    )}`,
  );
  lines.push('');
  lines.push(c.bold('where the time goes') + c.dim('  (xtrace estimate; --whatif measures)'));

  const label = (r) => `${where(r.file, r.line, o.short)}${o.showSource ? `  ${clip(r.text, 46)}` : ''}`;
  if (report.top.length === 0) lines.push(c.dim('  nothing above 1 ms. Your startup is already lean.'));
  for (const r of report.top) {
    lines.push(
      `  ${bar(r.pct / 100, 14, c)} ${String(Math.round(r.pct)).padStart(3)}% ${ms(r.inclMs)}  ${label(r)}`,
    );
    for (const ch of r.inside) {
      lines.push(
        `  ${c.dim(' '.repeat(14))}      ${c.dim(`${ms(ch.inclMs)}  └ ${where(ch.file, ch.line, o.short)}${o.showSource ? `  ${clip(ch.text, 30)}` : ''}`)}`,
      );
    }
    for (const h of r.hints) {
      lines.push(`  ${' '.repeat(14)}       ${c.yellow('↳ fix:')} ${h.advice}`);
      if (o.snippets) {
        for (const sl of h.snippet.split('\n')) lines.push(`  ${' '.repeat(14)}         ${c.cyan(sl)}`);
      }
    }
  }

  if (report.files.length) {
    lines.push('');
    lines.push(c.bold('time spent inside each file') + c.dim('  (own commands only)'));
    for (const f of report.files) lines.push(`  ${ms(f.selfMs)}  ${o.short(f.file)}`);
  }

  if (report.whatIf) {
    const w = report.whatIf;
    lines.push('');
    lines.push(
      c.bold('what-if: switch one line off, re-measure') +
        c.dim(`  (${w.rounds} interleaved rounds, baseline ${Math.round(w.baselineMs)} ms, noise ±${Math.round(w.noiseMs)} ms)`),
    );
    for (const r of w.results) {
      const saved = r.significant
        ? c.green(`saves ${String(Math.round(r.savedMs)).padStart(4)} ms ${`(−${Math.round(r.pct)}%)`.padEnd(7)}`)
        : c.dim(`within noise${' '.repeat(10)}`);
      lines.push(`  ${saved} ${label(r)}`);
    }
    for (const s of w.skipped) {
      lines.push(`  ${c.dim(`skipped${' '.repeat(15)} ${where(s.file, s.line, o.short)}  (${s.reason})`)}`);
    }
    lines.push(c.dim('  Your dotfiles were not modified; this ran on a temporary copy.'));
  } else if (report.top.length) {
    lines.push('');
    lines.push(c.dim('Run again with --whatif to measure what removing each line would really save.'));
  }
  return lines.join('\n') + '\n';
}

export function toJSON(report, { short, showSource }) {
  const rowOut = (r) => ({
    file: short(r.file),
    line: r.line,
    ...(showSource ? { text: r.text } : {}),
    inclMs: round(r.inclMs),
    selfMs: round(r.selfMs),
    pct: round(r.pct),
    count: r.count,
    hints: r.hints.map((h) => h.id),
    inside: r.inside.map((i) => ({
      file: short(i.file),
      line: i.line,
      ...(showSource ? { text: i.text } : {}),
      inclMs: round(i.inclMs),
    })),
  });
  return {
    shell: report.shell,
    shellVersion: report.shellVersion,
    mode: report.mode,
    startup: {
      runs: report.startup.runs,
      medianMs: round(report.startup.median),
      minMs: round(report.startup.min),
      maxMs: round(report.startup.max),
    },
    traced: {
      totalMs: round(report.traced.totalMs),
      overheadFactor: report.traced.overhead ? round(report.traced.overhead) : null,
      entries: report.traced.entries,
    },
    top: report.top.map(rowOut),
    files: report.files.map((f) => ({ file: short(f.file), selfMs: round(f.selfMs) })),
    whatIf: report.whatIf && {
      baselineMs: round(report.whatIf.baselineMs),
      noiseMs: round(report.whatIf.noiseMs),
      rounds: report.whatIf.rounds,
      results: report.whatIf.results.map((r) => ({
        file: short(r.file),
        line: r.line,
        ...(showSource ? { text: r.text } : {}),
        savedMs: round(r.savedMs),
        pct: round(r.pct),
        significant: r.significant,
      })),
      skipped: report.whatIf.skipped.map((s) => ({ file: short(s.file), line: s.line, reason: s.reason })),
    },
  };
}

function round(x) {
  return Math.round(x * 10) / 10;
}
