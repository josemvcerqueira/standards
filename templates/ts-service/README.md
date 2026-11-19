# ts-service template

Copy this folder to start a new Node service on the house standard, then rename `ts-service` in `package.json` and `AGENTS.md`.

```sh
npm install
npm run dev      # tsx watch, GET /health on PORT
npm run gate     # oxfmt, oxlint, tsc, vitest: the merge check
```

Included: Oxlint and oxfmt from `@interest-protocol/standards`, the house tsconfig, zod env parsing at boot, the standard `src/` folders, a lefthook pre-push, and Claude Code hooks that lint after every edit and run tsc and tests before Claude finishes.
