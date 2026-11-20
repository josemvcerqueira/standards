// why: the Effect v4 preset's rules. build-presets.mjs merges them into each folder's override, because Oxlint
// why: overrides replace a rule's options. STANDARD.md#effect lists the doc source behind every rule.
const doc = (section) => `(STANDARD.md#${section})`;

const pattern = (regex, message) => ({ regex, caseSensitive: true, message });
const rule = (selector, message) => ({ selector, message });
const effectCall = (names) =>
  `CallExpression[callee.object.name='Effect'][callee.property.name=/^(${names})$/]`;

const overlapping = [
  [
    "^(ts-pattern|remeda|lodash|lodash-es|ramda|fp-ts|neverthrow|purify-ts|true-myth)(/|$)",
    "effect/Match, effect/Array, effect/Record, effect/Option and effect/Result",
  ],
  [
    "^(yup|joi|io-ts|valibot|arktype|superstruct|class-validator|class-transformer)(/|$)",
    "effect/Schema",
  ],
  ["^(date-fns|dayjs|moment|luxon)(/|$)", "effect/DateTime and effect/Duration"],
  ["^(pino|winston|bunyan|loglevel)(/|$)", "Effect.log*, with the logger chosen in @/platform/log"],
  [
    "^(express|fastify|hono|koa|elysia|@hono/.+|@nestjs/.+|@trpc/.+)(/|$)",
    "effect/http-api (HttpApi) for HTTP, or effect/rpc for RPC",
  ],
  ["^(inversify|tsyringe|typedi)(/|$)", "Context.Service and Layer"],
  [
    "^(drizzle-orm|kysely|@prisma/client|typeorm|knex|mongoose|sequelize)(/|$)",
    "effect/sql (SqlClient, SqlSchema, Model) with a @effect/sql-* driver in @/platform",
  ],
  [
    "^(p-retry|p-limit|p-queue|p-map|async-retry|bottleneck|async)(/|$)",
    "Effect.retry with Schedule, Effect.forEach({ concurrency }) and Semaphore",
  ],
  ["^(rxjs)(/|$)", "effect/Stream"],
  ["^(commander|yargs|cac|meow)(/|$)", "effect/cli"],
  [
    "^(openai|@anthropic-ai/sdk|ai)(/|$)",
    "effect/ai with an @effect/ai-* provider layer in @/platform",
  ],
];

const imports = {
  everywhere: [
    pattern(
      "^(effect(/[a-z][a-z-]*)?|@effect/[a-z][a-z-]*)$",
      `Import each Effect module from its own path: import * as Effect from "effect/Effect", import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder". Barrels like "effect" or "effect/http" pull in every module for bundlers without deep scope analysis ${doc("effect-imports")}.`,
    ),
    pattern(
      "^effect/(unstable|internal|dist|src)(/|$)",
      `Use the public v4 path: effect/unstable/<module> became effect/<module>, and internals are not part of the API ${doc("effect-imports")}.`,
    ),
    pattern(
      "^effect/(Either|FiberRef|Runtime|JSONSchema|TestClock|FastCheck)$",
      `This is a v3 module. v4 names: Either → effect/Result, FiberRef → Context.Reference, JSONSchema → effect/JsonSchema, TestClock → effect/testing/TestClock, FastCheck → fast-check, Runtime → removed ${doc("effect-imports")}.`,
    ),
    pattern(
      "^@effect/(platform|schema|rpc|cluster|cli|ai|sql|experimental|workflow)(/|$)",
      `This v3 package is part of effect in v4: @effect/platform/HttpClient → effect/http/HttpClient, @effect/platform/HttpApi → effect/http-api/HttpApi, @effect/schema → effect/Schema ${doc("effect-imports")}.`,
    ),
    pattern(
      "^zod(/|$)",
      `Effect code validates with Schema: import * as Schema from "effect/Schema". One schema library means one decode path and errors that carry a type ${doc("effect-errors")}.`,
    ),
    ...overlapping.map(([regex, instead]) =>
      pattern(
        regex,
        `In Effect code use ${instead}: one library, typed errors in the Effect channel, and testable services ${doc("effect-libraries")}.`,
      ),
    ),
  ],
  outsidePlatform: [
    pattern(
      "^(@effect/(platform-[a-z-]+|sql-[a-z-]+|opentelemetry|ai-[a-z-]+)|@opentelemetry/.+)(/|$)",
      `Runtime, driver and telemetry packages live behind @/platform. Export a Layer (or runMain) from a file there ${doc("effect-platform")}.`,
    ),
    pattern(
      "^effect/(Logger|http/FetchHttpClient)$",
      `Loggers and HTTP client implementations are chosen once in @/platform. Log with Effect.log*, and depend on HttpClient.HttpClient ${doc("effect-logging")}.`,
    ),
  ],
  belowApp: [
    pattern(
      "^effect/http/(HttpRouter|HttpServer|HttpServerRequest|HttpServerResponse)$",
      `Endpoints are schema-first: declare one with HttpApiEndpoint in src/data/api and implement it with HttpApiBuilder.group. Hand-written routes skip validation, OpenAPI and the typed client ${doc("effect-http-api")}.`,
    ),
  ],
  outsideData: [
    pattern(
      "^effect/http-api/(HttpApi|HttpApiGroup|HttpApiEndpoint)$",
      `The HTTP contract (HttpApi, groups, endpoints) lives in src/data/api, separate from the server, so clients can import it without server code ${doc("effect-http-api")}.`,
    ),
  ],
  data: [
    pattern(
      "^effect/http-api/(HttpApiBuilder|HttpApiScalar|HttpApiSwagger)$",
      `src/data/api holds the contract only. Implement handlers with HttpApiBuilder in src/features, and serve docs from src/app ${doc("effect-http-api")}.`,
    ),
  ],
};

const genWrapper = `Use Effect.fn("name")(function* (...) { ... }) instead of a function that only returns Effect.gen. It names the span and keeps stack traces ${doc("effect-style")}.`;
const v3Renames = [
  ["catchAll", "catch"],
  ["catchAllCause", "catchCause"],
  ["catchAllDefect", "catchDefect"],
  ["catchSome", "catchFilter"],
  ["catchSomeCause", "catchCauseFilter"],
  ["fork", "forkChild"],
  ["forkDaemon", "forkDetach"],
];

const syntax = {
  everywhere: [
    rule(
      "ImportDeclaration[source.value=/^(effect|@effect\\/[a-z-]+)\\/([a-z-]+\\/)*[A-Z]/] > ImportSpecifier",
      `Import the module as a namespace: import * as Effect from "effect/Effect" (or import type * as ...). One import style, and every call reads Module.fn ${doc("effect-imports")}.`,
    ),
    rule(
      "ArrowFunctionExpression[body.callee.object.name='Effect'][body.callee.property.name='gen']",
      genWrapper,
    ),
    rule(
      "ArrowFunctionExpression[body.callee.property.name='pipe'][body.callee.object.callee.object.name='Effect'][body.callee.object.callee.property.name='gen']",
      genWrapper,
    ),
    rule(
      ":function > BlockStatement[body.length=1] > ReturnStatement[argument.callee.object.name='Effect'][argument.callee.property.name='gen']",
      genWrapper,
    ),
    rule(
      "CallExpression[callee.property.name='pipe'][callee.object.callee.callee.object.name='Effect'][callee.object.callee.callee.property.name=/^fn(Untraced)?$/]",
      `Do not .pipe an Effect.fn. Pass the combinators as extra arguments: Effect.fn("name")(function* () {...}, Effect.catchTag(...)) ${doc("effect-style")}.`,
    ),
    rule(
      "CallExpression[callee.property.name='pipe'][callee.object.callee.object.name='Effect'][callee.object.callee.property.name=/^fn(Untraced)?$/]",
      `Do not .pipe an Effect.fn. Pass the combinators as extra arguments: Effect.fn("name")(function* () {...}, Effect.catchTag(...)) ${doc("effect-style")}.`,
    ),
    rule(
      "VariableDeclarator > CallExpression.init[callee.object.name='Effect'][callee.property.name='fn']",
      `Name a reusable Effect.fn after its variable: const getUser = Effect.fn("getUser")(function* ...). Use Effect.fnUntraced when it is not a useful tracing span ${doc("effect-style")}.`,
    ),
    rule(
      "FunctionExpression[generator=true] ExpressionStatement > CallExpression[callee.object.name=/^(Effect|Layer|Console|Ref|Queue|Fiber)$/]",
      `This effect is built and dropped, so it never runs. Write yield* in front of it, or chain it with Effect.andThen / Effect.tap ${doc("effect-style")}.`,
    ),
    rule(
      "ExpressionStatement > YieldExpression[delegate=true][argument.type='NewExpression']",
      `Write return yield* new SomeError(...), so TypeScript knows the generator stops here ${doc("effect-errors")}.`,
    ),
    rule(
      "FunctionExpression[generator=true] ThrowStatement",
      `Do not throw inside Effect code: a throw becomes an untyped defect. Fail with a typed error: return yield* new SomeError({...}) ${doc("effect-errors")}.`,
    ),
    rule(
      "MemberExpression[object.name='Data'][property.name=/^(TaggedError|Error)$/]",
      `Define errors with Schema.TaggedError<E>()("E", { ...fields }, { httpApiStatus }). HttpApi can then encode them and the typed client can decode them ${doc("effect-errors")}.`,
    ),
    rule(
      `${effectCall("fail|die")} > NewExpression[callee.name=/^(Error|TypeError|RangeError)$/]`,
      `Fail with a Schema.TaggedError, not a bare Error, so callers can catchTag it and HttpApi can map it to a status ${doc("effect-errors")}.`,
    ),
    rule(
      "ClassDeclaration[superClass.name=/^(Error|TypeError|RangeError)$/]",
      `Define errors with Schema.TaggedError<E>()("E", { ...fields }), not by extending Error ${doc("effect-errors")}.`,
    ),
    ...v3Renames.map(([from, to]) =>
      rule(
        `MemberExpression[object.name='Effect'][property.name='${from}']`,
        `Effect.${from} is the v3 name. In v4 it is Effect.${to} ${doc("effect-errors")}.`,
      ),
    ),
    rule(
      "MemberExpression[object.name='Context'][property.name=/^(Tag|GenericTag)$/]",
      `v4 services use Context.Service<Self, Shape>()("package/path/Name") ${doc("effect-services")}.`,
    ),
    rule(
      "MemberExpression[object.name='Effect'][property.name=/^(Service|Tag)$/]",
      `v4 services use Context.Service<Self, Shape>()("package/path/Name"), with a static layer built by Layer.effect ${doc("effect-services")}.`,
    ),
    rule(
      "CallExpression[callee.type='CallExpression'][callee.callee.object.name='Context'][callee.callee.property.name='Service'][arguments.0.value!=/\\//]",
      `Give the service a global identifier with the package and folder path: "my-service/features/prices/Prices" ${doc("effect-services")}.`,
    ),
    rule(
      "Property[key.name=/^(success|payload|params|query|headers|error)$/] > MemberExpression.value[object.name='Schema'][property.name=/^(Any|Unknown)$/]",
      `Declare the real schema. The endpoint schema validates input, encodes output, and generates OpenAPI and the typed client ${doc("effect-http-api")}.`,
    ),
    rule(
      `${effectCall("log|logTrace|logDebug|logInfo|logWarning|logError|logFatal")} > TemplateLiteral[expressions.length>0]`,
      `Keep the message constant and put values in fields: Effect.logInfo("price served").pipe(Effect.annotateLogs({ ticker })) ${doc("effect-logging")}.`,
    ),
    rule(
      effectCall("promise"),
      `Effect.promise turns a rejection into a defect. Wrap the Promise API once in @/platform with Effect.tryPromise({ try, catch: (cause) => new SomeError({ cause }) }) ${doc("effect-platform")}.`,
    ),
  ],
  outsideApp: [
    rule(
      effectCall("runPromise|runPromiseExit|runSync|runSyncExit|runFork|runCallback"),
      `Run effects only at the edge: src/app/main.ts calls runMain once, and tests may run effects. Everywhere else, return the Effect ${doc("effect-running")}.`,
    ),
    rule(
      "CallExpression[callee.property.name='runMain']",
      `Run effects only at the edge: src/app/main.ts calls runMain once ${doc("effect-running")}.`,
    ),
    rule(
      "MemberExpression[object.name='ManagedRuntime']",
      `A ManagedRuntime bridges Effect into non-Effect code. Build it once in src/app ${doc("effect-running")}.`,
    ),
    rule(
      effectCall("provide|provideService|provideServiceEffect"),
      `Provide layers once, in src/app. Below it, declare what you need with yield* SomeService and compose layers with Layer.provide ${doc("effect-services")}.`,
    ),
  ],
  outsidePlatform: [
    rule(
      effectCall("tryPromise"),
      `Promise APIs are wrapped once in @/platform with Effect.tryPromise and a tagged error. Call that wrapper here ${doc("effect-platform")}.`,
    ),
    rule(
      ":function[async=true]",
      `Effect code has no async functions. Return an Effect, or wrap the Promise API in @/platform with Effect.tryPromise ${doc("effect-platform")}.`,
    ),
  ],
  outsideConfig: [
    rule(
      "MemberExpression[object.name=/^(Config|ConfigProvider)$/]",
      `Read configuration in src/config only: expose it as a service with a layer there (AppConfig.layer), and yield* it where it is needed ${doc("effect-config")}.`,
    ),
  ],
};

const layoutRules = {
  rootApi: rule(
    "CallExpression[callee.object.name='HttpApi'][callee.property.name='make']",
    `The service has one HttpApi, in src/data/api/Api.ts. Add your group to it there ${doc("effect-api-layout")}.`,
  ),
  group: rule(
    "CallExpression[callee.object.name=/^(HttpApiGroup|HttpApiEndpoint)$/]",
    `Groups and endpoints live in src/data/api/<group>/<Group>Api.ts, one group per file ${doc("effect-api-layout")}.`,
  ),
  error: rule(
    "MemberExpression[object.name='Schema'][property.name=/^(TaggedError|ErrorClass)$/]",
    `Errors live in an errors.ts file: src/data/api/<group>/errors.ts for errors on the wire, src/features/<name>/errors.ts for internal ones ${doc("effect-api-layout")}.`,
  ),
  handlers: rule(
    "CallExpression[callee.object.name='HttpApiBuilder'][callee.property.name='group']",
    `Handlers live in src/features/<group>/handlers.ts, named after the group they implement ${doc("effect-api-layout")}.`,
  ),
  schemaInApi: rule(
    "MemberExpression[object.name='Schema'][property.name=/^(Class|TaggedClass|Struct|TaggedStruct)$/]",
    `Declare payload and response schemas in the group's schemas.ts and import them here ${doc("effect-api-layout")}.`,
  ),
  serviceInHandlers: rule(
    "MemberExpression[object.name='Context'][property.name='Service']",
    `A service gets its own file, src/features/<name>/<Service>.ts. handlers.ts only maps endpoints to service calls ${doc("effect-api-layout")}.`,
  ),
  serviceLayer: rule(
    "ClassDeclaration[superClass.callee.callee.object.name='Context'][superClass.callee.callee.property.name='Service']:not(:has(ClassBody > PropertyDefinition[static=true][key.name='layer']))",
    `Give every service its production layer as static readonly layer, so src/app wires X.layer and tests swap in another static layer ${doc("effect-api-layout")}.`,
  ),
};

const defaultLayout = ["rootApi", "group", "error", "handlers", "serviceLayer"];
/** File roles of the enforced API layout: which layout bans each role lifts and which it adds. */
export const effectRoles = [
  { name: "root-api", folder: "data", files: ["src/data/api/Api.ts"], allow: ["rootApi"], add: [] },
  {
    name: "group",
    folder: "data",
    files: ["src/data/api/*/*Api.ts"],
    allow: ["group"],
    add: ["schemaInApi"],
  },
  {
    name: "errors",
    folder: "data",
    files: ["src/data/api/*/errors.ts"],
    allow: ["error"],
    add: [],
  },
  {
    name: "feature-errors",
    folder: "features",
    files: ["src/features/*/errors.ts"],
    allow: ["error"],
    add: [],
  },
  {
    name: "handlers",
    folder: "features",
    files: ["src/features/*/handlers.ts"],
    allow: ["handlers"],
    add: ["serviceInHandlers"],
  },
];

const layout = (role, test) => {
  if (test) {
    return [];
  }
  const allowed = new Set(role?.allow ?? []);
  return [...defaultLayout.filter((id) => !allowed.has(id)), ...(role?.add ?? [])].map(
    (id) => layoutRules[id],
  );
};

const raw = (what, instead) =>
  `${what}: ${instead}. Effect's version is testable (TestClock, test layers) ${doc("effect-platform")}.`;
const rawSyntax = [
  rule(
    "CallExpression[callee.name='fetch']",
    raw(
      "Network access",
      "depend on HttpClient.HttpClient from effect/http/HttpClient; @/platform provides the layer",
    ),
  ),
  rule(
    "CallExpression[callee.name=/^(setTimeout|setInterval|setImmediate)$/]",
    raw("Scheduling", "use Effect.sleep, Effect.repeat or Schedule"),
  ),
  rule(
    "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    raw("Reading the time", "use DateTime.now or Clock.currentTimeMillis"),
  ),
  rule(
    "NewExpression[callee.name='Date'][arguments.length=0]",
    raw("Reading the time", "use DateTime.now or Clock.currentTimeMillis"),
  ),
  rule(
    "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    raw("Randomness", "use the Random module"),
  ),
  rule(
    "MemberExpression[object.name='console']",
    raw("Logging", "use Effect.logInfo / logWarning / logError"),
  ),
];

/** Import patterns the Effect preset adds to a folder's override. `folder` is undefined outside the layers. */
export const effectImports = (folder, { test }) => [
  ...imports.everywhere,
  ...(test || folder === "platform" ? [] : imports.outsidePlatform),
  ...(test || folder === "app" || folder === "platform" ? [] : imports.belowApp),
  ...(test || folder === "data" ? [] : imports.outsideData),
  ...(folder === "data" && !test ? imports.data : []),
];

/** no-restricted-syntax entries the Effect preset adds to a folder's override. */
export const effectSyntax = (folder, { test, role }) => [
  ...syntax.everywhere,
  ...layout(role, test),
  ...(test || folder === "app" ? [] : syntax.outsideApp),
  ...(test || folder === "platform" ? [] : syntax.outsidePlatform),
  ...(test || folder === "config" ? [] : syntax.outsideConfig),
];

/** Replaces the base preset's raw-runtime messages with the Effect equivalent of each API. */
export const effectRawSyntax = rawSyntax;

// why: Effect.fn(function* () { return x }) without a yield is normal Effect code, and `_tag` is how
// why: Effect discriminates errors and unions, so these two category rules would only produce noise.
export const effectRuleSettings = {
  "require-yield": "off",
  "no-underscore-dangle": ["error", { allow: ["_tag"] }],
};
