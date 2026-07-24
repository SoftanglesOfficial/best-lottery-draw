# Best-12 Technical Debt Ledger

**Updated:** 2026-07-24 (pass 4)  
**Sources:** [AUDIT_REPORT.md](./AUDIT_REPORT.md) · [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) · [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) · [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md)

Status: `open` · `in_progress` · `done` · `wontfix` · `blocked`

---

## Completed improvements

| Date | ID | Item | Notes |
|------|-----|------|-------|
| 2026-07-17 | — | Phases 1–3 product work | Login/company/shift, role menu, sales entry |
| 2026-07-24 | W0-* | First hardening wave | Status redact, setup password, local dates, idle logout, sandbox, electron-log gone, docs |
| 2026-07-24 | W1-1 | Encrypt DB password at rest | `safeStorage` `enc:v1:` + migrate on ready |
| 2026-07-24 | W1-3 | Strip sessionToken from renderer | Preload login/restore |
| 2026-07-24 | W1-4 | Company assert IDOR set | findWinners, commission, summaries, validateTicketsSold |
| 2026-07-24 | W1-6 | Winner match unit verify | `winnerMatch.ts` + `verify-winner-match.mjs` |
| 2026-07-24 | W2-1 partial | CSP + nav + openExternal | meta CSP; will-navigate; deny window.open; http(s) only |
| 2026-07-24 | — | npm override conflict | Removed `overrides.electron-winstaller` |
| 2026-07-24 | W1-3b | Encrypt session UUID at rest | `sessionStore` `enc:v1:` |
| 2026-07-24 | W1-7 | Default password gate | `mustChangePassword` + ForceChangePassword |
| 2026-07-24 | W1-5 | Role ceiling on create/update | `assertAssignableRole` |
| 2026-07-24 | W1-2 | Gate LAN mutate | manager+ session; discover stays public (ADR-006) |
| 2026-07-24 | S-10b | Scheme-by-item / prizes IDOR | assert on item/scheme company |
| 2026-07-24 | T-04 | CI | `.github/workflows/ci.yml` |
| 2026-07-24 | W2-4 | Lazy report routes | `React.lazy` + Suspense |
| 2026-07-24 | — | Auth/isolation/role verify scripts | `verify-auth-gates`, `verify-company-isolation`, `verify-role-ceiling` |
| 2026-07-24 | — | Release checklist | `docs/RELEASE_CHECKLIST.md` |

---

## Open debt

| ID | Severity | Item | Ceiling / upgrade |
|----|----------|------|-------------------|
| W3-4 | P2 | Unsigned LAN discovery | HMAC / shared pin if LAN not trusted |
| C-03 | P2 | Draw auto-close outside txn | Pass `tx` into validateDrawOpen |
| RR-1 | P2 | react-router audit vulns (prod) | Bump react-router-dom |
| S-09 | P2 | Backup path from renderer | Dialog-only |
| A-01 | P2 | Schema sync enums-only | Expand column guard |
| A-02 | P2 | Missing txn indexes | Migration |
| C-05 | P2 | `ledger_entries` unused by writes | Document computed ledger |
| T-03 | P2 | E2E mocked API only | Optional Postgres integration |
| — | P2 | `tsc` withSession Promise union noise | Widen `withSession` handler return type |

---

## Blocked

| ID | Item | Blocker |
|----|------|---------|
| ST-1 | `stock_transfer` UI + full rules | Product spec (AGENTS) |
| LX-1 | Linux DEB/RPM validation | Linux CI / machine |

---

## Won’t fix (for now)

| Item | Reason |
|------|--------|
| Blind React memoization | No profiler evidence |
| Full IPC rewrite | Navigable today |
| Redux/Zustand | Page state enough |

---

## Ops notes

- Quit packaged app before re-packaging (Windows EPERM on `out/`).
- Overall readiness ~82% after pass 4 — see [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).
- Deployment steps: [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).
