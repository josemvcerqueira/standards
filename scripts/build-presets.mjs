// why: Oxlint overrides replace a rule's options instead of merging them, so each folder's import and syntax
// why: rules are assembled here once and written out whole to oxlint/base.json and oxlint/react.json.
import { writeFileSync } from "node:fs";

const doc = (section) => `(STANDARD.md#${section})`;
const LAYERS = ["lib", "data", "config", "auth", "hooks", "ui", "features", "app"];

const blocks = (folders, message) => ({
  regex: `^@/(${folders.join("|")})(/|$)`,
  caseSensitive: true,
  message,
});

const noParentPaths = {
  regex: "(^|/)\\.\\.(/|$)",
  caseSensitive: true,
  message: `Folders reach each other through @/, never ../ ${doc("folders")}.`,
};
const noFeatures = blocks(
  ["features"],
  `Only src/app imports a feature. Move shared code down to @/ui, @/hooks, @/data or @/lib ${doc("folders")}.`,
);
const noApp = blocks(["app"], `Nothing imports src/app: it is the entry layer ${doc("folders")}.`);
const noAboveData = blocks(
  ["auth", "hooks", "ui"],
  `@/lib, @/data and @/config sit below @/auth, @/hooks and @/ui and never import them ${doc("folders")}.`,
);
const noTesting = blocks(
  ["testing"],
  `Production code never imports test helpers ${doc("tests")}.`,
);

const inRegex = (source) => `/${source.replaceAll("/", "\\/")}/`;
const dynamicImports = (patterns) =>
  patterns.flatMap(({ regex, message }) => [
    { selector: `ImportExpression[source.value=${inRegex(regex)}]`, message },
    {
      selector: `CallExpression[callee.name='require'][arguments.0.value=${inRegex(regex)}]`,
      message,
    },
  ]);

const sleepMessage = `No fixed sleeps or timer workarounds: wait for the event, poll with a deadline, or use the framework's scheduler ${doc("timers")}.`;
const sleeps = [
  {
    selector: "NewExpression[callee.name='Promise'] CallExpression[callee.name='setTimeout']",
    message: sleepMessage,
  },
  {
    selector: "ImportDeclaration[source.value=/^(node:)?timers\\/promises$/]",
    message: sleepMessage,
  },
  {
    selector: "ImportExpression[source.value=/^(node:)?timers\\/promises$/]",
    message: sleepMessage,
  },
];
const timerWorkarounds = [
  {
    selector:
      "CallExpression[callee.name=/^(setTimeout|requestAnimationFrame|requestIdleCallback)$/]",
    message: sleepMessage,
  },
  {
    selector:
      "CallExpression[callee.property.name=/^(setTimeout|requestAnimationFrame|requestIdleCallback)$/]",
    message: sleepMessage,
  },
];

const effectMessage = `useEffect lives only in src/hooks/: wrap the effect in a named hook, or derive the value during render ${doc("effects")}.`;
const effects = [
  {
    selector: "ImportSpecifier[imported.name=/^use(Layout|Insertion)?Effect$/]",
    message: effectMessage,
  },
  {
    selector:
      "MemberExpression[object.name='React'][property.name=/^use(Layout|Insertion)?Effect$/]",
    message: effectMessage,
  },
];

const SIZE_PROPS =
  "fontSize|lineHeight|letterSpacing|width|height|minWidth|minHeight|maxWidth|maxHeight|padding|paddingHorizontal|paddingVertical|paddingTop|paddingBottom|paddingLeft|paddingRight|margin|marginHorizontal|marginVertical|marginTop|marginBottom|marginLeft|marginRight|gap|rowGap|columnGap|borderRadius|borderWidth|top|left|right|bottom";
const tokens = [
  {
    selector: "Literal[value=/^(#[0-9a-fA-F]{3,8}|(rgb|hsl)a?\\()/]",
    message: `No literal colours: use src/ui/tokens/ ${doc("tokens")}.`,
  },
  {
    selector: `Property[key.name=/^(${SIZE_PROPS})$/][value.type='Literal'][value.value>1]`,
    message: `No literal sizes: use src/ui/tokens/ ${doc("tokens")}.`,
  },
  {
    selector: "Property[key.name=/^(duration|delay)$/][value.type='Literal'][value.value>0]",
    message: `No literal timings: use motion from src/ui/tokens/ ${doc("tokens")}.`,
  },
];

const folderImports = {
  lib: [noAboveData, noFeatures, noApp, noParentPaths],
  data: [noAboveData, noFeatures, noApp, noParentPaths],
  config: [noAboveData, noFeatures, noApp, noParentPaths],
  auth: [noFeatures, noApp, noParentPaths],
  hooks: [noFeatures, noApp, noParentPaths],
  ui: [noFeatures, noApp, noParentPaths],
  features: [noFeatures, noApp, noParentPaths],
  app: [noApp, noParentPaths],
};

const TESTS = ["**/*.test.ts", "**/*.test.tsx", "src/testing/**"];

const folderOverride = (folder, { react, test }) => {
  const imports = test ? folderImports[folder] : [...folderImports[folder], noTesting];
  const uiCode = react && !test && ["ui", "features", "app"].includes(folder);
  const syntax = [
    ...dynamicImports(imports),
    ...sleeps,
    ...(uiCode ? [...effects, ...timerWorkarounds, ...tokens] : []),
  ];
  return {
    files: test
      ? [`src/${folder}/**/*.test.ts`, `src/${folder}/**/*.test.tsx`]
      : [`src/${folder}/**`],
    rules: {
      "no-restricted-imports": ["error", { patterns: imports }],
      "eslint-js/no-restricted-syntax": ["error", ...syntax],
    },
  };
};

const preset = ({ react }) => ({
  $schema: "../node_modules/oxlint/configuration_schema.json",
  plugins: ["typescript", "import", "unicorn", "oxc", ...(react ? ["react", "jsx-a11y"] : [])],
  jsPlugins: [
    { name: "eslint-js", specifier: "oxlint-plugin-eslint" },
    { name: "house", specifier: "@interest-protocol/standards/plugin" },
    "eslint-plugin-sonarjs",
  ],
  categories: { correctness: "error", suspicious: "error" },
  rules: {
    "typescript/no-explicit-any": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
    "typescript/ban-ts-comment": ["error", { "ts-expect-error": "allow-with-description" }],
    eqeqeq: "error",
    curly: ["error", "all"],
    "no-var": "error",
    "prefer-const": "error",
    "no-console": "error",
    "import/no-cycle": "error",
    "import/no-default-export": "error",
    "sonarjs/cognitive-complexity": ["error", 15],
    "house/no-comments": "error",
    "house/disable-needs-reason": "error",
    "eslint-js/no-restricted-properties": [
      "error",
      {
        object: "process",
        property: "env",
        message: `Read settings from src/config/env.ts, which parses the environment once at boot ${doc("config")}.`,
      },
    ],
    "eslint-js/no-restricted-syntax": ["error", ...sleeps],
    ...(react
      ? {
          "react/react-in-jsx-scope": "off",
          "react/rules-of-hooks": "error",
          "react/exhaustive-deps": "error",
        }
      : {}),
  },
  overrides: [
    ...LAYERS.map((folder) => folderOverride(folder, { react, test: false })),
    ...LAYERS.map((folder) => folderOverride(folder, { react, test: true })),
    { files: ["src/config/**"], rules: { "eslint-js/no-restricted-properties": "off" } },
    { files: ["src/ui/tokens/**"], rules: { "eslint-js/no-restricted-syntax": "off" } },
    {
      files: [
        ...TESTS,
        "scripts/**",
        "*.config.ts",
        "*.config.mjs",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/route.ts",
      ],
      rules: { "import/no-default-export": "off", "no-console": "off" },
    },
  ],
});

for (const [name, react] of [
  ["base", false],
  ["react", true],
]) {
  writeFileSync(
    new URL(`../oxlint/${name}.json`, import.meta.url),
    `${JSON.stringify(preset({ react }), null, 2)}\n`,
  );
}
