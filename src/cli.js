import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { SHELLS, shellFromEnv, defaultMode } from './shells.js';
import { profile } from './profile.js';
import { renderText, toJSON, makeShortener } from './render.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const HELP = `slowrc ${pkg.version} - find out why your shell takes so long to start

Usage: slowrc [options]

  --whatif            measure the real saving of removing each hot line (zsh)
  --demo              profile a bundled, deliberately slow zsh setup (touches none of your files)
  --shell <zsh|bash>  shell to profile (default: from $SHELL)
  --mode <m>          login | interactive (default: login on macOS, interactive elsewhere)
  --runs <n>          timed startups for the headline number (default 5)
  --rounds <n>        interleaved rounds per variant for --whatif (default 5)
  --top <n>           rows to show (default 8)
  --budget <ms>       exit 1 if median startup is slower than this (for CI / dotfile repos)
  --snippets          print a ready-to-paste fix under each hint
  --no-source         hide the text of your rc lines (safer to paste in an issue)
  --json              machine-readable output
  --no-color          disable colour
  -v, --version       print version
  -h, --help          show this help

slowrc only runs your shell and reads your startup files. It never changes them.
`;

const demoDir = fileURLToPath(new URL('../examples/demo-zsh', import.meta.url));

function toInt(name, v, min = 1) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} must be an integer >= ${min}`);
  return n;
}

export async function main(argv, io = { out: process.stdout, err: process.stderr }) {
  let args;
  try {
    args = parseArgs({
      args: argv,
      allowPositionals: false,
      options: {
        whatif: { type: 'boolean' },
        demo: { type: 'boolean' },
        shell: { type: 'string' },
        mode: { type: 'string' },
        runs: { type: 'string' },
        rounds: { type: 'string' },
        top: { type: 'string' },
        budget: { type: 'string' },
        snippets: { type: 'boolean' },
        'no-source': { type: 'boolean' },
        json: { type: 'boolean' },
        'no-color': { type: 'boolean' },
        version: { type: 'boolean', short: 'v' },
        help: { type: 'boolean', short: 'h' },
      },
    }).values;
  } catch (e) {
    io.err.write(`slowrc: ${e.message}\n\n${HELP}`);
    return 2;
  }

  if (args.help) return io.out.write(HELP), 0;
  if (args.version) return io.out.write(`${pkg.version}\n`), 0;

  let tmpDemo = null;
  try {
    const shellName = args.demo ? 'zsh' : args.shell || shellFromEnv();
    const shell = SHELLS[shellName];
    if (!shell) throw new Error(`unsupported shell "${shellName}" (supported: ${Object.keys(SHELLS).join(', ')})`);
    const mode = args.mode || defaultMode();
    if (!['login', 'interactive'].includes(mode)) throw new Error('--mode must be login or interactive');

    let env = { ...process.env };
    let rcDir = env.ZDOTDIR || os.homedir();
    const pairs = [[os.homedir(), '~']];

    if (args.demo) {
      // Run the demo from a temp copy with ZDOTDIR pointing at it, so none of
      // the user's own startup files are involved.
      tmpDemo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'slowrc-demo-'));
      fs.cpSync(demoDir, tmpDemo, { recursive: true });
      env = { ...env, ZDOTDIR: tmpDemo, SLOWRC_DEMO: tmpDemo };
      rcDir = tmpDemo;
      pairs.unshift([tmpDemo, '<demo>']);
    }

    const showSource = !args['no-source'];
    const short = makeShortener(pairs);
    const color = !args['no-color'] && !args.json && !process.env.NO_COLOR && (Boolean(io.out.isTTY) || Boolean(process.env.FORCE_COLOR));

    const report = profile({
      shell,
      mode,
      env,
      rcDir,
      runs: args.runs ? toInt('runs', args.runs) : 5,
      rounds: args.rounds ? toInt('rounds', args.rounds) : 5,
      top: args.top ? toInt('top', args.top) : 8,
      withWhatIf: Boolean(args.whatif),
      onProgress: (i, n) => {
        if (!args.json && io.err.isTTY) io.err.write(`\r  measuring what-if ${i}/${n}…`);
        if (i === n && !args.json && io.err.isTTY) io.err.write('\r\x1b[K');
      },
    });

    if (args.json) {
      io.out.write(JSON.stringify(toJSON(report, { short, showSource }), null, 2) + '\n');
    } else {
      io.out.write(
        renderText(report, { color, short, showSource, snippets: Boolean(args.snippets), version: pkg.version }),
      );
    }

    if (args.budget) {
      const budget = toInt('budget', args.budget);
      if (report.startup.median > budget) {
        io.err.write(`slowrc: median startup ${Math.round(report.startup.median)} ms exceeds budget of ${budget} ms\n`);
        return 1;
      }
    }
    return 0;
  } catch (e) {
    io.err.write(`slowrc: ${e.message}\n`);
    return 2;
  } finally {
    if (tmpDemo) fs.rmSync(tmpDemo, { recursive: true, force: true });
  }
}
