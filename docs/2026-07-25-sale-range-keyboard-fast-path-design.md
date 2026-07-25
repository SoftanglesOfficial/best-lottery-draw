# Sale Range keyboard fast path

**Date:** 2026-07-25  
**Status:** approved in dialogue; awaiting written-spec review  
**Scope:** `SaleRangeTable` only (Add Sale / Sale Return)  
**Approach:** Patch table in place — no new hook, no shared util, no purchase/`TicketRangeTable` changes

## Goal

Fastest keyboard-first sale line entry with zero unnecessary Tab/Enter on the normal path, without breaking multi-digit diff `To` entry. Manager absolute `To` stays a one-shot override.

## Approach

**Approach 1 (chosen):** Localize all behavior in `src/renderer/components/transactions/SaleRangeTable.tsx`. Reuse `resolveTo`, existing `commitTo` / `tryAdvanceFromRate` / `validateRange`, and page toasts via `onRowError`.

Rejected: extracted keyboard hook; shared settle util in `ticketAutoComplete.ts` (add only if purchase later needs the same).

## §1 — Target keyboard path

### 1) Code + Enter

- Master lookup by code: trim + case-insensitive match against `items`.
- **Hit:** fill `itemId`, `code`, item name (via select/`itemId`), `prefix`, `series`; focus **From**.
- **Miss / empty:** keep focus on Code; error toast; do not advance.

### 2) From

- Digits only (existing sanitize).
- At exactly **5** digits, auto-focus **To**. No Enter required.

### 3) To — diff mode (default)

- Buffered digit input (existing `toDraft`).
- Keep collecting digits; reset settle timer on each keystroke.
- Auto-commit when:
  - operator pauses (~**350ms**), or
  - field blurs, or
  - Enter (fallback)
- Do **not** commit on first keystroke alone.
- Do **not** use a fixed max-length guess to decide “enough.”
- Invalid / incomplete (`resolveTo` fail): stay in To; mark invalid; no new row.

### 4) To — absolute mode

- Only when manager **ARM ABSOLUTE TO** is armed.
- At exactly **5** valid digits: commit immediately; call `onAbsoluteToConsumed` (disarm → diff).
- Enter/blur remain fallbacks.

### 5) After successful To commit

- Validate row (`validateRange` / existing path through `tryAdvanceFromRate`).
- Honor `onBeforeAddRow` (e.g. dup prefix+code confirm).
- New row sticky: **code, itemId, prefix, series** from committed row; clear from/to; keep `defaultRate`.
- Focus lands on **From**, not Code.

### 6) Rate

- Not on default fast path.
- Keep `defaultRate` on new rows.
- Still reachable via click/Tab when `canEditRate`.
- Enter on Rate may still call `tryAdvanceFromRate`.

## §2 — Edge cases

| Case | Behavior |
|------|----------|
| Code empty + Enter | Stay Code; toast |
| Code miss | Stay Code; toast; no fill |
| Ambiguous duplicate codes in master | First case-insensitive match (`# ponytail:` tighten if prod dupes appear) |
| From &lt; 5 | Stay From; Enter remains optional fallback to advance |
| From length 5 | Focus To |
| Diff mid-type (`1` then `0` → `10`) | Timer resets; commit only after settle if `resolveTo` ok |
| Diff settle / blur / Enter with invalid | Stay To; invalid UI; no advance |
| Diff blur empty draft | Keep prior To (today); no advance |
| Absolute &lt; 5 | No length-based auto-commit until 5 (or Enter/blur) |
| Absolute ok | Commit, disarm, then after-commit path |
| Absolute To &lt; From | Stay To; error; stay armed until success or leave |
| `onBeforeAddRow` abort | No new row; keep today’s abort focus (Code / unlocked Prefix) |
| Unmount / delete mid-timer | Clear settle timer; no stray commit |
| Sale return | Same component → same behavior |

**Settle constant:** `350` ms in `SaleRangeTable`  
`# ponytail: 350ms settle; bump if operators clip multi-digit diffs`

## §3 — Data flow / touch points

Single file: `SaleRangeTable.tsx`.

| Area | Change |
|------|--------|
| Code `onKeyDown` Enter | Lookup item by code → `handleItemChange`-equivalent fill → `focusCell(index, COL.from)` on hit |
| From `onChange` | After sanitize, if length === 5 → `focusCell(index, COL.to)` |
| To `onChange` | Update draft; absolute + len 5 → `commitTo` + advance; else (diff) reset/clear `setTimeout` settle → `commitTo` + advance when ok |
| To blur / Enter | Existing commit; Enter still advances; clear pending timer first |
| `addRow` | Sticky `code`, `itemId`, `prefix`, `series` (not code-only); `focusCell(..., COL.from)` |
| Cleanup `useEffect` | Clear settle timer on unmount |

**Unchanged:** `resolveTo` in `shared/ticketMath.ts`; `SaleEntryPage` absolute arm / dup confirm wiring; purchase `TicketRangeTable`.

**Call graph (fast path):**

```
Code Enter → lookup → fill sticky fields → focus From
From 5 digits → focus To
To settle/blur/Enter → commitTo(resolveTo) → tryAdvanceFromRate → addRow(sticky) → focus From
```

## Verification (this cycle)

- Manual keyboard script (below) after implement.
- Reuse existing `resolveTo` tests if present; no new util → no new unit file required for settle (timer is UI).
- Existing e2e (`company-shift-flow.spec.ts`) only navigates/screenshots sale-entry — **no** new Playwright keyboard e2e this cycle.
- Full `setup-codebase-harness` / `/verify` skill / crabbox: **out of scope**. Optional `/loop` smoke reminder after ship.

### Manual smoke script

1. Open Add Sale; pick party + draw.
2. Type known item code → Enter → focus From; item/prefix/series filled.
3. Type unknown code → Enter → stay Code + toast.
4. Type 5-digit From → focus jumps to To without Enter.
5. Diff: type `1`, wait ~350ms → commits; next row From focused; sticky fields present.
6. Diff: type `1` then quickly `0` → commits as `10` (not `1`).
7. Arm absolute To → type 5 digits → commits, disarms; next From.
8. Rate not required on path; Tab/click still edits Rate when allowed.

## Out of scope

- Purchase / `TicketRangeTable`
- New hooks or shared settle helpers
- Playwright keyboard e2e / full agent harness for this feature
- Changing dup-abort focus target
- Configurable settle ms UI

## Success criteria

Operator can: Code → Enter → From (5) → To (diff pause or absolute 5) → next row From with sticky item fields, with no Tab/Enter on the normal From/To path except Enter as To fallback.
