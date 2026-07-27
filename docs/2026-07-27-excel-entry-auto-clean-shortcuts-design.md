# Excel entry: auto-clean Save + quiet mid-entry + working shortcuts

**Date:** 2026-07-27  
**Status:** approved  
**Approach:** Option 1 — patch shared gate in place (ponytail)  
**Modules:** Sale Entry, Sale Return, Purchase Entry, Purchase Return (`SaleRangeTable` + legacy shell); Booking Entry (shortcuts + Electron F-key guard only)

## Goal

Operators save completed ticket ranges without toast spam from sticky/blank next rows, keep hard rejection of real bad data, and use labeled F-keys / manager unlock keys without Electron stealing them.

## Non-goals

- Remove draw-closed banner
- Change active-row red highlight
- Wire unused `TicketRangeTable`
- Auto-invent From/To/qty/rate
- New shared shortcut hook / hygiene util abstraction
- `stock_transfer` UI

## §1 — Auto-clean Save

**Completable row:** both `from` and `to` non-empty after trim (ticket span started). Sticky `itemId` / code / prefix / series alone does **not** count.

**`validateSaleRangeRows` (`SaleRangeTable.tsx`):**
1. Filter to completable rows only (`from && to`), not `itemId`.
2. Run existing `validateRange` (via padded digits) on each — still reject missing item, bad 5-digit, To &lt; From, bad rate.
3. Zero completable rows → existing “Add at least one…” style error.
4. Row with only From filled (To empty) → ignored on Save (unfinished).
5. Row with From+To but invalid fields → toast with `Row N:` (filtered index among completable rows is acceptable; sheet Sr mismatch is known trade-off, YAGNI to fix).

**`saleRangesToTicketData`:** keep requiring `itemId != null && qty > 0`. Completable + valid rows already imply that after `validateSaleRangeRows` passes. No invented tickets.

**Server:** `validateSaleTicketSnapshot` unchanged — trust boundary stays.

Applies to all callers of `validateSaleRangeRows` / `SaleRangeTable` (Sale, Sale Return, Purchase, Purchase Return).

## §2 — Quiet mid-entry errors

**No toast** (cell `invalidCell` ring / stay only):
- From Enter while not exactly 5 digits
- To settle/Enter/blur soft incomplete (empty draft cancel, incomplete typing)

**Keep toast** + stay on cell:
- Code Enter: empty, miss, ambiguous
- `resolveTo` hard fails: To &lt; From, exceed 99999, non-digit diff, absolute To not 5 digits when operator committed
- Rate Enter / `tryAdvanceFromRate` when `validateRange` fails on a filled attempt
- Save-time validation errors for completable bad rows

**Never invent:** keep `padTicketDigits` blur behavior only when digits present. Do not invent ranges.

Draw-close banner: keep.

## §3 — Shortcuts

| Key | Action | Pages |
|-----|--------|-------|
| F2 | Save | Sale, Purchase, Booking (+ returns via wrappers) |
| F5 | Delete active row | Same (Booking also F3) |
| F7 | Ticket search | Same |
| F8 | Clear worksheet | Same |
| Esc | Exit page | Same; To-cell Esc still clears draft only |
| Ctrl+U | Unlock/lock Prefix+Series | Sale/Purchase manager+ (existing) |
| Ctrl+A | Arm Absolute To | Sale/Purchase manager+ (**new**) |

Button labels: Unlock Fields keep Ctrl+U hint if shown; Arm Absolute To → `Arm Absolute To (Ctrl+A)` (and armed state label may omit shortcut).

**Electron (`src/main/index.ts`):** on main `BrowserWindow` `webContents`, `before-input-event` — when key is F2, F5, F7, or F8, `event.preventDefault()` so Chromium does not reload/steal. Menu Reload stays `CmdOrCtrl+R`.

No new hook file — extend existing page `keydown` handlers + one main listener.

## §4 — Error handling / data integrity

- Client Save: auto-skip incomplete sticky pads; hard-fail bad complete rows.
- Server: unchanged snapshot validation.
- Mid-entry: quiet incomplete; toast real mistakes.
- Shortcuts: preventDefault in renderer + main F-key guard.

## §5 — Testing / smoke

1. Two complete ranges + sticky row 3 (item set, empty From/To) → F2 saves, no Row 3 From toast.
2. Complete row To &lt; From → still errors.
3. From Enter on 3 digits → ring only, no toast.
4. F5 deletes row; window does not reload.
5. Manager Ctrl+A arms Absolute To; button shows Ctrl+A.
6. Purchase + Sale Return same Save/quiet behavior; Booking F2/F5/F7/F8/Esc still work.

Prefer a small unit test on `validateSaleRangeRows` filter behavior if test harness already covers shared ticket math; otherwise manual smoke is enough for UI/Electron parts.

## File touch list

| File | Change |
|------|--------|
| `src/renderer/components/transactions/SaleRangeTable.tsx` | completable filter; quiet From Enter toast |
| `src/renderer/pages/transactions/SaleEntryPage.tsx` | Ctrl+A → `armAbsoluteTo`; button label |
| `src/renderer/pages/transactions/PurchaseEntryPage.tsx` | same |
| `src/main/index.ts` | `before-input-event` F2/F5/F7/F8 |
| Optional test near `ticketMath` / SaleRangeTable validate | sticky-itemId row ignored |

## Success criteria

- Sticky next row never blocks Save.
- Incorrect complete entries still blocked client + server.
- Labeled shortcuts reach app actions; F5 does not reload.
- No new abstractions; fewest files.
