import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const fixtures = new URL("./effect-fixtures/", import.meta.url);
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
const textsAt = (file, line) =>
  found.filter((d) => d.file === file && d.line === line).map((d) => d.text);

const bad = "src/features/bad/";
const expected = [
  [`${bad}imports.ts`, 1, "effect-imports", "Barrels like"],
  [`${bad}imports.ts`, 2, "effect-imports", "Barrels like"],
  [`${bad}imports.ts`, 3, "effect-imports", "Import the module as a namespace"],
  [`${bad}imports.ts`, 4, "effect-imports", "effect/unstable/<module> became effect/<module>"],
  [`${bad}imports.ts`, 5, "effect-imports", "This is a v3 module"],
  [`${bad}imports.ts`, 6, "effect-imports", "This v3 package is part of effect in v4"],
  [`${bad}imports.ts`, 7, "effect-errors", "Effect code validates with Schema"],
  [`${bad}imports.ts`, 8, "effect-platform", "Runtime, driver and telemetry packages"],
  [`${bad}imports.ts`, 9, "effect-logging", "Loggers and HTTP client implementations"],
  [`${bad}imports.ts`, 10, "effect-http-api", "Endpoints are schema-first"],
  [`${bad}imports.ts`, 11, "effect-http-api", "The HTTP contract"],
  [`${bad}style.ts`, 2, "effect-style", "instead of a function that only returns Effect.gen"],
  [`${bad}style.ts`, 6, "effect-style", "instead of a function that only returns Effect.gen"],
  [`${bad}style.ts`, 11, "effect-style", "instead of a function that only returns Effect.gen"],
  [`${bad}style.ts`, 15, "effect-style", "Do not .pipe an Effect.fn"],
  [`${bad}style.ts`, 18, "effect-style", "Name a reusable Effect.fn"],
  [`${bad}style.ts`, 22, "effect-style", "built and dropped"],
  [`${bad}style.ts`, 25, "effect-style", "Do not .pipe an Effect.fn"],
  [`${bad}errors.ts`, 6, "effect-errors", "return yield* new SomeError"],
  [`${bad}errors.ts`, 9, "effect-errors", "Do not throw inside Effect code"],
  [`${bad}errors.ts`, 11, "effect-errors", "Define errors with Schema.TaggedError"],
  [`${bad}errors.ts`, 12, "effect-errors", "not a bare Error"],
  [`${bad}errors.ts`, 13, "effect-errors", "not by extending Error"],
  [`${bad}errors.ts`, 14, "effect-errors", "Effect.catchAll is the v3 name"],
  [`${bad}errors.ts`, 15, "effect-errors", "Effect.fork is the v3 name"],
  [`${bad}services.ts`, 6, "effect-services", "v4 services use Context.Service"],
  [`${bad}services.ts`, 7, "effect-services", "v4 services use Context.Service"],
  [`${bad}services.ts`, 8, "effect-services", "global identifier"],
  [`${bad}services.ts`, 9, "effect-running", "Run effects only at the edge"],
  [`${bad}services.ts`, 10, "effect-services", "Provide layers once, in src/app"],
  [`${bad}services.ts`, 11, "effect-platform", "Effect.promise turns a rejection into a defect"],
  [`${bad}services.ts`, 12, "effect-platform", "Promise APIs are wrapped once in @/platform"],
  [`${bad}services.ts`, 13, "effect-platform", "no async functions"],
  [`${bad}services.ts`, 16, "effect-running", "calls runMain once"],
  [`${bad}services.ts`, 17, "effect-running", "ManagedRuntime"],
  [`${bad}runtime.ts`, 3, "effect-config", "Read configuration in src/config only"],
  [`${bad}runtime.ts`, 4, "effect-logging", "Keep the message constant"],
  [`${bad}runtime.ts`, 5, "effect-platform", "use DateTime.now"],
  [`${bad}runtime.ts`, 6, "effect-platform", "use Effect.sleep"],
  [`${bad}runtime.ts`, 7, "effect-platform", "use Effect.logInfo"],
  ["src/data/api/bad/BadApi.ts", 2, "effect-http-api", "holds the contract only"],
  ["src/data/api/bad/BadApi.ts", 4, "effect-http-api", "Declare the real schema"],
  ["src/data/api/bad/BadApi.ts", 6, "effect-api-layout", "in the group's schemas.ts"],
  [`${bad}layout.ts`, 6, "effect-api-layout", "The service has one HttpApi"],
  [`${bad}layout.ts`, 7, "effect-api-layout", "Groups and endpoints live in"],
  [`${bad}layout.ts`, 8, "effect-api-layout", "Errors live in an errors.ts file"],
  [`${bad}layout.ts`, 9, "effect-api-layout", "Handlers live in src/features/<group>/handlers.ts"],
  [`${bad}layout.ts`, 10, "effect-api-layout", "static readonly layer"],
  [`${bad}handlers.ts`, 3, "effect-api-layout", "A service gets its own file"],
  [`${bad}docs.ts`, 2, "effect-http-api", "HttpApiSwagger embeds a 2 MB Swagger UI"],
  [`${bad}docs.ts`, 4, "effect-http-api", "HttpApiScalar.layer embeds the 3.2 MB Scalar app"],
  [`${bad}docs.ts`, 5, "effect-http-api", "Pin the Scalar version"],
  [`${bad}docs.ts`, 6, "effect-http-api", "Pin the Scalar version"],
  [`${bad}imports2.ts`, 1, "effect-libraries", "effect/Match"],
  [`${bad}imports2.ts`, 2, "effect-libraries", "effect/DateTime"],
  [`${bad}imports2.ts`, 3, "effect-libraries", "effect/http-api (HttpApi)"],
  [`${bad}imports2.ts`, 4, "effect-libraries", "effect/sql"],
  [`${bad}imports2.ts`, 5, "effect-libraries", "Effect.retry with Schedule"],
];

for (const [file, line, section, phrase] of expected) {
  test(`effect preset: ${section} fires at ${file}:${line}`, () => {
    const texts = textsAt(file, line);
    assert.ok(
      texts.some((text) => text.includes(phrase) && text.includes(`STANDARD.md#${section}`)),
      `got ${JSON.stringify(texts)}`,
    );
  });
}

test("effect preset: the starter's own code passes (contract, services, handlers, tests, main)", () => {
  const noise = found.filter(
    (d) => !d.file.startsWith(bad) && !d.file.startsWith("src/data/api/bad/"),
  );
  assert.deepEqual(noise, []);
});

test("effect preset: every Effect section cited in a message exists in STANDARD.md", () => {
  const preset = readFileSync(new URL("../oxlint/effect.json", import.meta.url), "utf8");
  const standard = readFileSync(new URL("../STANDARD.md", import.meta.url), "utf8");
  const sections = new Set(preset.match(/STANDARD\.md#effect[a-z-]*/g));
  assert.ok(sections.size >= 8);
  for (const section of sections) {
    const heading = section.replace("STANDARD.md#", "");
    assert.ok(
      standard.split("\n").some(
        (l) =>
          /^#+ /.test(l) &&
          l
            .replace(/^#+ /, "")
            .toLowerCase()
            .replaceAll(" ", "-")
            .replace(/[^a-z-]/g, "") === heading,
      ),
      `STANDARD.md has no heading for #${heading}`,
    );
  }
});

test("effect preset: base and react presets are unchanged by the Effect rules", () => {
  const base = readFileSync(new URL("../oxlint/base.json", import.meta.url), "utf8");
  assert.ok(!base.includes("effect-"));
});
