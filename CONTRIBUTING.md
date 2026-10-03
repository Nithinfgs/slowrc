# Contributing to slowrc

Thanks for helping. slowrc is small on purpose: zero runtime dependencies, plain Node ES modules.

## Setup

```bash
git clone https://github.com/Nithinfgs/slowrc && cd slowrc
npm test        # node:test, no install step needed
npm run lint    # zero-dependency syntax and hygiene check
npm run demo    # try the bundled slow setup
```

zsh must be installed to run the integration tests. bash 5+ enables the bash test; it is skipped otherwise.

## The most useful contribution: a new hint

Hints live in [`src/hints.js`](src/hints.js). A good one has:

1. a **pattern** that matches the traced command or the files it pulls in,
2. a one-line **advice** and a paste-ready **snippet**,
3. **evidence**: say what you measured (`slowrc --whatif` before and after) in the PR description.

Add a case to `test/hints.test.js` for the pattern, including a line that must *not* match.

## Other guidelines

- Keep claims honest. If a number isn't measured, don't present it as measured.
- Keep output safe to paste: no secrets, home paths shown as `~`.
- Tests that depend on timing should use large, obvious differences (hundreds of ms), not fine ones.
- Small PRs with a clear description are easier to review than large ones.

## Reporting bugs

Please include `slowrc --no-source --json` output, your shell and version, and your OS.
