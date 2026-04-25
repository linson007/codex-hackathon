# npm Audit Notes

Last checked with:

```bash
npm audit --json
```

## Current Result

- Total findings: 7 moderate
- High/Critical findings: 0

## Findings

| Package          | Source                         | Scope      | Notes                                                                  |
| ---------------- | ------------------------------ | ---------- | ---------------------------------------------------------------------- |
| `vitest`         | transitive `vite`, `vite-node` | dev/test   | Fix requires major upgrade to Vitest 4.x.                              |
| `vite-node`      | transitive `vite`              | dev/test   | Pulled by Vitest.                                                      |
| `@vitest/mocker` | transitive `vite`              | dev/test   | Pulled by Vitest.                                                      |
| `esbuild`        | transitive under Vitest        | dev/test   | Dev server exposure advisory; not part of production API runtime.      |
| `vite`           | transitive under Vitest        | dev/test   | Vitest uses an older nested Vite version. Root Vite is pinned newer.   |
| `mermaid`        | transitive `uuid`              | UI runtime | Fix suggested by npm is a major downgrade to Mermaid 9.1.7.            |
| `uuid`           | transitive under Mermaid       | UI runtime | Advisory applies to v3/v5/v6 buffer usage; ContextOS does not call it. |

## Decision

Do not run `npm audit fix --force` for the MVP.

Reasons:

- The Vitest fixes require a major test-framework upgrade.
- The Mermaid fix suggested by npm is a major downgrade, which risks breaking sequence diagram rendering.
- No high or critical issues are present.
- Most findings are development-server or test-tooling related.

## Follow-Up

1. Upgrade Vitest in a separate branch and run the full suite.
2. Track Mermaid releases that move to a non-vulnerable `uuid` range without downgrading.
3. Keep root Vite pinned to a patched 6.4.x or later release.
4. Re-run `npm audit` before any public demo or distribution.
