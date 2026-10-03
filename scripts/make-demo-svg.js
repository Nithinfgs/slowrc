// Renders a real `slowrc --demo --whatif` run to docs/assets/demo.svg.
// Nothing is typed by hand: re-run `npm run svg` to refresh the image.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = spawnSync(
  process.execPath,
  [path.join(root, 'bin/slowrc.js'), '--demo', '--whatif', '--top', '4', '--mode', 'interactive', '--rounds', '5'],
  { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '1', NO_COLOR: '' } },
);
if (run.status !== 0) throw new Error(run.stderr);

const PALETTE = { 1: '#e6edf3', 2: '#7d8590', 31: '#ff7b72', 32: '#56d364', 33: '#e3b341', 36: '#79c0ff', 90: '#484f58' };
const FG = '#c9d1d9';
const CW = 7.8;
const LH = 18;
const PAD = 18;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function parseLine(line) {
  const spans = [];
  let color = FG;
  let bold = false;
  let col = 0;
  for (const part of line.split(/(\x1b\[[0-9;]*m)/)) {
    const m = /^\x1b\[([0-9;]*)m$/.exec(part);
    if (m) {
      const code = Number(m[1] || 0);
      if (code === 0) (color = FG), (bold = false);
      else if (code === 1) bold = true;
      else color = PALETTE[code] || FG;
    } else if (part) {
      spans.push({ col, text: part, color, bold });
      col += [...part].length;
    }
  }
  return { spans, cols: col };
}

const lines = run.stdout.replace(/\n$/, '').split('\n').map(parseLine);
const width = Math.ceil(Math.max(...lines.map((l) => l.cols)) * CW + PAD * 2);
const height = lines.length * LH + PAD * 2 + 28;

const body = lines
  .map((l, i) => {
    const y = 28 + PAD + (i + 1) * LH - 5;
    const spans = l.spans
      .map(
        (s) =>
          `<tspan x="${(PAD + s.col * CW).toFixed(1)}" fill="${s.color}"${s.bold ? ' font-weight="700"' : ''}>${esc(s.text)}</tspan>`,
      )
      .join('');
    return `<text y="${y}" xml:space="preserve">${spans}</text>`;
  })
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Terminal output of slowrc --demo --whatif">
<rect width="${width}" height="${height}" rx="8" fill="#0d1117"/>
<rect width="${width}" height="28" rx="8" fill="#161b22"/>
<rect y="14" width="${width}" height="14" fill="#161b22"/>
<circle cx="16" cy="14" r="5" fill="#ff5f56"/><circle cx="34" cy="14" r="5" fill="#ffbd2e"/><circle cx="52" cy="14" r="5" fill="#27c93f"/>
<g font-family="SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" font-size="13">
${body}
</g>
</svg>
`;
const out = path.join(root, 'docs/assets/demo.svg');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(`wrote ${path.relative(root, out)} (${(svg.length / 1024).toFixed(1)} KB)`);
