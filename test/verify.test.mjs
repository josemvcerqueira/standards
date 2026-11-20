import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const verify = new URL("../bin/verify.mjs", import.meta.url).pathname;
const template = new URL("./verify-repo/", import.meta.url).pathname;

const repo = (change) => {
  const dir = mkdtempSync(join(tmpdir(), "verify-"));
  for (const file of [".oxlintrc.json", ".oxfmtrc.json", "tsconfig.json"]) {
    cpSync(join(template, file), join(dir, file));
  }
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "package.json"), '{"name":"svc","packageManager":"bun@1.4.4"}');
  writeFileSync(join(dir, "src/ok.ts"), "export const ok = 1;\n");
  change?.(dir);
  return spawnSync(process.execPath, [verify], { cwd: dir, encoding: "utf8" });
};

test("the template passes", () => {
  const result = repo();
  assert.equal(result.status, 0, result.stderr);
});

const effectLint = '{"extends":["./node_modules/@interest-protocol/standards/oxlint/effect.json"]}';
const effectManifest = (deps) =>
  JSON.stringify({
    name: "svc",
    packageManager: "bun@1.4.4",
    dependencies: deps,
    devDependencies: { "@effect/language-service": "0.87.5" },
  });
const effectRepo = (change) =>
  repo((dir) => {
    writeFileSync(join(dir, ".oxlintrc.json"), effectLint);
    writeFileSync(
      join(dir, "tsconfig.json"),
      '{"extends":"@interest-protocol/standards/tsconfig.effect.json"}',
    );
    writeFileSync(
      join(dir, "package.json"),
      effectManifest({ effect: "4.1.4", "@effect/platform-bun": "4.1.4" }),
    );
    mkdirSync(join(dir, "src/data/api/prices"), { recursive: true });
    mkdirSync(join(dir, "src/features/prices"), { recursive: true });
    writeFileSync(join(dir, "src/data/api/Api.ts"), "export const api = 1;\n");
    writeFileSync(
      join(dir, "src/data/api/prices/PricesApi.ts"),
      'export class PricesApi extends HttpApiGroup.make(\n  "prices",\n) {}\n',
    );
    writeFileSync(join(dir, "src/data/api/prices/schemas.ts"), "export const s = 1;\n");
    writeFileSync(
      join(dir, "src/features/prices/handlers.ts"),
      'export const h = HttpApiBuilder.group(\n  Api,\n  "prices",\n);\n',
    );
    writeFileSync(join(dir, "src/features/prices/Prices.ts"), "export const p = 1;\n");
    change?.(dir);
  });

test("an Effect repo with the Effect preset, one pinned version and the API layout passes", () => {
  const result = effectRepo();
  assert.equal(result.status, 0, result.stderr);
});

const effectFailures = [
  [
    "Effect without the Effect lint preset",
    (dir) =>
      writeFileSync(
        join(dir, ".oxlintrc.json"),
        '{"extends":["./node_modules/@interest-protocol/standards/oxlint/base.json"]}',
      ),
    "must extend @interest-protocol/standards/oxlint/effect.json",
  ],
  [
    "Effect without the Effect tsconfig",
    (dir) =>
      writeFileSync(
        join(dir, "tsconfig.json"),
        '{"extends":"@interest-protocol/standards/tsconfig.base.json"}',
      ),
    'must extend "@interest-protocol/standards/tsconfig.effect.json"',
  ],
  [
    "Effect without the language service",
    (dir) =>
      writeFileSync(
        join(dir, "package.json"),
        '{"name":"svc","packageManager":"bun@1.4.4","dependencies":{"effect":"4.1.4"}}',
      ),
    "needs @effect/language-service",
  ],
  [
    "an Effect version range",
    (dir) => writeFileSync(join(dir, "package.json"), effectManifest({ effect: "^4.1.4" })),
    "pin effect to an exact 4.x.y version",
  ],
  [
    "Effect packages on different versions",
    (dir) =>
      writeFileSync(
        join(dir, "package.json"),
        effectManifest({ effect: "4.1.4", "@effect/platform-bun": "4.1.3" }),
      ),
    "must share one version",
  ],
  [
    "a stray file in src/data/api",
    (dir) => writeFileSync(join(dir, "src/data/api/helpers.ts"), "export const x = 1;\n"),
    "holds only Api.ts and one folder per group",
  ],
  [
    "a stray file in a group folder",
    (dir) => writeFileSync(join(dir, "src/data/api/prices/types.ts"), "export const x = 1;\n"),
    "holds only PricesApi.ts, schemas.ts and errors.ts",
  ],
  [
    "a group whose id does not match its folder",
    (dir) =>
      writeFileSync(
        join(dir, "src/data/api/prices/PricesApi.ts"),
        'export class PricesApi extends HttpApiGroup.make("quotes") {}\n',
      ),
    "the group id matches its folder",
  ],
  [
    "handlers for a group that does not exist",
    (dir) => {
      mkdirSync(join(dir, "src/features/orders"));
      writeFileSync(join(dir, "src/features/orders/handlers.ts"), "export const h = 1;\n");
    },
    "src/data/api/orders/ must declare it",
  ],
  [
    "a feature file outside the layout",
    (dir) => writeFileSync(join(dir, "src/features/prices/utils.ts"), "export const x = 1;\n"),
    "one PascalCase file per service",
  ],
];

for (const [name, change, message] of effectFailures) {
  test(`fails on ${name}`, () => {
    const result = effectRepo(change);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

const failures = [
  [
    "a rule switched off",
    (dir) =>
      writeFileSync(
        join(dir, ".oxlintrc.json"),
        '{"extends":["./node_modules/@interest-protocol/standards/oxlint/base.json"],"rules":{"curly":"warn"}}',
      ),
    "never weaken",
  ],
  [
    "the preset dropped",
    (dir) => writeFileSync(join(dir, ".oxlintrc.json"), '{"rules":{}}'),
    "must extend",
  ],
  [
    "strictness turned off",
    (dir) =>
      writeFileSync(
        join(dir, "tsconfig.json"),
        '{"extends":"@interest-protocol/standards/tsconfig.base.json","compilerOptions":{"strict":false}}',
      ),
    "may not turn off strict",
  ],
  [
    "a changed formatter config",
    (dir) => writeFileSync(join(dir, ".oxfmtrc.json"), '{"printWidth":120}'),
    "must be a copy",
  ],
  [
    "a protected rule disabled",
    (dir) =>
      writeFileSync(
        join(dir, "src/x.ts"),
        "// oxlint-disable-next-line no-restricted-imports -- once\nexport const x = 1;\n",
      ),
    "cannot be disabled",
  ],
  [
    "a file-wide disable",
    (dir) => writeFileSync(join(dir, "src/x.ts"), "/* oxlint-disable */\nexport const x = 1;\n"),
    "file-wide",
  ],
  [
    "@ts-ignore",
    (dir) => writeFileSync(join(dir, "src/x.ts"), "// @ts-ignore\nexport const x: number = 'a';\n"),
    "@ts-ignore",
  ],
  [
    "npm as the package manager",
    (dir) =>
      writeFileSync(join(dir, "package.json"), '{"name":"svc","packageManager":"npm@11.6.2"}'),
    "packageManager",
  ],
  [
    "an npm lockfile",
    (dir) => writeFileSync(join(dir, "package-lock.json"), "{}"),
    "only bun.lock",
  ],
];

for (const [name, change, message] of failures) {
  test(`fails on ${name}`, () => {
    const result = repo(change);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(message));
  });
}

const monorepo = (change) => {
  const dir = mkdtempSync(join(tmpdir(), "verify-mono-"));
  cpSync(join(template, ".oxfmtrc.json"), join(dir, ".oxfmtrc.json"));
  writeFileSync(
    join(dir, "package.json"),
    '{"name":"root","packageManager":"bun@1.4.4","workspaces":["apps/*","packages/*"]}',
  );
  const workspace = (path, manifest) => {
    mkdirSync(join(dir, path, "src"), { recursive: true });
    for (const file of [".oxlintrc.json", "tsconfig.json"]) {
      cpSync(join(template, file), join(dir, path, file));
    }
    writeFileSync(join(dir, path, "package.json"), JSON.stringify(manifest));
    writeFileSync(join(dir, path, "src/index.ts"), "export const ok = 1;\n");
  };
  workspace("apps/api", { name: "@acme/api", dependencies: { "@acme/core": "*" } });
  workspace("packages/core", { name: "@acme/core", exports: { ".": "./src/index.ts" } });
  change?.(dir, workspace);
  return spawnSync(process.execPath, [verify], { cwd: dir, encoding: "utf8" });
};

test("a monorepo with apps importing packages passes", () => {
  const result = monorepo();
  assert.equal(result.status, 0, result.stderr);
});

test("fails when a package depends on an app", () => {
  const result = monorepo((_, workspace) =>
    workspace("packages/ui", {
      name: "@acme/ui",
      exports: { ".": "./src/index.ts" },
      dependencies: { "@acme/api": "*" },
    }),
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /packages\/ui\/package\.json: depends on the app @acme\/api/);
});

test("fails when a package has no public entry", () => {
  const result = monorepo((_, workspace) => workspace("packages/raw", { name: "@acme/raw" }));
  assert.match(
    result.stderr,
    /packages\/raw\/package\.json: a workspace package must declare "exports"/,
  );
});

test("checks every workspace's lint config", () => {
  const result = monorepo((dir) =>
    writeFileSync(join(dir, "apps/api/.oxlintrc.json"), '{"rules":{}}'),
  );
  assert.match(result.stderr, /apps\/api\/\.oxlintrc\.json: must extend/);
});
