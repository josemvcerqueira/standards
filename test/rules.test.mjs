import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fixtures = new URL("./fixtures/", import.meta.url);
const oxlint = new URL("../node_modules/.bin/oxlint", import.meta.url).pathname;

const lint = () => {
  let out;
  try {
    out = execFileSync(oxlint, ["--format", "json", "src"], { cwd: fixtures, encoding: "utf8" });
  } catch (error) {
    out = error.stdout;
  }
  return JSON.parse(out).diagnostics.map((d) => ({
    file: d.filename,
    line: d.labels[0]?.span.line,
    rule: d.code,
    text: `${d.message} ${d.help ?? ""}`,
  }));
};

const found = lint();
const at = (file, line) =>
  found.filter((d) => d.file === file && d.line === line).map((d) => d.rule);

const expected = [
  ["src/lib/bad.ts", 1, "eslint(no-restricted-imports)"],
  ["src/lib/bad.ts", 2, "eslint(no-restricted-imports)"],
  ["src/lib/bad.ts", 3, "typescript(no-explicit-any)"],
  ["src/lib/bad.ts", 3, "typescript(no-non-null-assertion)"],
  ["src/lib/bad.ts", 3, "eslint-js(no-restricted-properties)"],
  ["src/lib/bad.ts", 4, "house(no-comments)"],
  ["src/lib/bad.ts", 5, "eslint-js(no-restricted-syntax)"],
  ["src/features/home/bad.tsx", 1, "eslint-js(no-restricted-syntax)"],
  ["src/features/home/bad.tsx", 2, "eslint(no-restricted-imports)"],
  ["src/features/home/bad.tsx", 5, "eslint-js(no-restricted-syntax)"],
  ["src/features/home/bad.tsx", 6, "eslint-js(no-restricted-syntax)"],
  ["src/lib/comments.ts", 8, "house(disable-needs-reason)"],
  ["src/lib/comments.ts", 14, "house(no-comments)"],
  ["src/lib/impure.ts", 1, "eslint(no-restricted-imports)"],
  ["src/features/home/raw.ts", 1, "eslint(no-restricted-imports)"],
  ["src/features/home/raw.ts", 2, "eslint(no-restricted-imports)"],
  ["src/features/home/raw.ts", 4, "eslint-js(no-restricted-syntax)"],
  ["src/features/home/raw.ts", 5, "eslint-js(no-restricted-syntax)"],
  ["src/features/home/raw.ts", 6, "eslint-js(no-restricted-syntax)"],
];

for (const [file, line, rule] of expected) {
  test(`${rule} fires at ${file}:${line}`, () => {
    assert.ok(at(file, line).includes(rule), `got ${JSON.stringify(at(file, line))}`);
  });
}

test("allowed comments, reasoned disables, tokens, config and hooks pass", () => {
  const cleanFiles = [
    "src/features/home/good.tsx",
    "src/hooks/use-tick.ts",
    "src/config/env.ts",
    "src/ui/tokens/colors.ts",
    "src/platform/clock.ts",
  ];
  const noise = found.filter((d) => cleanFiles.includes(d.file));
  assert.deepEqual(noise, []);
  const comments = found.filter((d) => d.file === "src/lib/comments.ts").map((d) => d.line);
  assert.deepEqual(
    comments.toSorted((a, b) => a - b),
    [8, 14],
  );
});

test("every house message names the fix and links STANDARD.md", () => {
  const preset = JSON.parse(readFileSync(new URL("../oxlint/react.json", import.meta.url), "utf8"));
  const messages = JSON.stringify(preset).match(/"message":"[^"]*"/g) ?? [];
  assert.ok(messages.length > 10);
  for (const message of messages) {
    assert.match(message, /STANDARD\.md#[a-z-]+/);
  }
  const plugin = readFileSync(new URL("../plugin/index.js", import.meta.url), "utf8");
  assert.match(plugin, /STANDARD\.md#comments/);
  assert.match(plugin, /STANDARD\.md#disabling-a-rule/);
});
