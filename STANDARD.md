# Interest Protocol house standard

How new code is written at Interest Protocol, by people and by agents. Every rule here names what enforces it. A rule that nothing enforces is either made enforceable or deleted.

Install: `bun add -d @interest-protocol/standards oxlint oxfmt oxlint-plugin-eslint eslint-plugin-sonarjs`, then start new repos from a template repo (`template-service`).

## Stack

| Concern                   | Default                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Language                  | TypeScript, `tsconfig.base.json` from this package (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)  |
| Format                    | oxfmt with `oxfmt.json`: double quotes, 100 columns, semicolons, trailing commas                                   |
| Lint                      | Oxlint with `oxlint/base.json`, `oxlint/react.json` for React and Expo, `oxlint/effect.json` for Effect services   |
| Validation at the edge    | zod 4                                                                                                              |
| Branching and collections | ts-pattern, Remeda                                                                                                 |
| SQL                       | Drizzle + `pg`                                                                                                     |
| Backend effects (pilot)   | Effect v4 in new backend services only: `oxlint/effect.json`, `effect` and `@effect/*` pinned to one exact version |
| Tests                     | `bun test` (`jest-expo` for Expo apps)                                                                             |
| Runtime, packages         | Bun: runtime, package manager (`bun.lock`), script and test runner. No npm, pnpm or yarn                           |

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

## Effect

Effect services start from `template-service-effect` and extend `oxlint/effect.json`: the base preset plus the rules below. Each rule fails lint with a message that names the fix. Sources are the v4 docs on effect.website, the v3→v4 migration guide, and the agent guide and examples that ship inside the `effect` package (`node_modules/effect/AGENTS.md`, `node_modules/effect/ai-docs/`; the same files are [LLMS.md](https://github.com/Effect-TS/effect/blob/main/LLMS.md) and [ai-docs/](https://github.com/Effect-TS/effect/tree/main/ai-docs) in the Effect repo). "AGENTS.md" below means that guide. Read those before writing new kinds of Effect code; they match the installed version.

Where Effect code goes, from low to high: `src/data/api` holds the HTTP contract (schemas, endpoints, errors), `src/config` reads configuration, `src/platform` chooses runtimes, servers, loggers and drivers, `src/features/<name>` holds services and handlers, and `src/app/main.ts` composes the layers and runs once.

Two checkers run in the gate. Oxlint runs the syntax rules below on every edit. `effect-language-service diagnostics` runs the official Effect language service with the severities in `tsconfig.effect.json`, which catches what needs types: effects that are never run (`floatingEffect`), missing services and errors in a signature (`missingEffectContext`, `missingEffectError`, `missingLayerContext`), removed v3 APIs (`outdatedApi`), barrel imports (`importFromBarrel`), service keys that don't match their file (`deterministicKeys`), try/catch and `new Promise` in Effect code, and more. Effect repos extend `tsconfig.effect.json` instead of `tsconfig.base.json`.

`ip-standards-verify` also fails a repo that depends on `effect` or `@effect/*` without extending `oxlint/effect.json` and `tsconfig.effect.json`, without `@effect/language-service`, with a version range, with mixed versions, or with files outside the API layout below. v4 releases every Effect package together under one version ([MIGRATION.md, Versioning](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)).

### Effect libraries

Effect v4 ships most of what a service needs inside `effect`. Add a separate package only for a runtime, a driver or a provider, always at the same exact version as `effect`.

| Need                                | Use                                                                                              | Why                                                                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime, HTTP server, file system   | `@effect/platform-bun`                                                                           | Bun is the house runtime; `BunRuntime.runMain` handles signals and graceful shutdown, `BunHttpServer` serves `HttpRouter`/`HttpApi` routes. In `src/platform` only                                                              |
| HTTP API, OpenAPI, typed client     | `effect/http-api`                                                                                | Schema-first endpoints, validation, OpenAPI at `/openapi.json`, Scalar docs, and a client derived from the same contract                                                                                                        |
| Outbound HTTP                       | `effect/http` (`HttpClient`, `FetchHttpClient` or `BunHttpClient`)                               | Typed errors, retries with `Schedule`, `HttpClient.retryTransient`; testable by swapping the layer                                                                                                                              |
| Validation, domain models           | `effect/Schema`, `effect/schema` (`Model`)                                                       | One schema for decode, encode, OpenAPI and test data (`Schema` arbitraries)                                                                                                                                                     |
| SQL                                 | `effect/sql` + `@effect/sql-pg` (Postgres) or `@effect/sql-sqlite-bun`                           | `SqlSchema` and `Model.Class` repositories decode rows with Schema; migrations with `PgMigrator`/`SqliteMigrator`. Drizzle has no v4 integration (`@effect/sql-drizzle` is at 0.51, v3 only), so Effect repos don't use Drizzle |
| Telemetry                           | `effect/observability` (`Otlp`), or `@effect/opentelemetry` with an existing OpenTelemetry setup | Effect's spans (`Effect.fn("name")`) and logs export without the OpenTelemetry SDK; the AGENTS guide recommends `Otlp` for new projects                                                                                         |
| LLM calls                           | `effect/ai` + `@effect/ai-anthropic` or `@effect/ai-openai`                                      | Provider-agnostic `LanguageModel`, Schema-decoded structured output, tools as Schemas                                                                                                                                           |
| CLI                                 | `effect/cli`                                                                                     | Typed arguments and flags, same services and layers as the server                                                                                                                                                               |
| Time, retries, concurrency, streams | `DateTime`, `Duration`, `Schedule`, `Semaphore`, `Effect.forEach({ concurrency })`, `Stream`     | Built into `effect` and controlled by `TestClock` in tests                                                                                                                                                                      |
| Pattern matching, collections       | `Match`, `Array`, `Record`, `Option`, `Result`                                                   | Same pipeable, tree-shakable style as the rest of the code                                                                                                                                                                      |
| Tests                               | `bun test`, `effect/testing` (`TestClock`), `HttpApiTest`                                        | House runner is Bun. `@effect/vitest` needs Vitest, so it is not used                                                                                                                                                           |
| Editor and gate diagnostics         | `@effect/language-service` (dev)                                                                 | Type-aware Effect checks in the editor and in the gate                                                                                                                                                                          |

These overlap with Effect and fail lint in Effect code, each with the Effect module to use instead: ts-pattern, Remeda, lodash, Ramda, fp-ts, neverthrow (→ `Match`, `Array`, `Option`, `Result`); zod, yup, joi, io-ts, valibot, arktype, class-validator (→ `Schema`); date-fns, dayjs, moment, luxon (→ `DateTime`); pino, winston, bunyan (→ `Effect.log*`); Express, Fastify, Hono, Koa, Elysia, NestJS, tRPC (→ `HttpApi`, `effect/rpc`); InversifyJS, tsyringe, TypeDI (→ `Context.Service`, `Layer`); Drizzle, Kysely, Prisma, TypeORM, Knex, Mongoose, Sequelize (→ `effect/sql`); p-retry, p-limit, p-queue, async (→ `Schedule`, `Semaphore`, `concurrency`); RxJS (→ `Stream`); commander, yargs (→ `effect/cli`); the OpenAI, Anthropic and Vercel AI SDKs (→ `effect/ai`). Enforced by: `no-restricted-imports` in `effect.json`.

### Effect API layout

One layout for every Effect service. Each group of endpoints has one folder in the contract and one in features, with the same kebab-case name as the group id.

```text
src/
  data/api/
    Api.ts                    the one HttpApi: HttpApi.make(...).add(PricesApi).add(...)
    prices/                   one folder per group, named after the group id
      PricesApi.ts            HttpApiGroup.make("prices") and its HttpApiEndpoints, nothing else
      schemas.ts              Schema.Class and branded types for params, payloads and responses
      errors.ts               Schema.TaggedError with { httpApiStatus } for errors on the wire
  features/
    prices/
      Prices.ts               a Context.Service class with static readonly layer (and other static layers for tests)
      handlers.ts             HttpApiBuilder.group(Api, "prices", ...): maps endpoints to service calls
      handlers.test.ts        HttpApiTest.groups(Api, ["prices"]) against a test layer
      errors.ts               internal errors that never reach the wire (optional)
  config/AppConfig.ts         a Context.Service reading Config, with static readonly layer
  platform/                   server, runtime, log: layers wrapping @effect/platform-bun and Logger
  app/main.ts                 HttpApiBuilder.layer(Api) + handler layers + server, Layer.launch, runMain
```

| Rule                                                                                                                                                                                            | Enforced by                            |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `HttpApi.make` only in `src/data/api/Api.ts`                                                                                                                                                    | `no-restricted-syntax`                 |
| `HttpApiGroup` and `HttpApiEndpoint` calls only in `src/data/api/<group>/<Group>Api.ts`, which declares no `Schema.Class` or `Schema.Struct` of its own                                         | `no-restricted-syntax`                 |
| `Schema.TaggedError` only in an `errors.ts`                                                                                                                                                     | `no-restricted-syntax`                 |
| `HttpApiBuilder.group` only in `src/features/<group>/handlers.ts`, which declares no service                                                                                                    | `no-restricted-syntax`                 |
| Every `Context.Service` has `static readonly layer`                                                                                                                                             | `no-restricted-syntax`                 |
| A service's key is `<package>/<path>/<Name>`, e.g. `my-service/features/prices/Prices`                                                                                                          | `deterministicKeys` (language service) |
| `src/data/api` holds only `Api.ts` and kebab-case group folders; a group folder holds only `<Group>Api.ts`, `schemas.ts`, `errors.ts`; `<Group>Api.ts` declares `HttpApiGroup.make("<folder>")` | `ip-standards-verify`                  |
| A feature holds only `handlers.ts`, `errors.ts` and PascalCase service files, plus their tests; `handlers.ts` implements the group named after its folder, which must exist in `src/data/api`   | `ip-standards-verify`                  |

Sources: the contract is kept apart from the server so clients can import it ([`ai-docs/src/51_http-server/10_basics.ts`](https://github.com/Effect-TS/effect/blob/main/ai-docs/src/51_http-server/10_basics.ts)); services attach their implementation as a static layer and tests swap it ([`ai-docs/src/01_effect/03_services/`](https://github.com/Effect-TS/effect/tree/main/ai-docs/src/01_effect/03_services), "Attach a static layer to the service" in AGENTS.md); errors carry `httpApiStatus` (`ai-docs/src/51_http-server/fixtures/domain/UserErrors.ts`). The folder names are a house choice.

### Effect imports

| Rule                                                                                                                                    | Fix                                                                                                           | Source                                                                                                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No barrel imports: `"effect"`, `"effect/http"`, `"effect/http-api"`, `"@effect/platform-bun"`                                           | `import * as Effect from "effect/Effect"`, `import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"` | "Named imports may generate tree shaking issues when a bundler doesn't support deep scope analysis" ([Importing Effect](https://effect.website/docs/v4/getting-started/importing-effect)). Measured on effect 4.1.4 with esbuild: a one-line program is 31.7 kB gzipped through the barrel and 9.5 kB through `effect/Effect`. Bun's bundler shakes both to 9 kB. |
| No named imports from a module path (`import { succeed } from "effect/Effect"`)                                                         | `import * as Effect` (or `import type * as`)                                                                  | One import style, so every call reads `Module.fn` as in the docs ([Importing Effect](https://effect.website/docs/v4/getting-started/importing-effect))                                                                                                                                                                                                            |
| No `effect/unstable/*`, `effect/internal`, `effect/dist`                                                                                | the public path, e.g. `effect/http/HttpClient`                                                                | "Imports using `effect/unstable/<module>` must drop the `unstable` segment… There are no compatibility exports" ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md))                                                                                                                                                                      |
| No v3 modules or packages: `effect/Either`, `effect/FiberRef`, `effect/TestClock`, `@effect/platform`, `@effect/schema`, `@effect/rpc`… | the v4 path from the message                                                                                  | [v3→v4 import map](https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md), "Functionality from `@effect/platform`, `@effect/rpc`, `@effect/cluster`, and others now lives directly in `effect`" ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md))                                                                        |

### Effect style

| Rule                                                                | Fix                                                | Source                                                                                                                                                                                                                |
| ------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No function that only returns `Effect.gen`                          | `Effect.fn("name")(function* (...) {...})`         | "Avoid creating functions that only wrap and return an `Effect.gen`" (AGENTS.md in effect 4.1.4)                                                                                                                      |
| No `.pipe` on an `Effect.fn`                                        | pass combinators as extra arguments to `Effect.fn` | "**Do not** use .pipe with Effect.fn" (AGENTS.md in effect 4.1.4)                                                                                                                                                     |
| A reusable `Effect.fn` assigned to a variable has a name            | `Effect.fn("getUser")`, or `Effect.fnUntraced`     | "Pass a string to Effect.fn, which will improve stack traces and also attach a tracing span" (AGENTS.md in effect 4.1.4)                                                                                              |
| No effect built and dropped inside a generator (`Effect.log("x");`) | `yield*` it, or chain it                           | "make sure to explicitly chain them using functions like `Effect.map`, `Effect.flatMap`, `Effect.andThen`, or `Effect.tap`" ([Building Pipelines](https://effect.website/docs/v4/getting-started/building-pipelines)) |

Pipelines use the `.pipe()` method or `Effect.gen`; both are functions under the hood, so they shake. "Functions are tree shakeable, while methods are not" ([Building Pipelines](https://effect.website/docs/v4/getting-started/building-pipelines)), and v4 effects have no other methods.

### Effect errors

| Rule                                                                                                            | Fix                                                                                                   | Source                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `throw` in a generator                                                                                       | `return yield* new SomeError({...})`                                                                  | "throwing errors can be problematic" ([Expected Errors](https://effect.website/docs/v4/error-management/expected-errors)); a throw in `Effect.sync` "will be treated as a defect" ([Creating Effects](https://effect.website/docs/v4/getting-started/creating-effects)) |
| `yield* new SomeError()` is always returned                                                                     | `return yield* new SomeError()`                                                                       | "Always return when raising an error, to ensure typescript understands that the function will not continue executing" (AGENTS.md in effect 4.1.4)                                                                                                                       |
| Errors are `Schema.TaggedError`, not `Data.TaggedError`, `extends Error` or `Effect.fail(new Error())`          | `class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {...}, { httpApiStatus: 404 }) {}` | "Use Schema.TaggedError to define a custom error" (AGENTS.md in effect 4.1.4); HttpApi encodes errors through their schema and `httpApiStatus` (`ai-docs/src/51_http-server/fixtures/domain/UserErrors.ts`)                                                             |
| No v3 names: `catchAll`, `catchAllCause`, `catchAllDefect`, `catchSome`, `catchSomeCause`, `fork`, `forkDaemon` | `catch`, `catchCause`, `catchDefect`, `catchFilter`, `catchCauseFilter`, `forkChild`, `forkDetach`    | [Error handling](https://github.com/Effect-TS/effect/blob/main/migration/error-handling.md), [Forking](https://github.com/Effect-TS/effect/blob/main/migration/forking.md) migration guides                                                                             |
| No zod in Effect code                                                                                           | `effect/Schema`                                                                                       | "All validation and domain modeling in Effect is done with `Schema`" (AGENTS.md in effect 4.1.4)                                                                                                                                                                        |

### Effect services

| Rule                                                                   | Fix                                                                                                          | Source                                                                                                                                                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `Context.Tag`, `Context.GenericTag`, `Effect.Tag`, `Effect.Service` | `class X extends Context.Service<X, Shape>()("pkg/path/X") { static readonly layer = Layer.effect(X, ...) }` | [Services migration](https://github.com/Effect-TS/effect/blob/main/migration/services.md), [Managing Services](https://effect.website/docs/v4/requirements-management/services)                                                                    |
| The service identifier has the package and folder path                 | `"my-service/features/prices/Prices"`                                                                        | "You need to specify an identifier to make the service key global" ([Managing Services](https://effect.website/docs/v4/requirements-management/services)); "should include the package name and the subdirectory path" (AGENTS.md in effect 4.1.4) |
| `Effect.provide` and `provideService` only in `src/app` and tests      | `yield*` the service; compose with `Layer.provide`                                                           | "By providing services at the start, you ensure that all parts of your application have consistent access" ([Managing Services](https://effect.website/docs/v4/requirements-management/services))                                                  |

### Effect HTTP API

| Rule                                                                                                               | Fix                                                              | Source                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HttpApi`, `HttpApiGroup` and `HttpApiEndpoint` only in `src/data`                                                 | put the contract in `src/data/api`                               | "Api definitions should **always** be seperate from the server implementation, so that they can be shared between the server and client without leaking server code into clients" (`ai-docs/src/51_http-server/10_basics.ts`) |
| `HttpApiBuilder`, `HttpApiScalar` and `HttpApiSwagger` never in `src/data`                                         | handlers in `src/features`, docs routes in `src/app`             | same                                                                                                                                                                                                                          |
| No `HttpRouter`, `HttpServer`, `HttpServerRequest` or `HttpServerResponse` below `src/app`                         | declare an endpoint and implement it with `HttpApiBuilder.group` | "`HttpApi` gives you schema-first, type-safe HTTP APIs with runtime validation, typed clients, and OpenAPI docs from one definition" (AGENTS.md in effect 4.1.4)                                                              |
| No `Schema.Any` or `Schema.Unknown` as an endpoint's `success`, `payload`, `params`, `query`, `headers` or `error` | the real schema                                                  | same                                                                                                                                                                                                                          |

Test handlers with `HttpApiTest.groups(Api, ["group"])`, which runs the real encoding, routing and decoding without a server (`ai-docs/src/51_http-server/20_testing.ts`).

### Effect config

| Rule                                               | Fix                                                                           | Source                                                                                                                                                                                                            |
| -------------------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Config` and `ConfigProvider` only in `src/config` | expose settings as a service with a layer (`AppConfig.layer`) and `yield*` it | "A `ConfigProvider` supplies the raw values. The default provider reads environment variables" ([Configuration](https://effect.website/docs/v4/configuration)); one place reads settings, as in [Config](#config) |

### Effect logging

| Rule                                   | Fix                                                                                                | Source                                                                                                                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Logger` only in `src/platform`        | log with `Effect.logInfo` / `logWarning` / `logError`; `@/platform/log` picks the format and level | "Configure loggers & log-level filtering for production applications" with `Logger.layer` (`ai-docs/src/08_observability/10_logging.ts`)                            |
| No interpolated values in log messages | `Effect.logInfo("price served").pipe(Effect.annotateLogs({ ticker }))`                             | `Effect.annotateLogs` "Attach[es] structured metadata to all log lines" (`ai-docs/src/08_observability/10_logging.ts`); constant messages keep JSON logs searchable |

### Effect running

| Rule                                                                                                                 | Fix                                                       | Source                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Effect.runPromise`, `runSync`, `runFork`, `runCallback`, `runMain` and `ManagedRuntime` only in `src/app` and tests | return the Effect; `src/app/main.ts` calls `runMain` once | "Typically, an application built around Effect will involve a single call to the main effect" and "It's advisable to use the `run*` functions closer to the edge" ([Running Effects](https://effect.website/docs/v4/getting-started/running-effects)); `runMain` "installs SIGINT / SIGTERM handlers" (`ai-docs/src/01_effect/06_running/10_run-main.ts`) |

### Effect platform

| Raw API                                                                           | Effect replacement                                                             | Source                                                                                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch`                                                                           | depend on `HttpClient.HttpClient`; `@/platform` provides the layer             | `ai-docs/src/50_http-client/10_basics.ts`                                                                                                                                 |
| `Date.now()`, `new Date()`                                                        | `DateTime.now`, `Clock.currentTimeMillis`; tests use `TestClock`               | "use the `DateTime` module instead of `Date` and `Date.now`" (AGENTS.md in effect 4.1.4)                                                                                  |
| `setTimeout`, `setInterval`                                                       | `Effect.sleep`, `Effect.repeat`, `Schedule`                                    | `ai-docs/src/06_schedule/10_schedules.ts`                                                                                                                                 |
| `Math.random()`                                                                   | `Random`                                                                       |                                                                                                                                                                           |
| `console.*`                                                                       | `Effect.log*`                                                                  |                                                                                                                                                                           |
| `Effect.promise`, `Effect.tryPromise`, `async` functions                          | `Effect.tryPromise({ try, catch })` with a tagged error, once, in `@/platform` | `Effect.tryPromise` catches "exceptions … transforming them into manageable errors" ([Creating Effects](https://effect.website/docs/v4/getting-started/creating-effects)) |
| `@effect/platform-*`, `@effect/sql-*`, `@effect/opentelemetry`, `FetchHttpClient` | a Layer exported from `@/platform`                                             | `@effect/platform-*` "are platform-specific" ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md))                                                 |

Inside `src/platform` these are allowed, and `Bun.*` stays there as in [Platform](#platform).

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
