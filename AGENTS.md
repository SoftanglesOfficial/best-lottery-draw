# Best-12 (best-lottery-draw)

Desktop lottery app morning/daily draw booking (**Best-12 — Morning Booking**). Multi-company draws, purchases, sales, bookings, ledgers over shared PostgreSQL on LAN.

## Stack

- **Runtime**: Electron 42 + Electron Forge 7 (Vite)
- **UI**: React 19, React Router 7, Tailwind 3, lucide-react, recharts
- **Data**: PostgreSQL 16 via `pg`; Drizzle schema types in `src/main/schema.ts`
- **Build**: `npm start` (dev), `npm run build` → `out/make/squirrel.windows/x64/`

## Architecture

```
src/
  main/       DB, IPC (ipc/*.ts + register.ts), sessionStore, lan, preferences
  preload/    contextBridge → window.api; invokeIpc appends sessionToken
  renderer/   React SPA — pages/, components/, lib/ (auth, api, roles, hooks)
  shared/     types.ts, ticketData.ts, parseDrawResults.ts, drawCloseTime.ts
```

**IPC**: `window.api` → preload `invokeIpc` → `withSession` in `register.ts` → handler → `getDb()`. **Public channels** (no token): DB connect/setup/status/test/reconnect, `prefs-get`, LAN **status + discover only**, `auth-login`/`auth-logout`/`auth-restore`, `window-set-title` — `PUBLIC_CHANNELS` in `preload/index.ts`. LAN set-mode / broadcast require manager+ session. **Preload rules**: `invokeIpc` must call `ipcRenderer.invoke` (never recurse); do not Proxy-wrap frozen `window.api`.

`HashRouter` when `file:` protocol (packaged); else `BrowserRouter`.

## Domain

Multi-tenant by **company** (`user_companies`; `activeCompanyId` scopes ops). Roles: admin > owner > manager > supervisor > data_entry.

Key entities: Company, User, ShiftGroup/Shift, ProviderGroup/Provider, BuyerGroup/Buyer, ItemGroup/Item, ItemScheme, Draw, DrawResult, Transaction (purchase, purchase_return, sale, sale_return, stock_transfer, booking), WinningTicket, LedgerEntry, AuditLog, Backup, UserSession.

**Tickets**: JSON in `transactions.ticket_data` — `{from,to,qty}` ranges or `{number}`; parse via `shared/ticketData.ts`.

**Draw lifecycle**: create → purchases/sales/bookings → import results (auto-lock) → `findWinners`. Close via `close_time` or `status: closed`; `validateDrawOpen` auto-writes `closed` when past `close_time`; `isDrawPastCloseTime` / `validateDrawOpen` honor both. Unlock: owner+.

## Database & LAN

- Default: `best12_dev` @ `localhost:5432`; schema via inline SQL in `db.ts` (`ENUM_SQL`, `TABLES_SQL`, `MIGRATION_SQL`)
- `setupDb()` seeds admin, default company, admin `user_companies`, shift groups, today's draws
- Login: `admin` / `admin123` (scrypt; legacy SHA-256 migrates on login). `db-setup` seeds admin once — **no** overwrite existing password. Login with `admin123` forces password change UI.
- Health check 30s; events `db-connection-lost` / `db-connection-restored`
- Server PC: PostgreSQL + UDP 41234 broadcast; clients: `lan-discover-server`. Firewall: 5432 TCP, 41234 UDP

## IPC & Auth

- Channels: kebab-case; legacy exception `itemSchemes-*`
- Returns `{ success: true, ... }` or `{ success: false, error: string }`
- Privileged: `withSession` + `requireRole` / `assertCompanyAccess`; list in `register.ts` `IPC_CHANNELS`
- `lib/api.ts`: `export const api = window.api` — no wrapper
- Role ceiling: cannot assign/modify role above caller (`assertAssignableRole`)

| Capability | Min role |
|------------|----------|
| Master CRUD | manager (UI) |
| Delete txns | supervisor+ |
| Bulk delete memos | admin |
| P&L | owner |
| Unlock draws | owner |
| Admin pages | admin or owner |
| Diagnostics | admin |
| Audit logs | manager+ |

**Session**: token in preload closure + `sessionStore.ts` (8h TTL; token + payload encrypted via `safeStorage` in `config.json`). Renderer: `user` + `activeCompanyName` in `auth.tsx`; `auth-restore` on mount. `user-set-active-company` syncs DB + session. Heartbeat: `sessions-heartbeat`. Idle logout: `SessionTimeout` (30 min). IPC auth-fail: preload `invokeIpc` → `onAppLogout`. HMR can desync token — re-login.

## Routes

| Path | Page |
|------|------|
| `/`, `/open-company`, `/dashboard`, `/settings` | Login, company picker, dashboard, settings |
| `/master/*`, `/draws`, `/transactions/*`, `/reports/*`, `/admin/*` | Master data, draws, txns, reports, admin |

Pre-login `/settings`: Ctrl+, or Database Setup on login; database tab public IPC only.

## UI & Conventions

- Reuse: `GroupCrudPage`, `Table`, `ui.tsx` (`Input`, `Button`, `Card`), `useActiveCompany`, `useToast`
- IPC one file per domain; types in `shared/types.ts`; pages match route segments
- Txn entry: `TicketRangeTable` / `TicketNumberTable` (booking = individual tickets)
- Export: `exportCsv.ts`, `exportPdf.ts`; indigo nav accent

## Development

```bash
npm start       # electron-forge (hot reload; type rs to restart main)
npm run lint    # eslint
npm test        # schema enum drift check (txn_type, draw_status, role)
npm run build   # Squirrel installer (+ DEB/RPM makers in forge.config, untested on Linux)
```

Local config: `configStore.ts` (DB creds, window bounds). Prefs: auto-backup 23:00, network mode. See `INSTALL.md`, `forge.config.ts`.

## Agent Guidelines

1. Minimize scope — one IPC file per domain; match existing patterns
2. Company scoping almost every query/mutation (`assertCompanyAccess`)
3. Schema changes: update `schema.ts` + `TABLES_SQL` + `MIGRATION_SQL` in `db.ts`
4. New IPC: handler + `register.ts` + preload `Api` + `electron.d.ts` + `lib/api.ts`; `PUBLIC_CHANNELS` only if pre-login
5. Roles: `useRoleGuard` / `isAtLeastRole` in UI; `requireRole` in main
6. Txns: purchases → `providerId`; sales/bookings → `buyerId`; `ticket_data` JSON
7. Draw lock: respect `draw.status`; `clientUpdatedAt` on lock/unlock
8. No Proxy on `window.api`; no over-abstraction
9. Windows primary; Squirrel + pg unpacked from asar

## Remaining Work

**Blocked on product spec**: `stock_transfer` UI — `txn_type` enum in DB/schema/types; create path rejects until spec (parties, ledger). No UI until spec.

**Deferred**: triple schema *merge* (Drizzle + inline SQL stays; `npm test` → `scripts/verify-schema-sync.mjs` enum drift). Linux DEB/RPM in `forge.config.ts` untested on Linux CI.

**Done this cycle**: `lib/api.ts` = `export const api = window.api`; renderer uses `api.*` directly.
[PHASE 1] [COMPLETE] [2026-07-17] — Login, company, server-authorized shift flow
[PHASE 2] [COMPLETE] [2026-07-17] — Role-aware full-width menu + dashboard routing
[PHASE 3] [COMPLETE] [2026-07-17] — Blue spreadsheet Sales Entry, transaction behavior preserved
