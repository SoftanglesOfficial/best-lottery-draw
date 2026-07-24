---
tags: [decision, adr, security]
status: accepted
date: 2026-07-24
---

# ADR-004 Encrypted Session Token

## Context

Session payload was encrypted but the UUID token sat plaintext in `config.json`.

## Decision

Encrypt `sessionToken` with `safeStorage` (`enc:v1:…`) alongside the session blob; decrypt on load; rewrite legacy plaintext on successful restore.

## Links

- [[ADR-003 DB Password Encryption]]
- [[../Development Notes/Security Notes]]
- [[ADR Index]]
