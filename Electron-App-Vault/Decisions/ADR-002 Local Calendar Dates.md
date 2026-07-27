---
tags: [decision, adr, dates]
status: accepted
date: 2026-07-24
---

# ADR-002 Local Calendar Dates

## Context

Morning booking product in UTC+ offsets. `Date.toISOString().slice(0,10)` yields **UTC** calendar day → wrong “today” before local midnight offset.

## Decision

All “today” and calendar YYYY-MM-DD comparisons use `src/shared/localDate.ts` (`toLocalDateString`, `isSameCalendarDay`).

## Consequences

- Purchase/Booking already complied; Sale/Draws/reports/main defaults must match.
- Do not reintroduce UTC slice for calendar fields.

## Links

- [[../Architecture/System Overview]]
- [[ADR Index]]
