# Sales Entry Workflow: Keyboard-Driven Focus Flow

## Context
The Sales Entry screen currently requires manual clicks to get started: the party
("Sale Name") field is not focused on page load, and after the party/draw is
selected the user must click into the grid before typing ticket ranges. The
legacy app the user is replicating auto-focuses the name field, jumps straight
into the grid's first "From" cell once the sale is confirmed, and lets the whole
entry proceed via keyboard only. This plan closes that gap using the existing
focus-request plumbing already in the codebase — no new business logic.

**Scope note on requirement #3** (auto-populate Item Code/Name from the first
"From" value): the codebase has no "availability" logic that maps a ticket
number to an item — `ItemRecord` has no from/to range fields, and the only
existing resolution paths are (a) typing an exact Item Code and pressing Enter
(`matchItemByCode` in `src/shared/ticketMath.ts:59`), or (b) picking from the
Item `<select>` dropdown (`handleItemChange` in `SaleRangeTable.tsx:255`).
Since the requirements explicitly forbid introducing new business rules, this
plan does **not** add a new lookup keyed on "From". Item entry keeps its
current mechanism (type Code + Enter, or dropdown) — only the surrounding
focus/keyboard flow changes below.

## Changes

### 1. Autofocus "Sale Name" (party field) on page open
- File: `src/renderer/pages/transactions/SaleEntryPage.tsx`
- Today, `partyFocusRequest` (passed to `LegacyTransactionShell`) only increments
  after a failed party-create fallback or after Save — never on initial mount.
- Add a mount-time bump of `partyFocusRequest` (e.g. in an `useEffect(() => {...}, [])`
  guarded to the legacy Sale/Sale Return flow), so the existing focus effect in
  `LegacyTransactionShell.tsx:127-132` (which focuses + selects `partyInputRef`)
  fires automatically when the page opens. No changes needed to the shell itself.

### 2. Jump to grid's first "From" cell once the sale name is confirmed
- Files: `SaleEntryPage.tsx`, `LegacyTransactionShell.tsx`, `SaleRangeTable.tsx`
- Existing plumbing: `SaleRangeTable` already exposes a `focusCell(rowIndex, col)`
  helper (line ~197) and a `focusItemRequest` prop that triggers
  `focusCell(0, COL.item)` (lines 431-433) — currently only bumped after a failed
  Save.
- Add a new focus-request prop/counter (parallel to `focusItemRequest`), e.g.
  `focusFromRequest`, that calls `focusCell(0, COL.from)` instead of `COL.item`.
- Wire it so that confirming the party name (Enter/blur that resolves the party,
  or immediately after `drawFocusRequest` currently fires per
  `LegacyTransactionShell.tsx:134-138`) bumps `focusFromRequest` instead of (or
  in addition to, depending on existing draw-select requirement) moving focus to
  the Draw select — confirm exact trigger point with existing party-confirm
  handler in `SaleEntryPage.tsx` (~lines 223-251) so we don't disturb the
  existing Draw-select-first behavior if that's still required by another flow
  (e.g. Booking type). Likely: for `sale`/`sale_return` legacy types only, after
  party is confirmed, focus goes straight to grid From instead of Draw.
- **Needs confirmation from user during implementation**: whether Draw-select
  focus should be skipped entirely for Sale Entry, or should still happen but
  be immediately followed by grid focus (check if Draw is even part of the Sale
  Entry legacy screen, since `drawFocusRequest` was found tied to party-create
  success).

### 3. No changes to lookup, validation, save, or shortcuts
- Leave `matchItemByCode`, `resolveTo`, `handleCellArrow`, Enter/Tab navigation,
  `addRow`, `tryAdvanceFromRate`, Ctrl+A absolute-To arming, and all
  `SaleEntryPage.tsx` keyboard shortcuts (F2/F5/F6/F7/F8/F10/F12/Ctrl+U) exactly
  as-is. This is purely additive focus wiring.

## Files to modify
- `src/renderer/pages/transactions/SaleEntryPage.tsx` — bump `partyFocusRequest`
  on mount; bump new `focusFromRequest` after party confirm.
- `src/renderer/components/transactions/LegacyTransactionShell.tsx` — pass through
  new focus-request prop to `SaleRangeTable` (or confirm it's already passed
  directly from `SaleEntryPage`).
- `src/renderer/components/transactions/SaleRangeTable.tsx` — add
  `focusFromRequest` prop + effect mirroring the existing `focusItemRequest`
  effect (lines 431-433), calling `focusCell(0, COL.from)`.

## Verification
- Run the app (`run` skill) and open Sale Entry:
  1. On page open, confirm the Party Name field is focused automatically (no click).
  2. Type/select a party, confirm it resolves (existing behavior) — confirm
     focus lands in the grid's first row "From" cell without a click.
  3. Type a From value, Tab/Enter through To, Code, Item, Rate — confirm existing
     keyboard flow, validation, and toasts are unchanged.
  4. Confirm Save (F2), row-delete (F5), and other shortcuts still work exactly
     as before.
  5. Regression-check Booking/Sale Return types (if they share
     `LegacyTransactionShell`) to ensure the mount-autofocus doesn't break their
     existing flow.
