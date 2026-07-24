---
tags: [architecture, best-12]
---

# System Overview

See canonical: [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)

## Boundaries

- **Renderer untrusted** → all privileged work in main via session IPC.
- **Company scope** via `activeCompanyId`; admin bypass intentional.
- **Postgres on LAN** is the system of record; Electron is a thick client.

## Related

- [[../Audits/2026-07-24 Production Audit]]
- [[../Decisions/ADR-001 Public IPC Surface]]
- [[../Decisions/ADR-006 Authenticated LAN Mutations]]
- [[../Technical Debt/Ledger]]
- [[../Home]]
