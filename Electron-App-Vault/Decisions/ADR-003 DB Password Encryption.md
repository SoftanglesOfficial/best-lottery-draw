---
tags: [decision, adr, security]
status: accepted
date: 2026-07-24
---

# ADR-003 DB Password Encryption

## Context

DB credentials lived plaintext in `userData/config.json`.

## Decision

Encrypt password with Electron `safeStorage` as `enc:v1:<base64>` on save; decrypt on read; migrate plaintext on `app.whenReady`.

## Consequences

- Machine-bound ciphertext (OS keychain/DPAPI).
- If encryption unavailable, falls back to plaintext (documented ceiling).

## Links

- [[ADR Index]]
- [[../Development Notes/Security Notes]]
