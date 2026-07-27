---
tags: [decision, adr, security, auth]
status: accepted
date: 2026-07-24
---

# ADR-005 Default Password Gate

## Context

Seed login `admin` / `admin123` is a known LAN risk.

## Decision

If login password equals `admin123`, set `mustChangePassword` and block the UI with `ForceChangePassword` until `auth-change-password` succeeds. Reject setting new password back to the seed value. No schema column (detect at login).

## Ceiling

Only catches the literal seed string, not other weak passwords.

## Links

- [[../Development Notes/Security Notes]]
- [[ADR Index]]
