# Remaining Work — Design (2026-07-13)

## Problems identified

| Item | Exact problem | Resolution |
|------|---------------|------------|
| `lib/api.ts` | ~520 lines of `fn() { return api.fn() }` wrappers; AGENTS target was `export const api = window.api` | Collapsed file; 36 renderer files use `import { api }` + `api.method()` |
| Triple schema | `schema.ts`, `db.ts` ENUM_SQL, `types.ts` can drift on enum edits | `scripts/verify-schema-sync.mjs` + `npm test` (set compare, not full merge) |
| Linux DEB/RPM | Listed as missing; already in `forge.config.ts` | Document as configured, untested on Linux |
| `stock_transfer` | Enum in 3 files, zero IPC/UI, no product spec in repo | Blocked — needs business rules before code |
| Automated tests | No test runner | Minimal: schema drift script; full suite still YAGNI |

## stock_transfer (blocked)

Cannot implement without answers:

1. Parties: provider only, buyer only, or both?
2. Ticket shape: ranges like purchase, individual numbers, or both?
3. Ledger: debit/credit which accounts?
4. Draw rules: same draw only or cross-draw?

Recommendation: spec from domain owner, then mirror `PurchaseEntryPage` or `SaleEntryPage` pattern.

## Out of scope (ponytail)

- Drizzle-kit migration pipeline (replaces inline SQL) — large, separate project
- Linux CI build validation — needs Linux runner
- Vitest/Jest suite — add when regressions hurt
