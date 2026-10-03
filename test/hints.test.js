import test from 'node:test';
import assert from 'node:assert/strict';
import { matchHints } from '../src/hints.js';

const ids = (t) => matchHints(t).map((h) => h.id);

test('recognises common slow patterns', () => {
  assert.deepEqual(ids('source /home/u/.nvm/nvm.sh'), ['nvm']);
  assert.deepEqual(ids('eval "$(pyenv init -)"'), ['version-manager-init']);
  assert.deepEqual(ids('source /opt/conda/etc/profile.d/conda.sh'), ['conda']);
  assert.deepEqual(ids('eval "$(brew shellenv)"'), ['brew']);
  assert.deepEqual(ids('source <(kubectl completion zsh)'), ['completion-eval']);
});

test('compinit is flagged unless it already uses -C', () => {
  assert.deepEqual(ids('autoload -Uz compinit && compinit'), ['compinit']);
  assert.deepEqual(ids('compinit -C'), []);
});

test('generic eval hint only shows when nothing more specific matched', () => {
  assert.deepEqual(ids('eval "$(starship init zsh)"'), ['eval-init']);
  assert.ok(!ids('eval "$(pyenv init -)"').includes('eval-init'));
});

test('plain lines get no hint', () => {
  assert.deepEqual(ids("alias ll='ls -lah'"), []);
});
