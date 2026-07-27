---
tags: [decision, adr, lan, security]
status: accepted
date: 2026-07-24
---

# ADR-006 Authenticated LAN Mutations

## Context

`lan-set-mode` / start/stop broadcast were public IPC. XSS or pre-login renderer code could flip a PC to server mode and broadcast DB host/port/name on UDP 41234.

Pre-login Settings still needs **discover** so clients can find the DB host before login.

## Decision

- Keep public: `lan-get-status`, `lan-discover-server`.
- Require session + **manager+** for: `lan-set-mode`, `lan-start-broadcast`, `lan-stop-broadcast`.
- Persist `networkMode`; main process may auto-start broadcast on launch when mode is already `server` (post-auth configuration).
- Discovery remains **unsigned** (trusted-LAN assumption). HMAC/pin deferred until multi-site / hostile LAN.

## Consequences

- First-run: Setup DB → login → change seed password → set LAN server mode.
- Clients: discover still works pre-login.

## Links

- [[ADR-001 Public IPC Surface]]
- [[../Development Notes/Security Notes]]
- [[ADR Index]]
