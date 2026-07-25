# Sale Range keyboard fast path

**Date:** 2026-07-25  
**Status:** implemented (pending human manual smoke — see Manual smoke script below)  
**Scope:** `SaleRangeTable` only (Add Sale / Sale Return)  
**Approach:** Patch table in place — no new hook, no shared settle util, no purchase/`TicketRangeTable` changes

## Goal

Fastest keyboard-first sale line entry with zero unnecessary Tab/Enter on the normal path, without breaking multi-digit diff `To` entry. Manager absolute `To` stays a one-shot override.

## Approach

**Approach 1 (chosen):** Localize keyboard/focus behavior in `src/renderer/components/transactions/SaleRangeTable.tsx`. Reuse `resolveTo`, `commitTo`, `tryAdvanceFromRate`, `validateRange`, and page toasts via `onRowError`.

Pure code-match helper may live in `shared/ticketMath.ts` so uniqueness rules are assert-tested (not a settle util / not a React hook).

Rejected: extracted keyboard hook; shared settle util in `ticketAutoComplete.ts`; silent first-match on duplicate codes.

## §1 — Target keyboard path

### 1) Code + Enter

- Master lookup by code: trim + case-insensitive against `items`.
- **Unique hit:** fill `itemId`, `code`, item name (via `itemId`/select), `prefix`, `series`; focus **From**.
- **Ambiguous (2+ matches):** stay on Code; error toast; do not fill; do not advance.
- **Miss / empty:** stay on Code; error toast; do not advance.

### 2) From

- Digits only.
- Auto-advance to **To** only when value is **exactly 5 digits** (valid).
- Incomplete: stay on From.
- Enter is fallback **only when From is already valid (exactly 5 digits)** — never a bypass for invalid/incomplete From.
- Enter always `preventDefault` + `stopPropagation` to avoid form submit.

### 3) To — diff mode (default)

- Buffered digit input (`toDraft`).
- Collect digits; reset settle timer on each keystroke.
- Commit only on: pause (~**350ms**), blur, or Enter (fallback).
- No first-keystroke-only commit rule.
- No fixed max-length guess for “enough.”
- If `resolveTo` fails or input incomplete: stay on To; mark invalid; do not advance.

### 4) To — absolute mode

- Only when manager **ARM ABSOLUTE TO** is armed.
- Full 5 digits → commit once when valid → `onAbsoluteToConsumed` (disarm → diff).
- If invalid or To &lt; From: stay on To; keep error visible; stay armed until success or operator exits field/mode.
- Enter/blur remain fallbacks (same validity rules).

### 5) After successful To commit

- Validate row; honor `onBeforeAddRow`.
- New row sticky: **code, itemId, prefix, series**; clear from/to; keep `defaultRate`.
- Focus **From** on new row (not Code).

### 6) Rate

- Off default fast path; keep `defaultRate`.
- Still reachable via click/Tab when `canEditRate`.
- Enter on Rate may still call `tryAdvanceFromRate`.

### 7) Keyboard hygiene

- Enter on Code / From / To: `preventDefault` + `stopPropagation`; advance only when field valid.

### 8) Settle timer cleanup

Clear To settle timer on: unmount, active-row change, successful commit, Escape/cancel, starting a new draft focus cycle.

## §2 — Edge cases

| Case | Behavior |
|------|----------|
| Code empty + Enter | Stay Code; toast |
| Code miss | Stay Code; toast; no fill |
| Code ambiguous (dup codes) | Stay Code; toast; no fill; no advance |
| Code unique | Fill sticky fields; focus From |
| From &lt; 5 | Stay From; Enter does **not** advance |
| From exactly 5 | Auto-focus To; Enter also focuses To |
| Diff mid-type (`1` then `0`) | Timer resets; commit `10` after settle if ok |
| Diff invalid / incomplete | Stay To; invalid; no advance |
| Diff blur empty draft | Keep prior To; no advance |
| Absolute &lt; 5 | No auto-commit until 5 (or valid Enter/blur) |
| Absolute ok | Commit, disarm, after-commit path |
| Absolute invalid / To &lt; From | Stay To; error; remain armed |
| `onBeforeAddRow` abort | No new row; today’s abort focus |
| Escape / cancel draft | Clear timer; no delayed commit |
| Unmount / row change mid-timer | Clear timer |
| Sale return | Same component → same behavior |

**Settle constant:** `350` ms in `SaleRangeTable`  
`# ponytail: 350ms settle; bump if operators clip multi-digit diffs`

## §3 — Data flow / touch points

| Area | Change |
|------|--------|
| `matchItemByCode` (ticketMath) | Return unique / none / ambiguous |
| Code Enter | Lookup → unique fill + focus From; else toast + stay |
| From `onChange` | Digits; len===5 → focus To |
| From Enter | Advance only if `isFiveDigitTicket(from)` |
| To `onChange` | Diff: arm settle; absolute len===5: try commit+advance |
| To blur / Enter | Clear timer; commit if valid; advance only on success |
| `addRow` | Sticky code+itemId+prefix+series; focus `COL.from` |
| Timer ref | Clear on unmount / row change / commit / Escape |

**Unchanged:** `resolveTo` semantics; `SaleEntryPage` absolute arm / dup confirm; purchase `TicketRangeTable`.

```
Code Enter → unique lookup → fill → focus From
From 5 digits → focus To
To settle/blur/Enter → commitTo → tryAdvanceFromRate → addRow(sticky) → focus From
```

## Verification (this cycle)

- Extend `scripts/verify-ticket-math.mjs` with `matchItemByCode` cases (unique / none / ambiguous).
- Manual keyboard smoke script (below).
- No new Playwright keyboard e2e; no full harness / crabbox / `/verify` skill this cycle.

### Manual smoke script

1. Known unique code → Enter → From; item/prefix/series filled.
2. Unknown code → Enter → stay Code + toast.
3. Duplicate codes in master (if present) → Enter → stay Code + toast.
4. From incomplete + Enter → stay From.
5. From 5 digits → To without Enter.
6. Diff `1`, pause → commit; next row From + sticky.
7. Diff `1` then quick `0` → commit as `10`.
8. Absolute arm → 5 digits → commit + disarm; next From.
9. Absolute invalid → stay To + error; still armed.

## Out of scope

- Purchase / `TicketRangeTable`
- Shared settle utility / new React hook
- Playwright keyboard e2e / full agent harness
- Changing dup-abort focus target
- Configurable settle ms UI

## Success criteria

Operator: Code Enter (unique) → From (5) → To (diff pause or absolute 5) → next From with sticky fields; no Tab/Enter required on normal From/To path except Enter as To fallback; never silent wrong item on ambiguous code; never advance on invalid From/To.
