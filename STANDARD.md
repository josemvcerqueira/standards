# Interest Protocol house standard

How new code is written at Interest Protocol, by people and by agents. Every rule here names what enforces it. A rule that nothing enforces is either made enforceable or deleted.

Install: `npm i -D @interest-protocol/standards oxlint oxfmt oxlint-plugin-eslint eslint-plugin-sonarjs`, then start from a template in `templates/`.

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
| Tests                     | vitest (`jest-expo` for Expo apps)                                                                                |
| Runtime, packages         | Node 24, npm                                                                                                      |

## Folders

Every app uses the same folders under `src/`, from low to high:

```text
lib       pure helpers, no app knowledge
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
- Enforced by: `no-restricted-imports` per folder in the Oxlint presets, including dynamic `import()`.

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

## Changing the standard

Edit `scripts/build-presets.mjs`, run `npm run build:presets`, add a fixture and a test line, then release a new version. Repos pick it up by bumping the package.
