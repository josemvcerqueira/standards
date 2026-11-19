#!/usr/bin/env node
// why: lint rules only bind if nobody can quietly switch them off. This check fails the gate when a repo
// why: weakens its lint, format or compiler settings, or disables a protected rule in source.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const standards = new URL("../", import.meta.url);
const problems = [];
const fail = (where, what) => problems.push(`${where}: ${what} (STANDARD.md#enforcement)`);

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(join(root, path), "utf8"));
  } catch {
    fail(path, "missing or not valid JSON");
    return undefined;
  }
};

const PRESETS = ["oxlint/base.json", "oxlint/react.json"];
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
      "must extend @interest-protocol/standards/oxlint/base.json or react.json",
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

function checkTsconfig() {
  const config = readJson("tsconfig.json");
  if (config === undefined) {
    return;
  }
  if (config.extends !== "@interest-protocol/standards/tsconfig.base.json") {
    fail("tsconfig.json", 'must extend "@interest-protocol/standards/tsconfig.base.json"');
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

checkLintConfig();
checkTsconfig();
checkFormatConfig();
checkSource();

if (problems.length > 0) {
  process.stderr.write(
    `House standard check failed:\n${problems.map((line) => `  ${line}`).join("\n")}\n`,
  );
  process.exit(1);
}
process.stdout.write("House standard check passed.\n");
