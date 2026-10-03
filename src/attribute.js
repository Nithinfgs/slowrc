import path from 'node:path';

/**
 * Assign a nesting depth to every entry.
 *  - bash reports depth itself (normalised so the shallowest entry is 0).
 *  - zsh reports only the file or function name, so depth comes from a stack:
 *    startup files (.zshrc, ...) reset it, a name already on the stack pops
 *    back to it, anything else is a nested `source` or function call.
 */
export function assignDepths(entries, shell) {
  if (entries.length && entries.every((e) => e.depth !== null)) {
    const min = Math.min(...entries.map((e) => e.depth));
    for (const e of entries) e.depth -= min;
    return entries;
  }
  const roots = new Set(shell.rootFiles);
  const top = new Set(shell.topLevelNames);
  let stack = [];
  for (const e of entries) {
    if (roots.has(path.basename(e.file)) || top.has(e.file)) {
      stack = [e.file];
    } else {
      const at = stack.lastIndexOf(e.file);
      if (at >= 0) stack.length = at + 1;
      else stack.push(e.file);
    }
    e.depth = stack.length - 1;
  }
  return entries;
}

function node(file, line, cmd) {
  return { file, line, cmd, count: 0, incl: 0, self: 0, children: new Map() };
}

/**
 * Build a cost tree from a trace.
 *
 * The time between one traced command and the next belongs to the earlier
 * command, and (inclusively) to every command that was still on the stack above
 * it. That is what makes `source ~/.nvm/nvm.sh` cost what nvm.sh really cost.
 * Times are in seconds in the input and milliseconds in the output.
 */
export function buildTree(entries, shell) {
  assignDepths(entries, shell);
  const root = node('', 0, '');
  const active = []; // active[d] = tree node of the most recent entry at depth d
  const byFile = new Map();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const d = Math.min(e.depth, active.length);
    active.length = d;
    const parent = d === 0 ? root : active[d - 1];
    const key = `${e.file}:${e.line}`;
    let n = parent.children.get(key);
    if (!n) {
      n = node(e.file, e.line, e.cmd);
      parent.children.set(key, n);
    }
    n.count++;
    active[d] = n;

    const next = entries[i + 1];
    const ms = next ? (next.t - e.t) * 1000 : 0;
    if (ms <= 0) continue;
    for (const a of active) a.incl += ms;
    n.self += ms;
    byFile.set(e.file, (byFile.get(e.file) || 0) + ms);
  }

  const total = entries.length ? (entries[entries.length - 1].t - entries[0].t) * 1000 : 0;
  root.incl = total;
  return { root, total, byFile };
}

export function sortedChildren(n) {
  return [...n.children.values()].sort((a, b) => b.incl - a.incl);
}

/** Every file or function name that appears anywhere beneath a node. */
export function descendantFiles(n, out = new Set()) {
  for (const c of n.children.values()) {
    out.add(c.file);
    descendantFiles(c, out);
  }
  return out;
}
