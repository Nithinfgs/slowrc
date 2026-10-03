import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, sortedChildren } from '../src/attribute.js';
import { SHELLS } from '../src/shells.js';

const e = (t, file, line, cmd = '') => ({ t, file, line, cmd, depth: null });

test('zsh: a sourced file is charged to the line that sourced it', () => {
  const entries = [
    e(0.0, '/h/.zshrc', 1, 'export A=1'),
    e(0.1, '/h/.zshrc', 2, 'source nvm.sh'),
    e(0.1001, '/h/nvm.sh', 1, 'sleep'),
    e(0.3, '/h/nvm.sh', 2, 'foo'),
    e(0.4, '/h/.zshrc', 3, 'alias x=y'),
    e(0.45, 'zsh', 1, 'exit'),
  ];
  const { root, total } = buildTree(entries, SHELLS.zsh);
  assert.ok(Math.abs(total - 450) < 1e-6);
  const [top] = sortedChildren(root);
  assert.equal(top.line, 2);
  assert.ok(Math.abs(top.incl - 300) < 1e-6);
  const [child] = sortedChildren(top);
  assert.equal(child.file, '/h/nvm.sh');
  assert.ok(Math.abs(child.incl - 199.9) < 1e-6);
});

test('zsh: functions push and pop, and later startup files reset the stack', () => {
  const entries = [
    e(0.0, '/h/.zprofile', 1, 'a'),
    e(0.1, '/h/.zshrc', 1, 'b'),
    e(0.2, '/h/.zshrc', 2, 'f'),
    e(0.2, 'f', 0, 'sleep'),
    e(0.5, '/h/.zshrc', 3, 'c'),
    e(0.6, 'zsh', 1, 'exit'),
  ];
  const { root } = buildTree(entries, SHELLS.zsh);
  const kids = sortedChildren(root);
  // .zprofile:1, .zshrc:1..3 and the exit line are all top level
  assert.equal(kids.length, 5);
  const call = kids.find((n) => n.file === '/h/.zshrc' && n.line === 2);
  assert.ok(Math.abs(call.incl - 300) < 1e-6);
  assert.equal(sortedChildren(call)[0].file, 'f');
});

test('bash: explicit depth drives nesting; the -c string (depth 0) is a sibling of top-level files', () => {
  const b = (t, depth, file, line) => ({ t, depth, file, line, cmd: '' });
  const entries = [
    b(0.0, 1, '/h/.bash_profile', 1),
    b(0.1, 1, '/h/.bash_profile', 2),
    b(0.1, 2, '/h/.bashrc', 1),
    b(0.4, 2, '/h/.bashrc', 2),
    b(0.5, 1, '/h/.bash_profile', 3),
    b(0.5, 1, '/h/.bash_profile', 4),
    b(0.6, 0, '', 1),
  ];
  const { root } = buildTree(entries, SHELLS.bash);
  const src = sortedChildren(root).find((n) => n.line === 2);
  assert.ok(Math.abs(src.incl - 400) < 1e-6);
  assert.equal(sortedChildren(src).length, 2);
  assert.equal(src.file, '/h/.bash_profile');
});

test('empty trace yields an empty tree', () => {
  const { root, total } = buildTree([], SHELLS.zsh);
  assert.equal(total, 0);
  assert.equal(root.children.size, 0);
});
