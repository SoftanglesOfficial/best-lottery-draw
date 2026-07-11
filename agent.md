# Agent Guide

## Identity
- Best12 Desktop is an Electron + React + TypeScript desktop app for lottery management, ticketing, reporting, backups, and LAN-based database discovery.
- Stack: Electron Forge, Vite, Drizzle ORM, PostgreSQL, React Router, React 19, and a preload-exposed IPC API.
- Package name: `best12-desktop`.
- Product name: `Best12 Desktop`.
- The app is Windows-first, but Forge makers also target ZIP, Debian, and RPM outputs.

## Runtime Model
- The main process owns app lifecycle, window creation, menus, shortcuts, database access, backups, LAN broadcast, diagnostics, and IPC registration.
- The preload layer exposes a narrow typed bridge on `window.api`.
- The renderer is a React SPA and must only talk to privileged code through the preload API.
- Shared types live in `src/shared` and must stay aligned across main, preload, and renderer.
- The database schema exists in Drizzle and also in the main-process setup SQL, so both sides matter.
- App startup is Electron Forge + Vite driven; it is not a standalone web server.

## Entry Points
- Main bootstrap: [src/main/index.ts](src/main/index.ts)
- IPC registry: [src/main/ipc/register.ts](src/main/ipc/register.ts)
- Database connection and setup: [src/main/db.ts](src/main/db.ts)
- Database schema: [src/main/schema.ts](src/main/schema.ts)
- Preferences and window state: [src/main/preferences.ts](src/main/preferences.ts)
- LAN broadcast and discovery: [src/main/lan.ts](src/main/lan.ts)
- Preload bridge: [src/preload/index.ts](src/preload/index.ts)
- Renderer bootstrap: [src/renderer/main.tsx](src/renderer/main.tsx)
- Renderer app and routing: [src/renderer/App.tsx](src/renderer/App.tsx)
- Renderer API wrapper: [src/renderer/lib/api.ts](src/renderer/lib/api.ts)
- Renderer electron typing: [src/renderer/types/electron.d.ts](src/renderer/types/electron.d.ts)
- Shared contracts: [src/shared/types.ts](src/shared/types.ts)
- Shared helpers: [src/shared/parseDrawResults.ts](src/shared/parseDrawResults.ts), [src/shared/ticketData.ts](src/shared/ticketData.ts)
- Build config: [forge.config.ts](forge.config.ts), [vite.main.config.ts](vite.main.config.ts), [vite.preload.config.ts](vite.preload.config.ts), [vite.renderer.config.ts](vite.renderer.config.ts), [drizzle.config.ts](drizzle.config.ts)

## Project Layout
- `src/main` contains privileged app logic, DB setup, IPC handlers, LAN, config storage, and validation helpers.
- `src/preload` is the bridge boundary and should stay small.
- `src/renderer` contains the UI, shell, pages, reusable components, hooks, and local UI utilities.
- `src/renderer/pages` is organized by area: auth/open-company, dashboard, admin, master data, reports, settings, and transactions.
- `src/renderer/components` holds shared UI shell pieces, dialogs, tables, toasts, route protection, and transaction-specific tables.
- `src/renderer/lib` holds renderer-side wrappers, auth state, connection state, keyboard shortcuts, display helpers, and validation helpers.
- `src/shared` holds cross-process data shapes and parsing helpers.
- `assets` contains icons and packaging assets.
- `scripts` contains build helpers such as icon generation.

## UI and Route Shape
- `src/renderer/App.tsx` defines the route tree and wraps the app in auth, connection, toast, listeners, session timeout, and error boundary providers.
- The root route is login.
- `/settings` is available outside the protected shell.
- Protected routes include `/open-company`, `/dashboard`, admin pages, master data pages, transactions, draw pages, and reports.
- `AppShell` is the main navigation frame for authenticated routes.
- The renderer uses hash routing when loaded from `file:` URLs.
- The app includes routes for owners, companies, users, shift groups, shifts, provider groups, providers, buyer groups, buyers, item groups, items, item schemes, draws, draw results, purchase and sale transactions, bookings, winning tickets, ticket search, audit logs, backups, diagnostics, and reports.

## Main Process Behavior
- `src/main/index.ts` creates the `BrowserWindow` with context isolation enabled and node integration disabled.
- The window title is set to `Best-12 — Morning Booking`.
- Saved window bounds are restored from preferences if present.
- The menu includes File, View, and Help entries with navigation shortcuts.
- `CmdOrCtrl+,` opens settings.
- `CmdOrCtrl+D` opens the dashboard.
- `CmdOrCtrl+L` triggers logout.
- On startup, the main process attempts DB connection, builds the app menu, starts LAN broadcast in server mode, opens the window, and starts auto-backup scheduling.
- `did-fail-load` falls back to a data URL showing the renderer load error.
- Auto-updates are enabled only when packaged.

## IPC And Bridge Rules
- Renderer code must not import Electron, Node, or database modules directly.
- All renderer-to-main communication must go through `window.api`.
- The preload should expose only the minimal API surface needed by the UI.
- Main process owns all `ipcMain` handlers and privileged operations.
- If you add or change an IPC action, update all three layers together:
  - handler in [src/main/ipc/register.ts](src/main/ipc/register.ts)
  - preload exposure in [src/preload/index.ts](src/preload/index.ts)
  - renderer wrapper and call sites in [src/renderer/lib/api.ts](src/renderer/lib/api.ts)
- Keep channel names stable unless you are intentionally doing a coordinated rename.
- Keep renderer type declarations in sync with any `window.api` shape changes.

## IPC Surface Notes
- IPC includes database connect/setup/status/test/reconnect.
- IPC includes auth, users, companies, reports, ledger, audit logs, backups, utilities, shifts, providers, buyers, items, item schemes, draws, results, winning tickets, transactions, sessions, diagnostics, and LAN controls.
- The channel registry in [src/main/ipc/register.ts](src/main/ipc/register.ts) is large and stringly typed, so typos can fail at runtime without obvious compile-time errors.
- `src/renderer/lib/api.ts` is the ergonomic wrapper used by UI code; keep it aligned with the preload API.

## Database Notes
- Default connection config is localhost:5432, user `postgres`, database `best12_dev`, empty password by default.
- The main process handles connection setup, reconnects, health checks, and status reporting.
- `src/main/db.ts` creates and maintains core tables such as users, companies, user_companies, shift_groups, shifts, provider_groups, providers, buyer_groups, buyers, item_groups, items, item_schemes, item_scheme_prizes, draws, draw_results, and transactions.
- Enums are created in SQL for roles, status, draw status, transaction type, and buyer type.
- The app depends on a live PostgreSQL instance for many flows, so startup errors may be environmental.
- Drizzle migrations are generated and applied through package scripts.
- Preferences include network mode, auto-backup, last-backup date, and window bounds.

## LAN And Server Mode
- LAN behavior is part of the runtime model and can change startup flow.
- Server mode starts broadcast discovery.
- Client mode stops broadcast and can discover the server automatically.
- The app documents UDP discovery on port 41234 and PostgreSQL on port 5432.
- LAN/database mode mismatches can look like a startup bug when they are really environment or configuration problems.

## Build And Packaging
- Forge packaging copies selected main-runtime dependencies into the packaged build.
- `pg` and related native modules are unpacked for the asar build.
- Packaging targets include Squirrel on Windows, ZIP on macOS, RPM, and DEB.
- The Windows installer name is `Best-12-Setup.exe`.
- The expected installer output path is `out/make/squirrel.windows/x64/`.
- Native dependency handling matters for `pg`, `electron-log`, `electron-squirrel-startup`, `drizzle-orm`, and related runtime deps.

## Commands
- Install dependencies: `npm install`
- Start dev app: `npm start`
- Generate icon assets: `npm run build:icons`
- Build distributables: `npm run build`
- Package app only: `npm run package`
- Make installers: `npm run make`
- Publish builds: `npm run publish`
- Lint the codebase: `npm run lint`
- Generate database migrations: `npm run db:generate`
- Apply database migrations: `npm run db:migrate`

## Default Setup Expectations
- Server PC setup expects PostgreSQL 16 for Windows.
- A database named `best12_dev` should exist.
- The default login documented in `INSTALL.md` is `admin` / `admin123`.
- Users are expected to change the password after first login.

## Common Risks
- IPC drift: changing a handler without updating preload or renderer wrappers.
- Schema drift: changing TypeScript schema types without matching SQL setup or migrations.
- Boundary leaks: accidentally adding direct DB, filesystem, or Electron access in the renderer.
- Contract mismatch: shared types, API return shapes, and renderer expectations can diverge quickly.
- Startup regressions: main window, DB connection, and renderer routing are tightly coupled.
- LAN mode regressions: server/client changes can affect discovery and broadcast behavior.
- Backup and health-check regressions: timers and async work can fail quietly if not validated.

## Safe-Edit Guidance
- Make small, coordinated changes across main, preload, shared types, and renderer when touching app contracts.
- Prefer additive edits over renames unless you are ready to update every caller.
- Keep privilege in the main process and keep the renderer declarative.
- Update types first or alongside implementation when changing IPC payloads or returned data.
- After touching IPC or database paths, validate with a targeted run or build.
- Preserve existing user-facing routes and menu commands unless the change explicitly targets navigation.
- If editing database code, check both runtime setup and migration-related code paths.
- If editing shared contracts, verify both compile-time types and runtime usage in the UI.

## Practical Notes
- The app’s main window should restart cleanly in dev; if handlers appear missing, the main process may need a restart.
- If the app appears to hang on startup, check whether the database is reachable and whether the renderer bundle built cleanly.
- Use the Vite dev server URL only indirectly through Electron Forge; the renderer is not meant to be run standalone for normal operation.
