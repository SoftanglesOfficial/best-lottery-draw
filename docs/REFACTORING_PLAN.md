# Best-12 Refactoring Plan

**Companion:** [AUDIT_REPORT.md](./AUDIT_REPORT.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [TECH_DEBT.md](./TECH_DEBT.md)  
**Date:** 2026-07-24  
**Principle:** Incremental, justified, preserve behavior unless fixing a proven bug.

Priority: **P0** critical · **P1** high · **P2** medium · **P3** low

---

## Wave 0 — Approved this cycle (low / medium risk)

| ID | Pri | Problem | Why it matters | Solution | Risk | Complexity | Deps | Impact |
|----|-----|---------|----------------|----------|------|------------|------|--------|
| W0-1 | P0 | `db-get-status` leaks password | Public IPC → creds in renderer | Redact with `redactDbConfig` | Low | S | — | Stops secret leak |
| W0-2 | P0 | `setupDb` resets admin password | Production lockout / known creds | `ON CONFLICT` without password overwrite | Med | S | — | Keeps existing admin hash |
| W0-3 | P0 | UTC “today” in Sale/Draws/reports | Wrong booking day morning | Use `toLocalDateString` / `isSameCalendarDay` | Med | S | — | Correct local calendar |
| W0-4 | P1 | Idle modal dismissible | Shared desk session stays live | Force `logout()` on expire/close | Med | S | — | Idle policy enforced |
| W0-5 | P2 | Explicit Electron security prefs | Defaults can drift | Set `sandbox: true`, `webSecurity: true` | Med | S | — | Hardens window |
| W0-6 | P3 | Dead `electron-log` | Packaged unused dep | Remove from package.json + Forge list | Low | S | — | Smaller package |
| W0-7 | P2 | Orphan ticket assert script | Useful checks not run | Add `verify-sale-excel.mjs` to `npm test` | Low | S | — | Slightly better CI signal |
| W0-8 | P3 | Stale `agent.md` | Wrong agent context | Point to AGENTS.md | Low | S | — | Doc accuracy |

---

## Wave 1 — Status (2026-07-24 pass 4)

| ID | Status |
|----|--------|
| W1-1 Encrypt DB password | **Done** |
| W1-2 Gate LAN mutate | **Done** (ADR-006; discover public) |
| W1-3 Strip sessionToken | **Done** |
| W1-4 Company assert IDOR | **Done** (schemes listByItem/prizes/create + prior set) |
| W1-5 Role ceiling | **Done** |
| W1-6 Winners unit test | **Done** (`verify-winner-match`) |
| W1-7 Forced password change | **Done** |

## Wave 2 — Status

| ID | Status |
|----|--------|
| W2-1 CSP + navigation | **Done** |
| W2-4 Lazy reports | **Done** |
| W2-7 tsc + CI | **Partial** (CI on; typecheck warn-only) |
| Others | Open (see TECH_DEBT) |

See [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) and [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md).

---

| ID | Pri | Problem | Why | Solution | Risk | Complexity | Deps | Impact |
|----|-----|---------|-----|----------|------|------------|------|--------|
| W1-1 | P0 | Plaintext DB password in config | Disk theft = LAN DB | Encrypt with `safeStorage` | High | M | Migration of existing configs | Credential at-rest |
| W1-2 | P1 | Gate LAN mutate + narrow public DB IPC | XSS / pre-login abuse | Auth after first-run; keep redacted status + test | High | M | Settings UX | Smaller attack surface |
| W1-3 | P1 | Strip `sessionToken` from renderer results | XSS bearer theft | Preload strips before resolve | High | M | Types / auth restore | Session hygiene |
| W1-4 | P1 | Company assert on ID-only handlers | Cross-tenant IDOR | Resolve entity → `assertCompanyAccess` | Med | M | Handler inventory | Multi-company safety |
| W1-5 | P1 | Role ceiling on user create/update | Owner → admin escalation | Cap at caller role | Med | S | Product decision | Authz integrity |
| W1-6 | P0 | Unit tests: winners + ticket extract | Money bugs silent | Small Node asserts (no framework) | Low | M | — | Regression net |
| W1-7 | P1 | Force first-login password change | Default creds on LAN | Flag + UI gate | Med | M | Auth UX | Ops security |

---

## Wave 2 — P2 architecture / reliability

| ID | Pri | Problem | Why | Solution | Risk | Complexity | Deps | Impact |
|----|-----|---------|-----|----------|------|------------|------|--------|
| W2-1 | P2 | CSP + navigation guards | XSS containment | Meta/headers + `will-navigate` deny | Med | M | Vite assets | Defense in depth |
| W2-2 | P2 | `validateDrawOpen` close in same txn | Race on close | Pass `tx` into validation | Med | M | Txn create path | Correct locking |
| W2-3 | P2 | Txn indexes | LAN scale | `CREATE INDEX` migration | Med | S | Mig downtime | Query speed |
| W2-4 | P2 | Lazy-load report routes | Cold start / recharts | `React.lazy` | Low | S | — | Faster first paint |
| W2-5 | P2 | Ledger AGENTS vs reality | Doc/code drift | Decide: computed-only or write path | High if write | M–L | Product | Clarity |
| W2-6 | P2 | Expand schema sync beyond enums | Drift | Column set compare | Low | M | — | Schema safety |
| W2-7 | P2 | `tsc --noEmit` + CI | Silent type breaks | Script + GitHub Action | Low | S | — | Quality gate |
| W2-8 | P2 | Pool sizing / timeouts | Multi-client LAN | Explicit `max`, idle, statement timeout | Med | S | Ops tune | Stability |

---

## Wave 3 — P3 polish (YAGNI until needed)

| ID | Pri | Problem | Solution | Risk | Complexity | When |
|----|-----|---------|----------|------|------------|------|
| W3-1 | P3 | Duplicate ledger pages | Shared shell | Low | M | When editing either page |
| W3-2 | P3 | Split SettingsPage tabs | Extract tab components | Low | M | When Settings changes |
| W3-3 | P3 | Login rate limit | Backoff after N fails | Low | S | After LAN threat review |
| W3-4 | P3 | Signed LAN discovery | HMAC secret | Med | M | Multi-site / hostile LAN |
| W3-5 | P3 | Code-signed updates + feed | Configure `update-electron-app` | High | L | Public distribution |

---

## Explicitly deferred (do not implement)

| Item | Reason |
|------|--------|
| `stock_transfer` UI / full IPC | Blocked on product spec (AGENTS) |
| Full IPC redesign / GraphQL / microservice split | No scale signal; high risk |
| Replace Drizzle+SQL with ORM-only migrations | Working dual model; expand sync instead |
| Linux DEB/RPM validation | Configured but untested; need Linux CI |
| Rewrite large entry pages | Working; split only when changing them |

---

## High-risk change protocol

Before any High-risk item:

1. **Reason** — cite audit ID and failure mode.  
2. **Benefits** — measurable security/correctness.  
3. **Risks** — break first-run, existing sessions, LAN clients.  
4. **Migration** — config rewrite, seed change, backward read.  
5. **Rollback** — previous installer + config backup path.  
6. **Validation** — `npm test`, lint, package, critical manual login/setup.

Proceed only with high confidence and a rollback path.
