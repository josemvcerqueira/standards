#!/usr/bin/env bash
# why: Claude Code Stop hook. Claude may not finish a turn with a type error or a failing test.
set -uo pipefail
active=$(node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.stdout.write(String(JSON.parse(s).stop_hook_active??false)))')
[ "$active" = "true" ] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}"
if ! out=$( { npx --no-install tsc && npx --no-install vitest run --changed; } 2>&1 ); then
  printf 'Typecheck or tests fail. Fix them before you finish:\n%s\n' "$(printf '%s' "$out" | tail -40)" >&2
  exit 2
fi
