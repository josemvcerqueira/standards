import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const verify = new URL("../bin/verify.mjs", import.meta.url).pathname;
const template = new URL("../templates/ts-service/", import.meta.url).pathname;

const repo = (change) => {
  const dir = mkdtempSync(join(tmpdir(), "verify-"));
  for (const file of [".oxlintrc.json", ".oxfmtrc.json", "tsconfig.json"]) {
    cpSync(join(template, file), join(dir, file));
  }
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/ok.ts"), "export const ok = 1;\n");
  change?.(dir);
  return spawnSync(process.execPath, [verify], { cwd: dir, encoding: "utf8" });
};

test("the template passes", () => {
  const result = repo();
  assert.equal(result.status, 0, result.stderr);
});

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
];

for (const [name, change, message] of failures) {
  test(`fails on ${name}`, () => {
    const result = repo(change);
    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(message));
  });
}
