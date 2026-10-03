# Security Policy

## What slowrc does

slowrc starts your shell (`zsh`/`bash`) as a child process with `-x` tracing, reads your startup files to show line text, and, with `--whatif`, runs your shell against a temporary copy of those files. It does not modify your dotfiles, make network requests, or send data anywhere.

Because it executes your startup files, running it is as safe as opening a new terminal. `--whatif` executes modified copies of those files (each with one line replaced by a no-op), which cannot run anything your original files wouldn't.

Output can contain the text of your rc lines. Use `--no-source` before sharing it.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting ("Security" tab, "Report a vulnerability") instead of a public issue. You can expect an acknowledgement within a few days.

## Supported versions

Only the latest release receives fixes.
