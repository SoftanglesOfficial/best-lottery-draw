# Add Sale — Item picker, party create, To→Rate

**Date:** 2026-07-25  
**Status:** implemented (pending manual smoke)  
**Scope:** Add Sale + Sale Return (`SaleRangeTable`, `LegacyTransactionShell`, `SaleEntryPage`)  
**Approach:** Patch in place — Approach 1  
**Supersedes:** To→next-From and “Rate off fast path” in `docs/2026-07-25-sale-range-keyboard-fast-path-design.md` (§1.5–1.6). Code path, From auto-advance, To settle/absolute unchanged.

## Goal

Keyboard-first sale line entry:

1. Item Name opens on focus; Arrow/Enter select; advance to next field without mouse.
2. Unmatched Party Name → Confirm → create stockist in first buyer group (any role that can open Add Sale).
3. After To commits: focus **Rate** on same row; Rate Enter → next row From (sticky).
4. Warnings stay non-modal except create/dup confirms.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| After To | Focus Rate same row (not next From) |
| Rate edit | Always editable in sale grid (drop manager-only `canEditRate`) |
| After Rate | Existing `tryAdvanceFromRate` → sticky next From |
| Party miss trigger | Enter or Tab only; **not** blur |
| Party create | `stockist` + first buyer group; confirm required |
| Create role | `buyers-create` min role `data_entry` (matches Add Sale) |
| Item UI | Keep `<select>`; `showPicker()` on focus when available |
| Sale return | Same shell/table → same behavior |

## §1 Target keyboard path

```
Party (pick OR Enter/Tab → create confirm → pick)
  → Draw (as today)
  → Code Enter unique → From
     OR Item focus → picker → change/Enter → From
  → From (exactly 5) → To
  → To settle / blur-commit / Enter → commit to → focus Rate (same row)
  → Rate Enter → validate → next row From (sticky code/itemId/prefix/series)
```

## §2 Item Name

- File: `SaleRangeTable.tsx` item `<select>`.
- On focus: if `HTMLSelectElement.prototype.showPicker` exists, call `showPicker()` (ignore throw).
- Native Arrow/Enter for options.
- On `change`: keep `handleItemChange`; then `advanceFrom(index, COL.item)` so focus moves to From (prefix/series skipped when locked).
- Enter on select: keep existing `advanceFrom` when already selected.
- Code unique path unchanged (still fills item and focuses From).

**Fallback:** if Electron smoke shows picker never opens, replace with party-style combobox later (out of this cycle).

## §3 Party create-from-field

- File: `LegacyTransactionShell.tsx` + confirm plumbing in `SaleEntryPage.tsx`.
- On Party `keydown` Enter or Tab:
  - If highlight pick available → pick (existing).
  - Else if `partyQuery.trim()` non-empty AND `buyerId == null` AND filtered list empty → `preventDefault` / stop Tab advance → call `onRequestCreateParty?.(trimmedName)`.
  - Else leave Tab/Enter as today.
- Blur: close list only; **never** open create confirm.
- Page handler:
  1. Show `ConfirmDialog`: create «name» as stockist?
  2. Cancel → resolve false; shell keeps focus on Party.
  3. Confirm → `api.buyerGroupsList(companyId)`; if no groups → toast error, abort; if groups → `buyerGroupId = groups[0].id`.
  4. `api.buyersCreate({ name, companyId, buyerGroupId, type: 'stockist' })`.
  5. On success: refresh buyers list; set `buyerId`; focus Draw (or first grid cell if Draw already set — keep simplest: focus Draw select).
  6. On fail: toast; stay Party.
- IPC: `register.ts` `buyers-create` `requireRole` from `'manager'` → `'data_entry'`.
  - Master Buyers UI stays `useRoleGuard(['admin','owner','manager'])` — data_entry still cannot open Master page; only sale quick-create uses lowered IPC.
  - `# ponytail: shared buyers-create role lowered; split quick-create IPC if Master abuse matters`

## §4 To → Rate → next row

- File: `SaleRangeTable.tsx` `commitToAndAdvance`.
- After successful To resolve:
  - Write `to` onto row (rate: do **not** force-advance; keep empty rate editable — if validate needs rate>0 before Rate focus, write `to` only, skip full `validateRange` advance path, focus Rate; validate on Rate Enter).
  - **Do not** splice blank row in `commitToAndAdvance`.
  - Focus `COL.rate` same index.
- If To resolve fails or item missing at To time: toast + stay (today). Prefer: missing item still toast at To; operator fixes Item then re-commits To.
- `canEditRate`: always `true` in this component (page already gated to sale roles).
- Rate field: not `readOnly`; `tabIndex={0}`.
- Rate Enter: keep `tryAdvanceFromRate` (dup `onBeforeAddRow`, sticky splice, focus next From).
- Absolute To / settle timer / From-5 behavior: unchanged.

**Validate timing note:** Today `commitToAndAdvance` runs `validateRange` (needs item + rate>0) before add-row. New path must **not** require rate>0 before focusing Rate. Split:

1. Resolve To → update row `to` → if `itemId == null` toast “Select a lottery type.” + stay.
2. Else focus Rate (even if rate empty/zero).
3. Rate Enter → `validateRange` + add-row.

## §5 Warnings / errors (behavior map)

| Signal | Trigger | Blocks typing | Blocks save | Operator |
|--------|---------|---------------|-------------|----------|
| Close banner | `isDrawPastCloseTime` on sale | No | Yes (server `validateDrawOpen`) | Change draw / unlock |
| Red row | Active row CSS | No | No | Ignore as error paint |
| “Select a lottery type.” | `itemId` null on validate / To gate | Soft stay | Yes | Set item |
| “Rate must be greater than zero.” | Rate Enter / submit | Soft stay | Yes | Enter rate |
| Party create confirm | Enter/Tab unmatched | Modal | N/A | Confirm or Cancel |
| Dup prefix confirm | Before add-row | Modal | N/A | Continue or cancel |

No new banner copy this cycle.

## §6 Files

| File | Change |
|------|--------|
| `SaleRangeTable.tsx` | Item `showPicker` + advance on change; To→Rate; Rate always editable; validate split |
| `LegacyTransactionShell.tsx` | Enter/Tab create request callback |
| `SaleEntryPage.tsx` | Confirm kind `createParty`; groups + `buyersCreate`; refresh buyers |
| `src/main/ipc/register.ts` | `buyers-create` role `data_entry` |
| `docs/2026-07-25-sale-range-keyboard-fast-path-design.md` | Status note: To/Rate superseded |
| This doc | Spec of record |

**Not touched:** purchase `TicketRangeTable`, new libs, Playwright, blur-create, buyer-group picker UI.

## §7 Verification

Manual smoke:

1. Item focus → list opens (or note fail) → select → From.
2. Unknown party + Enter → confirm → Cancel → still Party, no row in DB.
3. Unknown party + Enter → Confirm → buyer exists, selected, Draw focused.
4. data_entry user can complete create (not blocked by IPC).
5. To settle → Rate focused same row; type rate → Enter → next From sticky.
6. Close banner still allows typing; F2 save still fails if draw past close.

Optional: one assert helper only if pure create-default picker extracted; otherwise manual only.

## Success criteria

Operator completes Party (pick or confirm-create) → Code/Item → From → To → Rate → next From with sticky fields, keyboard only on happy path; no To→next-From skip of Rate; no accidental create on blur.
