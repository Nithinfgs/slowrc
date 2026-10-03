/**
 * Known slow-startup patterns and the usual way out. Hints are matched on the
 * traced command plus the files it pulled in. They are suggestions; `--whatif`
 * is what measures the real saving on your machine.
 */
export const HINTS = [
  {
    id: 'nvm',
    test: (t) => /nvm\.sh|\bnvm\b/.test(t),
    title: 'nvm loads on every shell',
    advice: 'lazy-load nvm so it only runs on first use of node/npm',
    snippet: `export NVM_DIR="$HOME/.nvm"
_nvm_lazy() {
  unset -f nvm node npm npx
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
}
for _c in nvm node npm npx; do
  eval "$_c() { _nvm_lazy; $_c \\"\\$@\\"; }"
done`,
  },
  {
    id: 'version-manager-init',
    test: (t) => /\b(pyenv|rbenv|jenv|goenv|nodenv)\b.*\binit\b|virtualenv-init/.test(t),
    title: 'a version manager runs its init hook',
    advice: 'init with --no-rehash, or load the version manager lazily',
    snippet: `# pyenv: avoid the rehash on every shell
eval "$(pyenv init - --no-rehash)"`,
  },
  {
    id: 'conda',
    test: (t) => /conda\.sh|conda initialize|conda shell\.|miniconda|anaconda|miniforge|mamba/.test(t),
    title: 'conda initialises on every shell',
    advice: 'turn off auto-activate and load conda lazily',
    snippet: `conda config --set auto_activate_base false
# then replace the "conda initialize" block with a lazy stub:
conda() { unfunction conda; . "$HOME/miniconda3/etc/profile.d/conda.sh"; conda "$@"; }`,
  },
  {
    id: 'compinit',
    test: (t) => /\bcompinit\b/.test(t) && !/compinit\s+(-\w*C\w*)/.test(t),
    title: 'compinit rebuilds or re-validates the completion cache',
    advice: 'use `compinit -C` and rebuild the dump once a day',
    snippet: `autoload -Uz compinit
if [[ -n \${ZDOTDIR:-$HOME}/.zcompdump(#qN.mh+24) ]]; then
  compinit
else
  compinit -C
fi`,
  },
  {
    id: 'brew',
    test: (t) => /\bbrew\b.*(shellenv|--prefix|--repository|--cellar)/.test(t),
    title: 'brew is invoked to compute a path',
    advice: 'hard-code the Homebrew prefix instead of calling brew',
    snippet: `# instead of: eval "$(brew shellenv)"
export HOMEBREW_PREFIX=/opt/homebrew
export PATH="$HOMEBREW_PREFIX/bin:$HOMEBREW_PREFIX/sbin:$PATH"`,
  },
  {
    id: 'completion-eval',
    test: (t) => /(source|\.)\s*<\(|\bcompletion\s+(zsh|bash)\b/.test(t),
    title: 'a completion script is regenerated on every shell',
    advice: 'generate the completion once into a file, then source that',
    snippet: `# run once:  kubectl completion zsh > ~/.zsh/completions/_kubectl
# then put ~/.zsh/completions on fpath before compinit`,
  },
  {
    id: 'ohmyzsh',
    test: (t) => /oh-my-zsh\.sh/.test(t),
    title: 'oh-my-zsh startup',
    advice: 'trim plugins and turn off auto-update checks',
    snippet: `DISABLE_AUTO_UPDATE="true"
DISABLE_MAGIC_FUNCTIONS="true"
plugins=(git)   # keep only what you use`,
  },
  {
    id: 'gcloud',
    test: (t) => /google-cloud-sdk/.test(t),
    title: 'Google Cloud SDK scripts',
    advice: 'keep path.zsh.inc, skip completion.zsh.inc at startup',
    snippet: `source "$HOME/google-cloud-sdk/path.zsh.inc"
# skip completion.zsh.inc at startup`,
  },
  {
    id: 'sdkman-asdf-rvm',
    test: (t) => /sdkman-init|asdf\.sh|\.rvm\/scripts\/rvm/.test(t),
    title: 'a language manager loads its full shell integration',
    advice: 'use shims-only mode, or load it lazily',
    snippet: `# asdf: add shims to PATH instead of sourcing asdf.sh
export PATH="\${ASDF_DATA_DIR:-$HOME/.asdf}/shims:$PATH"`,
  },
  {
    id: 'ssh-agent',
    test: (t) => /ssh-agent|ssh-add|\bkeychain\b/.test(t),
    title: 'ssh-agent or ssh-add runs at startup',
    advice: 'set AddKeysToAgent in ~/.ssh/config instead',
    snippet: `# ~/.ssh/config
Host *
  AddKeysToAgent yes
  UseKeychain yes`,
  },
  {
    id: 'eval-init',
    test: (t) => /\beval\b.*(\$\(|`)/.test(t),
    title: 'eval of a command substitution',
    advice: "cache the tool's output in a file; refresh it when the tool changes",
    snippet: `_cache_eval() {
  local bin=$1 out="\${XDG_CACHE_HOME:-$HOME/.cache}/init-$1.zsh"; shift
  if [[ ! -s $out || $(command -v $bin) -nt $out ]]; then "$bin" "$@" > "$out"; fi
  source "$out"
}
_cache_eval starship init zsh`,
  },
];

/** Matching hints, most specific first; the generic eval hint only appears alone. */
export function matchHints(text) {
  const hits = HINTS.filter((h) => h.test(text));
  return hits.length > 1 ? hits.filter((h) => h.id !== 'eval-init') : hits;
}
