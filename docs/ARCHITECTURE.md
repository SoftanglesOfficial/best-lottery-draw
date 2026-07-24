# Best-12 Architecture

**Date:** 2026-07-24 · **Source of truth:** [AGENTS.md](../AGENTS.md)  
**Related:** [AUDIT_REPORT.md](./AUDIT_REPORT.md) · [TECH_DEBT.md](./TECH_DEBT.md)

---

## Current architecture

### Process model

| Process | Responsibility |
|---------|----------------|
| **Main** | Window lifecycle, DB pool, session store, LAN UDP, prefs, IPC handlers |
| **Preload** | `contextBridge` → `window.api`; session token closure; public channel allowlist |
| **Renderer** | React SPA; no Node; all data via IPC |

### Request path

```
UI call api.foo(...)
  → preload invokeIpc (appends sessionToken unless PUBLIC)
    → ipcMain handle
      → withSession? requireRole? assertCompanyAccess?
        → domain ipc/*.ts
          → getDb() / drizzle
```

Returns `{ success: true, ... }` or `{ success: false, error }`.

### Multi-tenancy

- Company membership via `user_companies`.
- Ops scoped by `activeCompanyId` on session.
- Admins may access any `companyId` (intentional ops escape hatch — document in AGENTS).

### Roles

`admin > owner > manager > supervisor > data_entry`  
Enforced in main (`requireRole`) and UI (`useRoleGuard` / nav filters).

### Domain lifecycle (draws)

create → purchases / sales / bookings → import results (auto-lock) → `findWinners` → close via `close_time` or `status: closed` → unlock owner+.

### Data storage

- PostgreSQL 16 on LAN (server PC + clients).
- Tickets: JSON in `transactions.ticket_data` (`shared/ticketData.ts`).
- Schema: Drizzle types + inline SQL (`ENUM_SQL`, `TABLES_SQL`, `MIGRATION_SQL`).
- Local: `config.json` (DB creds encrypted when `safeStorage` available; session token+payload encrypted).

### LAN security model

| Channel | Auth |
|---------|------|
| `lan-get-status`, `lan-discover-server` | Public (setup / client discover) |
| `lan-set-mode`, `lan-start-broadcast`, `lan-stop-broadcast` | Session + manager+ |

Discovery payload: host, dbHost, dbPort, database name — **no password**. Unsigned UDP — trusted LAN only (ADR-006).

### UI routing

`HashRouter` when `file:` (packaged); else `BrowserRouter`.  
Report routes are `React.lazy` (keeps recharts off the cold path).  
Gates: Public → Protected → ActiveCompany → ActiveShift → ops pages.

---

## System boundaries

| Inside app | Outside app |
|------------|-------------|
| Business rules for txns/draws | PostgreSQL server admin |
| Role checks on IPC | OS user permissions on `userData` |
| LAN discovery helper | Network trust / firewall |
| Squirrel installer | Code signing / update feed (not fully configured) |

**Trust boundary:** Renderer is untrusted. Main must validate session, role, and company on every privileged mutation. Public channels must never return secrets or mutate production auth state.

---

## Important design decisions (preserve)

1. **No Proxy on `window.api`** — frozen bridge; preload must not recurse `invokeIpc`.
2. **One IPC file per domain** + central `register.ts` channel list.
3. **`lib/api.ts` is `export const api = window.api`** — no wrapper layer.
4. **Shared pure logic** in `src/shared/` (tickets, close time, local dates).
5. **`stock_transfer` blocked** until product spec exists.
6. **Windows + Squirrel primary**; pg unpacked from asar.

---

## Improved direction (updated 2026-07-24 pass 2)

Completed: public status redaction, non-destructive setup, password encryption at rest, session token not returned to page, CSP + navigation guards, company asserts on key ID-only handlers.

Still open: LAN mutate auth (first-run UX constraint), session UUID encryption, forced password change, lazy report chunks (886 KB JS), Postgres integration tests.

Canonical readiness: [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md).

---

Not a rewrite. Direction of travel:

1. **Harden public IPC** — redact secrets; non-destructive setup; auth LAN mutate.
2. **Company-scope every ID-keyed handler** — one pattern, no “D) none” path.
3. **Calendar correctness** — `localDate` as the only “today” API in UI and main defaults.
4. **Money-path tests** — pure unit asserts for winners/tickets; optional Postgres integration later.
5. **Document ledger reality** — computed from transactions until a write path is specified.
6. **Observability** — either wire `electron-log` or stay on console; don’t ship dead deps.
7. **Lazy report chunks** — reduce cold start without changing domain model.

### Target IPC discipline (sketch)

```
Public: db-get-status (redacted), db-test-connection, db-connect (first-run),
        prefs-get, auth-login/logout/restore, lan-discover-server, window-set-title

Privileged: everything else, including db-setup (post-auth or empty-DB only),
            lan-set-mode / broadcast, reconnect, all domain CRUD
```

---

## Folder map

```
src/main/          Electron main, db, ipc, session, lan
src/preload/       Bridge only
src/renderer/      React pages/components/lib
src/shared/        Pure types + domain helpers
scripts/           verify-* guards, seed, icons
tests/e2e/         Playwright (mocked API today)
docs/              Engineering docs (this tree)
Electron-App-Vault/ Obsidian knowledge base mirrors
```
