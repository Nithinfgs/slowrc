// Zero-dependency lint: every JS file must parse, and the repo must stay free of
// tabs, trailing whitespace and stray absolute home paths.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skip = new Set(['node_modules', '.git']);
let failures = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    if (skip.has(name)) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p);
    else check(p);
  }
}

function check(file) {
  const rel = path.relative(root, file);
  if (/\.(js|mjs)$/.test(file)) {
    const r = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (r.status !== 0) fail(rel, `syntax error\n${r.stderr}`);
  }
  if (/\.(js|mjs|json|md|yml|yaml|zsh|sh)$/.test(file) || path.basename(file) === '.zshrc') {
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, i) => {
      if (/\t/.test(line)) fail(rel, `line ${i + 1}: tab character`);
      if (/[ ]+$/.test(line)) fail(rel, `line ${i + 1}: trailing whitespace`);
      if (/\/Users\/[a-z0-9_-]+\//i.test(line) && !/\/Users\/u\//.test(line)) fail(rel, `line ${i + 1}: absolute home path`);
    });
  }
}

function fail(rel, msg) {
  failures++;
  console.error(`${rel}: ${msg}`);
}

walk(root);
if (failures) {
  console.error(`lint: ${failures} problem(s)`);
  process.exit(1);
}
console.log('lint: ok');
