# ts-service

A Node 24 TypeScript service built on the Interest Protocol house standard. Read `node_modules/@interest-protocol/standards/STANDARD.md` once; the lint rules enforce the rest and their messages tell you the fix.

## Where code goes

`src/app` entry points · `src/features/<name>` one folder per feature · `src/data` storage and external APIs · `src/config/env.ts` the parsed environment · `src/lib` pure helpers. A feature never imports another feature.

## Gate

`npm run gate` (oxfmt, oxlint, tsc, vitest) is the merge check. Hooks run oxfmt and oxlint after every edit and tsc and tests before you finish. Never push with `--no-verify`.

## Review

A different agent reviews every PR from the diff alone. A comment that comes up twice becomes a lint rule in `@interest-protocol/standards`.

## Not allowed without Jose

Secrets in the repo, deploys, branch-protection changes.
