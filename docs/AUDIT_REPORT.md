# Best-12 Production Audit Report

**Date:** 2026-07-24  
**Scope:** Full codebase (Electron main/preload/renderer, IPC, DB, tests, deps)  
**Source of truth:** [AGENTS.md](../AGENTS.md)  
**Method:** Config review + parallel deep audits (architecture, Electron/security, React, tests)

---

## Pass 2 addendum (2026-07-24)

Evidence-based follow-up: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).

Hardened since first audit: password at-rest encryption, session token strip, IDOR fixes on winners/commission/summaries, CSP + navigation guards, winner-match verify script, packaging validated.

Still major risks: default admin password, public LAN mutate, unsigned discovery, mocked e2e, react-router advisories.

---

Best-12 has a **solid operational core**: context isolation, fuses, session-gated IPC, company scoping on most CRUD, draw lock/`FOR UPDATE`, shared ticket math, and clear domain boundaries. It is **not yet production-hardened**.

Highest risks:

1. **Public `db-setup` resets admin password to `admin123`** on every run.
2. **Public `db-get-status` returns plaintext DB password**.
3. **DB credentials stored plaintext** in `config.json`.
4. **UTC calendar dates** in Sale Entry / Draws / reports (morning-booking bug in UTC+ offsets).
5. **Money paths largely untested** (`findWinners`, ledger math); `npm test` is script guards, not a suite.

**Verdict:** Safe to keep shipping incrementally. Fix P0 security + date bugs before treating installs as production-trusted on a LAN.

---

## Current architecture understanding

```
Renderer (React 19 SPA)
  → window.api (preload contextBridge)
    → ipcMain handlers (register.ts + ipc/*.ts)
      → withSession / PUBLIC_CHANNELS
        → getDb() / pg Pool + Drizzle query API
          → PostgreSQL 16 (LAN-shared)
```

- **Main:** DB lifecycle, session store, LAN UDP discovery, preferences, IPC domains.
- **Preload:** Narrow API surface; session token in closure; public vs privileged channels.
- **Renderer:** Route guards (auth → company → shift), AuthContext, per-page state, shared ticket/draw helpers.
- **Schema:** Drizzle types in `schema.ts` + inline `TABLES_SQL` / `MIGRATION_SQL` in `db.ts`; enum drift guard only.

---

## Existing strengths

| Area | Notes |
|------|--------|
| Electron baseline | `contextIsolation: true`, `nodeIntegration: false`, fuses (RunAsNode/Inspect off, asar integrity) |
| IPC auth pattern | `withSession` + `requireRole` + `assertCompanyAccess` on most privileged paths |
| Password hashing | scrypt + timing-safe verify; legacy SHA-256 migrates on login |
| Session persist | Encrypted blob via `safeStorage` |
| Txn integrity | Draw `FOR UPDATE`, company advisory lock for memo IDs, party-type rules |
| Shared domain | `ticketData`, `ticketMath`, `drawCloseTime`, `localDate` (underused) |
| UI reuse | `GroupCrudPage`, `TransactionListPage`, route focus, ErrorBoundary |
| Packaging | pg unpacked from asar; Squirrel Windows primary |

---

## Problems discovered

Severity: **P0** critical · **P1** high · **P2** medium · **P3** low

### Security / Electron

| ID | Severity | Problem | Impact | Recommended solution |
|----|----------|---------|--------|----------------------|
| S-01 | P0 | `getDbStatus()` returns unredacted `getStoredConfig()` including password; channel is public | Pre-login / XSS steals Postgres creds | Redact via `redactDbConfig` (same as `db-get-config`) |
| S-02 | P0 | `setupDb` `ON CONFLICT` overwrites `admin` password to `admin123`; `db-setup` is public | One click restores known admin on production DB | Never overwrite existing password; gate setup after first-run |
| S-03 | P0 | DB password plaintext in `userData/config.json` | Local malware / other users steal LAN DB access | Encrypt password with `safeStorage` |
| S-04 | P1 | LAN mode/broadcast channels public | XSS can flip server mode / broadcast DB location | Require authenticated manager+ after first connect |
| S-05 | P1 | Unsigned UDP discovery; first packet wins | LAN attacker spoofs server | Shared secret / pin server / manual IP |
| S-06 | P1 | `sessionToken` returned to renderer + UUID clear on disk | XSS / disk theft of bearer | Strip in preload; encrypt persisted token |
| S-07 | P1 | Default `admin`/`admin123` documented + re-seeded | Trivial login if Postgres LAN-exposed | Random initial password + forced change |
| S-08 | P2 | No CSP; no navigation / `openExternal` guards; sandbox not explicit | Weaker XSS / open-redirect posture | CSP + allowlists + `sandbox: true` |
| S-09 | P2 | Backup restore accepts arbitrary `filePath` from renderer | Owner/XSS reads arbitrary files | Dialog-only path selection |
| S-10 | P2 | Cross-company IDOR on some ID-only handlers (`findWinners`, commission, summaries, schemes) | Authenticated user hits other companies by ID | Assert company on every entity resolve |

### Correctness / domain

| ID | Severity | Problem | Impact | Recommended solution |
|----|----------|---------|--------|----------------------|
| C-01 | P0 | UTC `toISOString().slice(0,10)` for “today” in Sale/Draws/reports | Wrong calendar day early morning (PK UTC+5) | Use `shared/localDate` everywhere |
| C-02 | P1 | Idle timeout modal dismissible without logout | Shared-desk session stays open | Force `logout()` on expire / close |
| C-03 | P1 | `validateDrawOpen` auto-close writes outside txn holding `FOR UPDATE` | Race across connections | Close update in same txn |
| C-04 | P1 | Owner can create/promote `admin` users | Privilege escalation | Cap role at caller’s role (or owner max) |
| C-05 | P2 | `ledger_entries` never written by business path | AGENTS implies first-class ledger; reality is computed reports | Document or implement write path |
| C-06 | P2 | Machine-local TZ for draw close | Multi-PC skew closes differently | Document TZ requirement or store UTC |

### Architecture / quality

| ID | Severity | Problem | Impact | Recommended solution |
|----|----------|---------|--------|----------------------|
| A-01 | P2 | Enum-only schema drift guard | Column drift undetected | Expand verify script or accept documented debt |
| A-02 | P2 | Missing indexes on hot txn filters | Slower LAN under load | Add `draw_id` / `type` / party indexes |
| A-03 | P2 | No route code-splitting; recharts eager | Larger cold start | `React.lazy` report routes |
| A-04 | P3 | Dead `electron-log` dep still packaged | Bloat / confusion | Remove from deps + Forge copy list |
| A-05 | P3 | Stale `agent.md` vs `AGENTS.md` | Agents follow wrong docs | Point `agent.md` → AGENTS or delete |

### Testing

| ID | Severity | Problem | Impact | Recommended solution |
|----|----------|---------|--------|----------------------|
| T-01 | P0 | `findWinners` / ledger untested | Silent money bugs | Unit tests on ticket extract + winner match |
| T-02 | P0 | `npm test` = regex/script guards, false confidence | Regressions ship | Keep guards; add real unit suite name clearly |
| T-03 | P1 | E2E mocks `window.api`; no main/DB | IPC/SQL bugs invisible | Opt-in integration tests against Postgres |
| T-04 | P2 | No `tsc --noEmit` / CI | Type breaks unnoticed | Add typecheck script + CI |

---

## AGENTS.md vs code inconsistencies

| AGENTS says | Code does | Why | Resolution |
|-------------|-----------|-----|------------|
| LedgerEntry is a key entity | Table exists; writes only in backup import | Likely planned double-entry never finished | Update AGENTS: “computed ledger from transactions” OR implement writes |
| Triple schema; drift guard | Guard checks enums only | Pragmatic minimal test | Document enum-only scope in AGENTS |
| `stock_transfer` no IPC validation | Create throws “not available” | Safer than AGENTS claim | Update AGENTS |
| Company scoping on almost every query | Gaps: findWinners, commission, summaries, schemes-by-item | Easy to miss when adding handlers | Fix gaps; keep AGENTS aspirational |
| Public LAN discovery | Also public: `lan-set-mode` / start/stop broadcast | Convenience for first-run | Document + lock down after auth |
| Unlock: owner+ | Matches server; Sale “unlock” is field unlock | Naming only | Clarify in UI copy if needed |

---

## Technical impact summary

Without P0 fixes, a LAN install can be **admin-reset** and **credential-leaked** through public IPC, while operators can book against the **wrong calendar day**. Architecture is maintainable for 5+ years if company-scope discipline is enforced and tests grow around money paths — not if the app is rewritten.
