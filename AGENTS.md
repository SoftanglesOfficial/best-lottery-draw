# Best-12 (best-lottery-draw)

Desktop lottery app for morning/daily draw booking (**Best-12 — Morning Booking**). Multi-company draws, purchases, sales, bookings, ledgers over shared PostgreSQL on a LAN.

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

**IPC**: `window.api` → preload `invokeIpc` → `withSession` in `register.ts` → handler → `getDb()`. **Public channels** (no token): DB connect/setup/status/test/reconnect, `prefs-get`, LAN, `auth-login`/`auth-logout`/`auth-restore`, `window-set-title` — `PUBLIC_CHANNELS` in `preload/index.ts`. **Preload rules**: `invokeIpc` must call `ipcRenderer.invoke` (never recurse); do not Proxy-wrap frozen `window.api`.

`HashRouter` when `file:` protocol (packaged); else `BrowserRouter`.

## Domain

Multi-tenant by **company** (`user_companies`; `activeCompanyId` scopes ops). Roles: admin > owner > manager > supervisor > data_entry.

Key entities: Company, User, ShiftGroup/Shift, ProviderGroup/Provider, BuyerGroup/Buyer, ItemGroup/Item, ItemScheme, Draw, DrawResult, Transaction (purchase, purchase_return, sale, sale_return, stock_transfer, booking), WinningTicket, LedgerEntry, AuditLog, Backup, UserSession.

**Tickets**: JSON in `transactions.ticket_data` — `{from,to,qty}` ranges or `{number}`; parse via `shared/ticketData.ts`.

**Draw lifecycle**: create → purchases/sales/bookings → import results (auto-lock) → `findWinners`. Close via `close_time` or `status: closed`; `validateDrawOpen` auto-writes `closed` when past `close_time`; `isDrawPastCloseTime` / `validateDrawOpen` honor both. Unlock: owner+.

## Database & LAN

- Default: `best12_dev` @ `localhost:5432`; schema via inline SQL in `db.ts` (`ENUM_SQL`, `TABLES_SQL`, `MIGRATION_SQL`)
- `setupDb()` seeds admin, default company, admin `user_companies`, shift groups, today's draws
- Login: `admin` / `admin123` (scrypt hash; legacy SHA-256 auto-migrates on login)
- Health check 30s; events `db-connection-lost` / `db-connection-restored`
- Server PC runs PostgreSQL + UDP 41234 broadcast; clients use `lan-discover-server`. Firewall: 5432 TCP, 41234 UDP

## IPC & Auth

- Channels: kebab-case; legacy exception `itemSchemes-*`
- Returns `{ success: true, ... }` or `{ success: false, error: string }`
- Privileged handlers: `withSession` + `requireRole` / `assertCompanyAccess`; list in `register.ts` `IPC_CHANNELS`
- `lib/api.ts`: thin re-exports (`export const api = window.api`) — no wrapper

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

**Session**: token in preload closure + `sessionStore.ts` (8h TTL, persisted to `config.json` for restart). Renderer: `user` + `activeCompanyName` in `auth.tsx`; `auth-restore` on mount. `user-set-active-company` syncs DB + session. Heartbeat: `sessions-heartbeat`. Idle logout: `SessionTimeout` (30 min). IPC auth-fail: preload `invokeIpc` fires `onAppLogout` listeners. HMR can desync token — re-login may be needed.

## Routes

| Path | Page |
|------|------|
| `/`, `/open-company`, `/dashboard`, `/settings` | Login, company picker, dashboard, settings |
| `/master/*`, `/draws`, `/transactions/*`, `/reports/*`, `/admin/*` | Master data, draws, txns, reports, admin |

Pre-login `/settings`: Ctrl+, or Database Setup on login; database tab uses public IPC only.

## UI & Conventions

- Reuse: `GroupCrudPage`, `Table`, `ui.tsx` (`Input`, `Button`, `Card`), `useActiveCompany`, `useToast`
- IPC one file per domain; types in `shared/types.ts`; pages match route segments
- Txn entry: `TicketRangeTable` / `TicketNumberTable` (booking entry uses individual tickets)
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
2. Company scoping on almost every query/mutation (`assertCompanyAccess`)
3. Schema changes: update `schema.ts` + `TABLES_SQL` + `MIGRATION_SQL` in `db.ts`
4. New IPC: handler + `register.ts` + preload `Api` + `electron.d.ts` + `lib/api.ts`; `PUBLIC_CHANNELS` only if pre-login
5. Roles: `useRoleGuard` / `isAtLeastRole` in UI; `requireRole` in main
6. Txns: purchases → `providerId`; sales/bookings → `buyerId`; `ticket_data` JSON
7. Draw lock: respect `draw.status`; `clientUpdatedAt` on lock/unlock
8. No Proxy on `window.api`; no over-abstraction
9. Windows primary; Squirrel + pg unpacked from asar

## Remaining Work

**Blocked on product spec**: `stock_transfer` UI — `txn_type` enum exists in DB/schema/types; no IPC validation, no page, no documented business rules (parties, ledger impact). Do not implement until spec exists.

**Deferred**: triple schema *merge* (Drizzle + inline SQL stays; `npm test` runs `scripts/verify-schema-sync.mjs` drift guard). Linux DEB/RPM makers configured in `forge.config.ts` but not validated on Linux CI.

**Done this cycle**: `lib/api.ts` collapsed to `export const api = window.api`; renderer uses `api.*` directly.
