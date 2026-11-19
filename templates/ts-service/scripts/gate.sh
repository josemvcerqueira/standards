#!/usr/bin/env bash
# why: the merge check. Run it before every PR; CI runs the same file.
set -euo pipefail
cd "$(dirname "$0")/.."
step() { printf '\n== %s ==\n' "$1"; }
step "1/4 oxfmt";     npx --no-install oxfmt --check .
step "2/4 oxlint";    npx --no-install oxlint --deny-warnings src
step "3/4 tsc";       npx --no-install tsc
step "4/4 vitest";    npx --no-install vitest run
