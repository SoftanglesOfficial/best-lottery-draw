# SaleRangeTable Excel-like arrow navigation

**Date:** 2026-07-25  
**Status:** superseded for scope — see `docs/2026-07-25-purchase-sale-parity-design.md` §3 (same rules; also TicketNumberTable + purchase reuse of SaleRangeTable)  
**Scope (original):** `SaleRangeTable.tsx` — rules still authoritative for that grid  
**Approach:** Patch in place — shared `handleCellArrow` + existing `focusCell` / column skip  
**Does not change:** Enter / To settle→Rate / Rate Enter add-row / Party combobox

## Goal

Excel-like focus move on the sale worksheet with ← → ↑ ↓ so the operator can reach any editable cell without the mouse, without breaking caret editing or the existing Enter fast path.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Scope | `SaleRangeTable.tsx` only |
| ←→ | Caret inside text; leave cell only at caret edge |
| ↑↓ | Same column, prev/next row |
| Locked prefix/series | Skip when `!fieldsUnlocked` |
| Grid edges | No wrap |
| Item `<select>` | Arrows move grid focus when picker not consuming keys |
| Open native picker | Native arrows OK if they eat the event |
| Leave To via arrow | Commit draft (`commitTo`) then focus; **no** Rate advance / no add-row |
| Enter flow | Unchanged |
| Party / Draw header | Out of scope |

## §1 Navigation model

Editable focus columns (same as `COL` / `FOCUS_COLS`):

`code` → `item` → `prefix?` → `series?` → `from` → `to` → `rate`

`prevEditableCol` / `nextEditableCol`: walk indices; skip prefix/series when locked. No wrap past first/last editable col or first/last row.

## §2 Left / Right (text `<input>`)

On `ArrowLeft` / `ArrowRight`:

1. If selection is **not** collapsed (range selected): do **not** jump cells — leave native (caret/selection behavior).
2. If collapsed caret:
   - `ArrowLeft` and `selectionStart === 0` → `preventDefault`, settle To if needed, `focusCell` previous editable col (same row). If already first editable col → stay.
   - `ArrowRight` and `selectionStart === value.length` → same toward next editable col; if last → stay.
3. Otherwise: native caret move (no `preventDefault`).

## §3 Up / Down

On `ArrowUp` / `ArrowDown`:

- Always `preventDefault` (avoid page scroll).
- Settle/commit To draft if leaving To (see §5).
- `focusCell(row ± 1, sameCol)` if that row exists; else stay (no wrap).
- Keep the same `COL` index. Locked prefix/series may still receive focus (readOnly); ←→ continue to skip them when leaving that cell.

## §4 Item `<select>`

- On Arrow* when handler runs: `preventDefault` + move grid focus (treat as no caret; edge always “ready to leave”).
- If browser opens picker and consumes key before/without bubbling: accept (no extra detection).

Do **not** call `advanceFrom` / add-row from arrows.

## §5 Leaving To

If current col is `to` and arrow will move focus:

1. `clearToSettleTimer()`
2. If `toDraft` for this row: `commitTo(index, toDraft.value)` (write `to` or keep prior on empty/cancel path per existing `commitTo`)
3. Do **not** call `commitToAndAdvance`
4. Then `focusCell` target

## §6 Wiring

Add one helper, e.g. `handleCellArrow(index, col, event)`:

- Ignore if key not Arrow*
- Compute target; if none, return (↑↓ at edge: preventDefault anyway to avoid page scroll)
- Apply §5 if leaving to
- `focusCell` + `setActiveRow`

Call from existing `onKeyDown` on: code, item, prefix, series, from, to, rate (compose with Enter handlers).

## §7 Out of scope

- New hook / new file / purchase table
- Header Party/Draw arrow remap
- Wrap-around, Shift+arrows range select, Ctrl+arrows
- Changing Enter → Rate / add-row behavior

## §8 Verification (manual)

1. From mid-text ←→ moves caret only.
2. Caret at start + ← → previous editable cell; at end + → → next.
3. ↑↓ same column across rows; no wrap at row 0 / last.
4. Locked prefix/series skipped on ←→.
5. To with draft + → → value kept, land on Rate, **no** new row.
6. Enter on To still `commitToAndAdvance` → Rate (existing).
7. Item arrows move cells when picker not open.

## Success criteria

Operator moves to any editable worksheet cell with ←→↑↓ Excel-style; Enter fast path intact; arrow never auto-adds a row or auto-advances Rate.
