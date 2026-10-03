import { spawnSync } from 'node:child_process';

export const MARK = '@@SLOWRC@@';

// Every trace line is: MARK ts | depth | file | line | command
// zsh does not expand $ in PS4, so it emits no depth and nesting is derived
// from file/function names (see attribute.js). bash can report depth directly.
export const SHELLS = {
  zsh: {
    name: 'zsh',
    ps4: `${MARK}%D{%s.%6.}||%N|%i| `,
    rootFiles: ['.zshenv', '.zprofile', '.zshrc', '.zlogin', '.zlogout'],
    // Names zsh reports for the -c string itself; treated as a top-level frame.
    topLevelNames: ['zsh'],
    traceArgs: (mode) => [...(mode === 'login' ? ['-l'] : []), '-i', '-x', '-c', 'exit'],
    plainArgs: (mode) => [...(mode === 'login' ? ['-l'] : []), '-i', '-c', 'exit'],
  },
  bash: {
    name: 'bash',
    ps4: `${MARK}\${EPOCHREALTIME}|\${#BASH_SOURCE[@]}|\${BASH_SOURCE[0]}|\${LINENO}| `,
    rootFiles: [],
    topLevelNames: [],
    traceArgs: (mode) => [...(mode === 'login' ? ['-l'] : []), '-i', '-x', '-c', 'exit'],
    plainArgs: (mode) => [...(mode === 'login' ? ['-l'] : []), '-i', '-c', 'exit'],
  },
};

export function shellFromEnv(env = process.env) {
  const base = (env.SHELL || '').split('/').pop();
  return SHELLS[base] ? base : 'zsh';
}

export function defaultMode(platform = process.platform) {
  // macOS Terminal and iTerm open login shells; most Linux terminals do not.
  return platform === 'darwin' ? 'login' : 'interactive';
}

export function shellVersion(name) {
  const r = spawnSync(name, ['--version'], { encoding: 'utf8' });
  if (r.error) return null;
  const m = /(\d+)\.(\d+)(?:\.(\d+))?/.exec(r.stdout || '');
  return m ? { major: +m[1], minor: +m[2], text: m[0] } : { major: 0, minor: 0, text: 'unknown' };
}
