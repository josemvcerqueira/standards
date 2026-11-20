# Interest Protocol house standard

How new code is written at Interest Protocol, by people and by agents. Every rule here names what enforces it. A rule that nothing enforces is either made enforceable or deleted.

Install: `bun add -d @interest-protocol/standards oxlint oxfmt oxlint-plugin-eslint eslint-plugin-sonarjs`, then start new repos from a template repo (`template-service`).

## Stack

| Concern                   | Default                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Language                  | TypeScript, `tsconfig.base.json` from this package (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`) |
| Format                    | oxfmt with `oxfmt.json`: double quotes, 100 columns, semicolons, trailing commas                                  |
| Lint                      | Oxlint with `oxlint/base.json`, or `oxlint/react.json` for React and Expo code                                    |
| Validation at the edge    | zod 4                                                                                                             |
| Branching and collections | ts-pattern, Remeda                                                                                                |
| SQL                       | Drizzle + `pg`                                                                                                    |
| Backend effects (pilot)   | Effect, in new backend services only, one pinned major                                                            |
| Tests                     | `bun test` (`jest-expo` for Expo apps)                                                                            |
| Runtime, packages         | Bun: runtime, package manager (`bun.lock`), script and test runner. No npm, pnpm or yarn                          |

## Folders

Every app uses the same folders under `src/`, from low to high:

```text
lib       pure helpers, no app knowledge and no runtime access
platform  the only code that touches the runtime: http, clock, log, server, drivers
data      storage, external APIs, zod schemas for what comes in
config    env.ts parses the environment once at boot
auth      sign-in and sessions
hooks     React hooks (the only place for effects)
ui        presentational components and tokens/
features  one folder per feature: its screens, workflows, local state
app       entry points: routes, HTTP handlers, CLI, workers
```

- A layer imports only from layers below it. `lib`, `data` and `config` never import `auth`, `hooks` or `ui`.
- Only `app` imports a feature, and a feature never imports another feature. Shared code moves down a layer.
- Folders reach each other through `@/`, never `../`.
- Code outside these folders (a stray `src/util.ts`) gets the strictest rules: no runtime access, no `../`, no deep imports.
- Enforced by: `no-restricted-imports` per folder in the Oxlint presets, including dynamic `import()`.

## Platform

Our lightweight version of the talk's Dune: product code never touches raw runtime APIs. `src/platform/` wraps them, and everything above it calls the wrappers, so tests can fake them and a change (timeouts, logging format, a driver swap) happens in one file.

| Raw API                                                                  | Use instead                                                      |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `fetch`, `axios`, `undici`, `got`, `ky`                                  | `@/platform/http` (`fetchJson` with a zod schema and a timeout)  |
| `Date.now()`, `new Date()`                                               | `@/platform/clock`                                               |
| `setTimeout`, `setInterval`, `setImmediate`                              | a wrapper in `@/platform` that names the job                     |
| `console.*`                                                              | `@/platform/log`                                                 |
| `Math.random()`                                                          | `@/platform/random`                                              |
| `Bun.serve`, `Bun.file`, `Bun.spawn`, `Bun.env`, `bun:sqlite`, `bun:ffi` | a wrapper in `@/platform`                                        |
| `Bun.sleep`                                                              | not allowed anywhere: wait for the event or poll with a deadline |
| `node:fs`, `node:http`, `node:child_process`, `pg`, `redis` and similar  | a wrapper in `@/platform`                                        |

`@/platform` imports nothing from the app above it, and `@/lib` never imports `@/platform`. Tests may use raw APIs. The wrappers live in each repo (they start from the template), and the bans live in this package. Enforced by: `no-restricted-imports` and `no-restricted-syntax` in every folder except `src/platform/`.

## Monorepo

Monorepos use Bun workspaces and Turborepo: `apps/*` are deployables (service, Next.js, Expo), `packages/*` are shared code. Each workspace has the standard `src/` folders and its own `.oxlintrc.json` (base or react preset) and `tsconfig.json`; oxfmt, hooks, CI and this package are installed once at the root.

- Apps import packages. A package never depends on an app. Enforced by: `ip-standards-verify` reading each workspace's `package.json`.
- Every package declares `exports`, its public entry. Nothing imports another package's `src/`, `dist/`, `lib/` or `internal/`. Enforced by: `exports` (TypeScript and Bun refuse other paths), `ip-standards-verify`, and `no-restricted-imports`.
- No `../` across workspaces. Enforced by: `no-restricted-imports`.
- The gate runs from the root on affected workspaces only (`turbo run … --affected`); `ip-standards-verify` checks every workspace.

## Tests

Few and sharp. Test pure logic, money, and each hard state of a screen. No snapshot tests. Test helpers live in `src/testing/` and production code never imports them (enforced by lint). Every lint rule in this package has a test that proves it fires (`test/rules.test.mjs`).

## Config

`process.env` is read only in `src/config/env.ts`, which parses it with zod once at boot. Everything else imports the parsed settings. Enforced by: `no-restricted-properties`.

## Timers

No fixed sleeps (`await new Promise(r => setTimeout(r, n))`, `timers/promises`) anywhere. In React code, no `setTimeout`, `requestAnimationFrame` or `requestIdleCallback` as a workaround in `ui`, `features` or `app`: wait for the event or use the framework's scheduler. Enforced by: `no-restricted-syntax`.

## Effects

`useEffect`, `useLayoutEffect` and `useInsertionEffect` appear only in `src/hooks/`. A component calls a named hook (`useTick`, `usePriceFeed`) or derives the value during render. Enforced by: `no-restricted-syntax` in `react.json`.

## Tokens

UI code has no literal colours, sizes or timings. They live in `src/ui/tokens/`. Enforced by: `no-restricted-syntax` in `react.json`.

## Comments

Comments go stale, and agents copy them. Code says what, names say why, lint messages carry the rules. Allowed:

- JSDoc directly above an export, documenting an API.
- `// why: …` for a reason that the code cannot show.
- `// TODO(#123): …` linked to an issue.
- A lint disable with a reason (next section).

Enforced by: `house/no-comments`.

## Disabling a rule

`// oxlint-disable-next-line rule-name -- reason`. Name the rule and give a reason; a disable without both fails `house/disable-needs-reason`. Legacy violations go in an allowlist file that only shrinks.

## Types and style

No `any` (use `unknown` and narrow), no non-null `!`, type-only imports inline, `===` only, braces on every block, named exports (framework entry files excepted), cognitive complexity at most 15. Enforced by: the Oxlint presets.

## Review and proof

- A different agent reviews every PR, given the diff and not the author's summary.
- UI PRs carry proof: a screenshot or a Maestro or Playwright run.
- A review comment that has come up before becomes a lint rule in this package, with a test and a message that names the fix.

## Enforcement

Every rule above fails something. Nothing here is advice to an agent.

| Layer                   | When                           | What fails                                                                                                                                               |
| ----------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude PreToolUse hook  | Before an agent edits a file   | Any edit to `.oxlintrc.json`, `.oxfmtrc.json`, `tsconfig.json`, `knip.json`, `lefthook.yml`, `package.json`, `scripts/gate.sh`, `.claude/` or `.github/` |
| Claude PostToolUse hook | After every agent edit         | oxlint errors on the package, sent back to the agent with the fix                                                                                        |
| Claude Stop hook        | When the agent tries to finish | The whole gate. The agent may not stop until it passes (after 5 failed tries it must report the blocking rule to a person)                               |
| Claude permissions      | Always                         | `--no-verify`, `-n` and `LEFTHOOK=0` are denied                                                                                                          |
| lefthook pre-commit     | `git commit`                   | Standard check, oxfmt, oxlint, tsc                                                                                                                       |
| lefthook pre-push       | `git push`                     | The whole gate                                                                                                                                           |
| GitHub Actions `gate`   | Every PR and push to main      | The whole gate on a clean checkout. Make it a required check (below)                                                                                     |

The gate (`scripts/gate.sh`) runs, in order: `ip-standards-verify`, `oxfmt --check`, `oxlint --deny-warnings`, `tsc` (strict), `knip` (unused files, exports, dependencies), and the tests.

`ip-standards-verify` fails when a repo:

- doesn't extend a preset from this package, sets any rule to `off` or `warn`, or adds ignore patterns
- doesn't extend `tsconfig.base.json`, or turns off any strict option from it
- has an `.oxfmtrc.json` that differs from `oxfmt.json`
- doesn't set `"packageManager": "bun@…"`, or has a `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock`
- disables an architecture or type-safety rule in source (`no-restricted-*`, `house/*`, `no-explicit-any`, `no-non-null-assertion`, `import/no-cycle`), uses a file-wide disable, or uses `@ts-ignore` / `@ts-nocheck`

Repos may add rules. They may never weaken them. A rule that is wrong gets changed here, in one place, for everyone.

**Required check.** Hooks can be skipped on a laptop; the required check can't. In each repo: Settings → Rules → Rulesets → New branch ruleset → target `main` → turn on _Require a pull request before merging_, _Require status checks to pass_ with the check `gate`, and _Block force pushes_. Or run `gh api -X POST repos/OWNER/REPO/rulesets --input .github/ruleset.json`. Hosted Actions must be paid for this to run; until then the pre-push gate is the last line.

## Changing the standard

Edit `scripts/build-presets.mjs`, run `bun run build:presets`, add a fixture and a test line, then release a new version. Repos pick it up by bumping the package.
