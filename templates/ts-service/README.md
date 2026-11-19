# ts-service template

Copy this folder to start a new Node service on the house standard, then rename `ts-service` in `package.json` and `AGENTS.md`.

```sh
npm install
npm run dev      # tsx watch, GET /health on PORT
npm run gate     # oxfmt, oxlint, tsc, vitest: the merge check
```

After the first push, make the gate required on `main` (needs repo admin):

```sh
gh api -X POST repos/OWNER/REPO/rulesets --input .github/ruleset.json
```

Included: Oxlint and oxfmt from `@interest-protocol/standards`, the house tsconfig, zod env parsing at boot, the standard `src/` folders, lefthook pre-commit and pre-push hooks, a GitHub Actions gate, and Claude Code hooks that block edits to the rules, lint after every edit, and keep Claude working until the gate passes. See STANDARD.md#enforcement.
