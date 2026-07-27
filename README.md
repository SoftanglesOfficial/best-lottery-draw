# Best-12 (best-lottery-draw)

Desktop lottery management app — **Best-12 Morning Booking**. Electron + React + PostgreSQL on a LAN.

## Quick start

```bash
npm install
npm start          # electron-forge (dev)
npm test           # schema / session / ticket guards
npm run lint
npm run build      # Squirrel installer → out/make/squirrel.windows/x64/
```

Default login after first DB setup: `admin` / `admin123` (change immediately on production).

See [INSTALL.md](./INSTALL.md) for PostgreSQL / firewall setup.

## Docs

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](./AGENTS.md) | **Source of truth** — architecture, IPC, roles, conventions |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System boundaries & design decisions |
| [docs/AUDIT_REPORT.md](./docs/AUDIT_REPORT.md) | Production-readiness audit (2026-07-24) |
| [docs/TECH_DEBT.md](./docs/TECH_DEBT.md) | Debt ledger |
| [docs/PRODUCTION_READINESS.md](./docs/PRODUCTION_READINESS.md) | Scores, metrics, package evidence |
| [Electron-App-Vault/](./Electron-App-Vault/) | Obsidian knowledge base (open as vault) |

`agent.md` is deprecated; use `AGENTS.md`.
