---
tags: [decision, adr, ipc, security]
status: accepted
date: 2026-07-24
---

# ADR-001 Public IPC Surface

## Context

Pre-login flows need DB connect/status and auth without a session token. Over-broad public channels leak secrets and allow destructive setup.

## Decision

Public channels must be **minimal and non-secret**:

- Allowed: redacted status, test connection, connect/first-run, prefs-get, auth login/logout/restore, LAN *discover*, window title.
- Privileged: `db-setup` (non-destructive), LAN mode/broadcast, reconnect, all domain CRUD.

## Consequences

- Settings UX may require login for LAN server mode changes.
- `getDbStatus` must redact passwords forever.

## Links

- [[../Architecture/System Overview]]
- [[../Audits/2026-07-24 Production Audit]]
- [[ADR Index]]
