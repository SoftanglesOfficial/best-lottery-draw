---
tags: [security, notes]
date: 2026-07-24
---

# Security Notes

## Done (pass 2–4)

- DB password encrypted at rest (`safeStorage`)
- Session token stripped before renderer sees login/restore result
- Session token encrypted at rest (`enc:v1:`)
- Default seed password forces change UI; change rejects reuse of `admin123`
- Role ceiling: cannot assign/modify above caller rank
- Company asserts on winners / commission / sale summaries / ticket sold / **schemes by item / prizes / create**
- CSP meta; navigation + window.open denied; openExternal http(s) only
- **LAN mutate** requires manager+ session; discover + status remain public ([[../Decisions/ADR-006 Authenticated LAN Mutations]])

## Still open (accepted for trusted LAN)

- Unsigned LAN discovery (spoof host) — ops: firewall + trusted network
- Weak passwords other than literal `admin123` (min length 6 only)
- react-router supply-chain advisories (lower risk under HashRouter)

See [[ADR-001 Public IPC Surface]] · [[Production Readiness]] · [[../Home]]
