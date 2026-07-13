# Best-12 (best-lottery-draw)

Desktop lottery management app for morning/daily draw booking. Product name: **Best-12 — Morning Booking**. Manages draws, ticket purchases/sales/bookings, providers, buyers, prize schemes, winning tickets, ledgers, and multi-company operations over a shared PostgreSQL database on a LAN.

## Stack

- **Runtime**: Electron 42 + Electron Forge 7 (Vite plugin)
- **UI**: React 19, React Router 7, Tailwind CSS 3, lucide-react, recharts
- **Data**: PostgreSQL 16 via `pg`, Drizzle ORM schema in `src/main/schema.ts`
- **Language**: TypeScript 5.7, strict separation: main / preload / renderer / shared
- **Build**: `npm start` (dev), `npm run build` → Squirrel installer at `out/make/squirrel.windows/x64/`

## Architecture

```
src/
  main/           Electron main process — DB, IPC handlers, LAN broadcast, backups
    ipc/          One file per domain; register.ts wires all channels
    db.ts         Connection pool, schema bootstrap, inline migrations, setupDb()
    schema.ts     Drizzle table definitions (source of truth for types)
    lan.ts        UDP server discovery on port 41234
    preferences.ts, configStore.ts
  preload/        contextBridge → window.api (typed in renderer/types/electron.d.ts)
  renderer/       React SPA
    pages/        Route screens (admin/, master/, transactions/, reports/)
    components/   AppShell, Table, Modal, GroupCrudPage, ui.tsx primitives
    lib/          auth, api (window.api wrapper), permissions, validation, hooks
  shared/         types.ts, ticketData.ts, parseDrawResults.ts — used by main + renderer
```

IPC flow: renderer calls `window.api.*` → preload → `ipcMain.handle` in `register.ts` → handler in `src/main/ipc/*.ts` → Drizzle/raw SQL via `getDb()`.

Renderer uses `HashRouter` when loaded from `file:` protocol (packaged app), else `BrowserRouter`.

## Domain Model

Multi-tenant by **company**. Users belong to companies via `user_companies`; `activeCompanyId` scopes all operations.

| Entity | Purpose |
|--------|---------|
| Company | Tenant; status: active/locked/frozen; billing lock |
| User | Roles: admin > owner > manager > supervisor > data_entry |
| ShiftGroup / Shift | Time buckets (Morning, Day, Evening) |
| ProviderGroup / Provider | Ticket suppliers; purchase_rate, commission |
| BuyerGroup / Buyer | Ticket customers; type stockist/seller; sale_rate |
| ItemGroup / Item | Lottery products; series, draw_time, rate, length |
| ItemScheme / ItemSchemePrizes | Prize structure per draw date |
| Draw | Daily draw session; status open/closed/locked; close_time |
| DrawResult | Winning numbers per prize level |
| Transaction | purchase, purchase_return, sale, sale_return, stock_transfer, booking |
| WinningTicket | Matched tickets linked to draw results |
| LedgerEntry | Provider/buyer debit-credit |
| AuditLog, Backup, UserSession | Compliance, backup metadata, active sessions |

**Ticket data**: JSON in `transactions.ticket_data` — ranges `{from,to,qty}` or individual `{number}` entries. Parse via `shared/ticketData.ts`.

**Draw lifecycle**: Create draw → enter purchases (from providers) / sales & bookings (to buyers) → import results (auto-locks) → `findWinners`. Close enforced via `close_time` while status stays `open`; `closed` enum exists but unused. Locked draws restrict edits; unlock requires owner+.

## Database

- Default DB: `best12_dev` on `localhost:5432`
- Schema created at connect via raw SQL in `db.ts` (`ENUM_SQL`, `TABLES_SQL`, `MIGRATION_SQL`)
- `setupDb()` seeds admin user, default company, shift groups, and today's draws (no `user_companies` row)
- Default login: `admin` / `admin123` (SHA-256 hash, no salt — legacy)
- Drizzle kit scripts exist (`db:generate`, `db:migrate`) but runtime uses inline SQL migrations
- Connection health check every 30s; events `db-connection-lost` / `db-connection-restored`

## LAN Deployment

One **server** PC runs PostgreSQL and broadcasts on UDP 41234. Client PCs auto-discover via `lan-discover-server` or manual IP. Firewall: 5432 TCP + 41234 UDP.

## IPC Conventions

- Channels: kebab-case (`draws-list`, `transactions-create`); exception: `itemSchemes-*` (camelCase, legacy)
- Handlers return `{ success: true, ... }` or `{ success: false, error: string }`
- `wrapIpc` in `ipcUtils.ts` exists; handlers use direct `ipcMain.handle` + per-file `formatDbError`
- Role checks happen in handlers (e.g. delete transaction, unlock draw) and renderer (`useRoleGuard`, `permissions.ts`)
- Full channel list in `register.ts` `IPC_CHANNELS` array

## Auth & Permissions

| Capability | Minimum role |
|------------|--------------|
| Master data CRUD | manager (UI); main handlers rely on company scoping |
| Delete transactions | supervisor+ (main blocks `data_entry` only) |
| Bulk delete memos | admin (main); Settings UI |
| View P&L | owner |
| Unlock draws | owner |
| Admin pages (owners, companies, backups) | admin or owner |
| Diagnostics | admin only |
| Audit logs | manager+ |

`permissions.ts` (renderer) and `roles.ts` use numeric rank. `isAtLeastRole` in `roles.ts` is the canonical rank for nav gating.

Session: in-memory in renderer (`auth.tsx`). Heartbeat via `sessions-heartbeat`. `SessionTimeout` component enforces idle logout.

## Key Routes

| Path | Page |
|------|------|
| `/` | Login |
| `/open-company` | Company picker |
| `/dashboard` | Dashboard |
| `/settings` | DB config, LAN, profile, audit tab |
| `/master/*` | Users, groups, items, schemes |
| `/draws`, `/draws/:id/results` | Draw management & results |
| `/transactions/*` | Purchase, sale, booking, returns, search |
| `/reports/*` | Summary, P&L, ledgers |
| `/admin/*` | Owners, companies, audit, backups, diagnostics |

## UI Patterns

- **GroupCrudPage**: reusable CRUD for name-only group entities (shift groups, provider groups, etc.)
- **Table** component with typed columns
- **ui.tsx**: `Input`, `Button`, `Card` — minimal shared primitives
- **useActiveCompany**: hook returning current `companyId` from auth context
- **useToast**: global toast notifications
- Pages call `window.api` methods directly or via `lib/api.ts` re-exports
- Tailwind utility classes; indigo accent for active nav

## File Conventions

- IPC handler file per domain: `auth.ts`, `draws.ts`, `transactions.ts`, etc.
- Input/Record types in `shared/types.ts`; Drizzle schema mirrors DB
- Page files in `renderer/pages/` match route segments
- Transaction entry pages use `TicketRangeTable` / `TicketNumberTable`
- Export helpers: `exportCsv.ts`, `exportPdf.ts`
- No test suite currently

## Development

```bash
npm start              # electron-forge start (hot reload)
npm run lint           # eslint .ts/.tsx
npm run build:icons    # assets/icon generation
npm run build          # production installer
```

Config stored locally via `configStore.ts` (DB credentials, window bounds). Preferences: auto-backup (23:00 daily), network mode.

## Agent Guidelines

1. **Minimize scope** — match existing patterns; one IPC file per domain, pages call api directly
2. **Company scoping** — almost every query filters by `companyId` from active company
3. **Schema changes** — update `schema.ts`, `TABLES_SQL`, and `MIGRATION_SQL` in `db.ts`
4. **Types** — add to `shared/types.ts`; expose via preload `Api` interface and `electron.d.ts`
5. **New IPC** — add handler, register channel in `register.ts`, expose in preload, wrap in `lib/api.ts`
6. **Roles** — gate UI with `useRoleGuard` / `isAtLeastRole`; enforce again in main process
7. **Transactions** — purchases use `providerId`; sales/bookings use `buyerId`; `ticket_data` is JSON
8. **Draw locking** — respect `draw.status`; check `clientUpdatedAt` on lock/unlock for concurrency
9. **No over-engineering** — reuse GroupCrudPage, Table, ui primitives before adding abstractions
10. **Windows target** — primary platform; Squirrel installer, pg unpacked from asar

## Related Docs

- `INSTALL.md` — server/client setup, firewall, default credentials
- `package.json` — dependencies and scripts
- `forge.config.ts` — packager, makers, runtime dep copying for pg
