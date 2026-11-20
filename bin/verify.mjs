#!/usr/bin/env bun
// why: lint rules only bind if nobody can quietly switch them off. This check fails the gate when a repo
// why: weakens its lint, format or compiler settings, or disables a protected rule in source.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const repoRoot = process.cwd();
let root = repoRoot;
const standards = new URL("../", import.meta.url);
const problems = [];
const fail = (where, what) => {
  const prefix = root === repoRoot ? "" : `${relative(repoRoot, root)}/`;
  const link = what.includes("STANDARD.md#") ? "" : " (STANDARD.md#enforcement)";
  problems.push(`${prefix}${where}: ${what}${link}`);
};

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    fail(path, "missing or not valid JSON");
    return undefined;
  }
};

const PRESETS = ["oxlint/base.json", "oxlint/react.json", "oxlint/effect.json"];
const WEAK = new Set(["off", "warn", "allow", 0, 1]);
const severity = (value) => (Array.isArray(value) ? value[0] : value);

function checkLintConfig() {
  const config = readJson(".oxlintrc.json");
  if (config === undefined) {
    return;
  }
  const extendsList = config.extends ?? [];
  if (
    !extendsList.some((path) =>
      PRESETS.some((preset) => path.endsWith(`@interest-protocol/standards/${preset}`)),
    )
  ) {
    fail(
      ".oxlintrc.json",
      "must extend @interest-protocol/standards/oxlint/base.json, react.json or effect.json",
    );
  }
  const ruleSets = [
    config.rules ?? {},
    ...(config.overrides ?? []).map((override) => override.rules ?? {}),
  ];
  for (const rules of ruleSets) {
    for (const [rule, value] of Object.entries(rules)) {
      if (WEAK.has(severity(value))) {
        fail(
          ".oxlintrc.json",
          `sets ${rule} to ${JSON.stringify(severity(value))}; repos may add rules, never weaken them`,
        );
      }
    }
  }
  for (const key of ["ignorePatterns", "categories"]) {
    if (key in config) {
      fail(".oxlintrc.json", `may not set ${key}; ask for a change in the standards package`);
    }
  }
}

const STRICT_OPTIONS = JSON.parse(
  readFileSync(new URL("tsconfig.base.json", standards), "utf8"),
).compilerOptions;

const TSCONFIGS = [
  "@interest-protocol/standards/tsconfig.base.json",
  "@interest-protocol/standards/tsconfig.effect.json",
];

function checkTsconfig() {
  const config = readJson("tsconfig.json");
  if (config === undefined) {
    return;
  }
  if (!TSCONFIGS.includes(config.extends)) {
    fail(
      "tsconfig.json",
      'must extend "@interest-protocol/standards/tsconfig.base.json" or "@interest-protocol/standards/tsconfig.effect.json"',
    );
  }
  for (const [option, value] of Object.entries(config.compilerOptions ?? {})) {
    if (STRICT_OPTIONS[option] === true && value !== true) {
      fail("tsconfig.json", `may not turn off ${option}`);
    }
  }
}

function checkFormatConfig() {
  const expected = readFileSync(new URL("oxfmt.json", standards), "utf8");
  const actual = readJson(".oxfmtrc.json");
  if (actual !== undefined && JSON.stringify(actual) !== JSON.stringify(JSON.parse(expected))) {
    fail(".oxfmtrc.json", "must be a copy of @interest-protocol/standards/oxfmt.json");
  }
}

const PROTECTED =
  /(no-restricted-imports|no-restricted-syntax|no-restricted-properties|house\/|no-explicit-any|no-non-null-assertion|import\/no-cycle)/;
const SKIP = new Set(["node_modules", ".git", "dist", "coverage"]);

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      yield* sourceFiles(path);
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs|mts|cts)$/.test(name)) {
      yield path;
    }
  }
}

function checkSource() {
  if (!existsSync(join(root, "src"))) {
    return;
  }
  for (const path of sourceFiles(join(root, "src"))) {
    const file = relative(root, path);
    readFileSync(path, "utf8")
      .split("\n")
      .forEach((line, index) => {
        const where = `${file}:${index + 1}`;
        if (/@ts-(ignore|nocheck)\b/.test(line)) {
          fail(
            where,
            "@ts-ignore and @ts-nocheck are not allowed; fix the type or use @ts-expect-error -- reason",
          );
        }
        const disable = /(?:oxlint|eslint)-disable(-next-line|-line)?\b(.*)/.exec(line);
        if (disable === null) {
          return;
        }
        if (disable[1] === undefined) {
          fail(where, "file-wide lint disables are not allowed");
        } else if (PROTECTED.test(disable[2])) {
          fail(
            where,
            "architecture and type-safety rules cannot be disabled; change the code or the standard",
          );
        }
      });
  }
}

function workspaceDirs(patterns) {
  return patterns.flatMap((pattern) => {
    if (!pattern.endsWith("/*")) {
      return [join(repoRoot, pattern)];
    }
    const parent = join(repoRoot, pattern.slice(0, -2));
    return readdirSync(parent)
      .map((name) => join(parent, name))
      .filter((path) => statSync(path).isDirectory());
  });
}

function checkWorkspaceGraph(dirs) {
  const manifests = dirs.map((dir) => ({
    dir,
    json: JSON.parse(readFileSync(join(dir, "package.json"), "utf8")),
  }));
  const appNames = new Set(
    manifests
      .filter(({ dir }) => relative(repoRoot, dir).startsWith("apps/"))
      .map(({ json }) => json.name),
  );
  for (const { dir, json } of manifests) {
    root = dir;
    const isPackage = relative(repoRoot, dir).startsWith("packages/");
    if (isPackage && json.exports === undefined) {
      fail("package.json", 'a workspace package must declare "exports", its public entry');
    }
    const deps = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
    for (const name of Object.keys(deps)) {
      if (appNames.has(name)) {
        fail("package.json", `depends on the app ${name}; apps import packages, never the reverse`);
      }
    }
  }
  root = repoRoot;
}

const FOREIGN_LOCKFILES = [
  "package-lock.json",
  "npm-shrinkwrap.json",
  "pnpm-lock.yaml",
  "yarn.lock",
];

function checkPackageManager(manifest) {
  if (!String(manifest.packageManager ?? "").startsWith("bun@")) {
    fail("package.json", 'must set "packageManager": "bun@<version>"; the house stack uses Bun');
  }
  for (const lockfile of FOREIGN_LOCKFILES) {
    if (existsSync(join(repoRoot, lockfile))) {
      fail(lockfile, "only bun.lock is allowed; delete it and run bun install");
    }
  }
}

const EFFECT_PACKAGE = /^(effect|@effect\/.+)$/;
const EFFECT_TOOLING = new Set(["@effect/language-service", "@effect/tsgo"]);
const PASCAL = /^[A-Z][A-Za-z0-9]*$/;
const KEBAB = /^[a-z][a-z0-9-]*$/;
const pascalOf = (kebab) =>
  kebab
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
const listDir = (dir) => (existsSync(dir) ? readdirSync(dir) : []);
const isDir = (path) => statSync(path).isDirectory();

const LAYOUT = "(STANDARD.md#effect-api-layout)";
const declares = (path, pattern) => existsSync(path) && pattern.test(readFileSync(path, "utf8"));

function checkApiGroup(apiDir, name) {
  const where = `src/data/api/${name}`;
  if (!KEBAB.test(name)) {
    fail(where, `a group folder is kebab-case and matches the group id ${LAYOUT}`);
    return;
  }
  const groupFile = `${pascalOf(name)}Api.ts`;
  if (!declares(join(apiDir, name, groupFile), new RegExp(`HttpApiGroup\\.make\\(\\s*"${name}"`))) {
    fail(
      where,
      `needs ${groupFile} declaring HttpApiGroup.make("${name}"): the group id matches its folder ${LAYOUT}`,
    );
  }
  for (const file of listDir(join(apiDir, name))) {
    if (![groupFile, "schemas.ts", "errors.ts"].includes(file)) {
      fail(
        `${where}/${file}`,
        `a group folder holds only ${groupFile}, schemas.ts and errors.ts ${LAYOUT}`,
      );
    }
  }
}

function checkApiGroups() {
  const apiDir = join(root, "src/data/api");
  const groups = new Set();
  for (const name of listDir(apiDir)) {
    if (isDir(join(apiDir, name))) {
      groups.add(name);
      checkApiGroup(apiDir, name);
    } else if (name !== "Api.ts") {
      fail(
        `src/data/api/${name}`,
        `src/data/api holds only Api.ts and one folder per group ${LAYOUT}`,
      );
    }
  }
  if (groups.size > 0 && !existsSync(join(apiDir, "Api.ts"))) {
    fail("src/data/api", `needs Api.ts, the one HttpApi that adds every group ${LAYOUT}`);
  }
  return groups;
}

const isFeatureFile = (file) => {
  const base = file.replace(/(\.test)?\.ts$/, "");
  return file.endsWith(".ts") && (["handlers", "errors"].includes(base) || PASCAL.test(base));
};

function checkFeature(featuresDir, feature, groups) {
  for (const file of listDir(join(featuresDir, feature))) {
    if (!isFeatureFile(file)) {
      fail(
        `src/features/${feature}/${file}`,
        `a feature holds handlers.ts, errors.ts and one PascalCase file per service, plus their .test.ts ${LAYOUT}`,
      );
    }
  }
  const handlers = join(featuresDir, feature, "handlers.ts");
  if (!existsSync(handlers)) {
    return;
  }
  if (!groups.has(feature)) {
    fail(
      `src/features/${feature}/handlers.ts`,
      `implements a group, so src/data/api/${feature}/ must declare it ${LAYOUT}`,
    );
  } else if (!declares(handlers, new RegExp(`HttpApiBuilder\\.group\\(\\s*Api,\\s*"${feature}"`))) {
    fail(
      `src/features/${feature}/handlers.ts`,
      `must implement its own group: HttpApiBuilder.group(Api, "${feature}", ...) ${LAYOUT}`,
    );
  }
}

function checkApiLayout() {
  const groups = checkApiGroups();
  const featuresDir = join(root, "src/features");
  for (const feature of listDir(featuresDir)) {
    if (isDir(join(featuresDir, feature))) {
      checkFeature(featuresDir, feature, groups);
    }
  }
}

function checkEffect(manifest) {
  const deps = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  const effectDeps = Object.entries(deps).filter(
    ([name]) => EFFECT_PACKAGE.test(name) && !EFFECT_TOOLING.has(name),
  );
  if (effectDeps.length === 0) {
    return;
  }
  if (!("@effect/language-service" in deps)) {
    fail(
      "package.json",
      "uses Effect, so it needs @effect/language-service: the gate runs its type-aware diagnostics (STANDARD.md#effect)",
    );
  }
  const tsconfig = existsSync(join(root, "tsconfig.json")) ? readJson("tsconfig.json") : {};
  if (tsconfig?.extends !== "@interest-protocol/standards/tsconfig.effect.json") {
    fail(
      "tsconfig.json",
      'uses Effect, so it must extend "@interest-protocol/standards/tsconfig.effect.json"',
    );
  }
  checkApiLayout();
  const config = existsSync(join(root, ".oxlintrc.json")) ? readJson(".oxlintrc.json") : {};
  const extendsList = config?.extends ?? [];
  if (
    !extendsList.some((path) => path.endsWith("@interest-protocol/standards/oxlint/effect.json"))
  ) {
    fail(
      ".oxlintrc.json",
      "uses Effect, so it must extend @interest-protocol/standards/oxlint/effect.json",
    );
  }
  const versions = new Set(effectDeps.map(([, version]) => version));
  for (const [name, version] of effectDeps) {
    if (!/^4\.\d+\.\d+$/.test(version)) {
      fail(
        "package.json",
        `pin ${name} to an exact 4.x.y version, not ${JSON.stringify(version)}; Effect v4 packages release together (STANDARD.md#effect)`,
      );
    }
  }
  if (versions.size > 1) {
    fail(
      "package.json",
      `effect and @effect/* must share one version, found ${[...versions].join(", ")} (STANDARD.md#effect)`,
    );
  }
}

const manifestPath = join(repoRoot, "package.json");
const rootManifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : {};
checkFormatConfig();
checkPackageManager(rootManifest);
if (Array.isArray(rootManifest.workspaces)) {
  const dirs = workspaceDirs(rootManifest.workspaces);
  for (const dir of dirs) {
    root = dir;
    checkLintConfig();
    checkTsconfig();
    checkSource();
    checkEffect(JSON.parse(readFileSync(join(dir, "package.json"), "utf8")));
  }
  checkWorkspaceGraph(dirs);
  root = repoRoot;
} else {
  checkLintConfig();
  checkTsconfig();
  checkSource();
  checkEffect(rootManifest);
}

if (problems.length > 0) {
  process.stderr.write(
    `House standard check failed:\n${problems.map((line) => `  ${line}`).join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write("House standard check passed.\n");
