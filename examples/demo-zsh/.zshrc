# A deliberately slow zsh setup for `slowrc --demo`.
# The slow tools are simulated with `sleep`, so the demo behaves the same on every machine.
export PATH="$SLOWRC_DEMO/bin:$PATH"
export NVM_DIR="$SLOWRC_DEMO/nvm"

# 1. a node version manager that loads on every shell
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# 2. a version manager init hook
eval "$(pyenv init -)"

# 3. completions
autoload -Uz compinit && compinit

# 4. a conda-style initialiser
source "$SLOWRC_DEMO/conda.sh"

alias ll='ls -lah'
PROMPT='%~ %# '
