# @interest-protocol/standards

The house standard for new Interest Protocol code: Oxlint and oxfmt configs, a tsconfig base, and a small lint plugin. Read [STANDARD.md](STANDARD.md) for the rules and what enforces each one.

| Path                   | What it is                                                              |
| ---------------------- | ----------------------------------------------------------------------- |
| `oxlint/base.json`     | Lint preset for TypeScript code                                         |
| `oxlint/react.json`    | The base preset plus React, effects and design-token rules              |
| `plugin/`              | House rules Oxlint does not ship: `no-comments`, `disable-needs-reason` |
| `oxfmt.json`           | Formatter settings, copied to `.oxfmtrc.json` in each repo              |
| `tsconfig.base.json`   | Strict compiler options                                                 |
| `test/`                | Proof that every rule fires and that weakening the config fails          |

Start a new repo from [template-service](https://github.com/josemvcerqueira/template-service) (Use this template), or add it to a repo by hand:

```jsonc
// .oxlintrc.json
{ "extends": ["./node_modules/@interest-protocol/standards/oxlint/base.json"] }
```

Change a rule: edit `scripts/build-presets.mjs`, run `npm run build:presets`, add a fixture and a line in `test/rules.test.mjs`, then `npm test`.

Release: bump `version`, tag `vX.Y.Z`, push the tag. Repos install `github:josemvcerqueira/standards#vX.Y.Z` and pick up rule changes by bumping that tag.
