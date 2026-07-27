# Add Sale Item / Party / Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keyboard-first Add Sale: item picker opens on focus, unmatched party creates via confirm, To focuses Rate then Rate Enter adds next row.

**Architecture:** Patch `SaleRangeTable`, `LegacyTransactionShell`, `SaleEntryPage` in place; lower `buyers-create` IPC role to `data_entry`. No new libs or abstractions.

**Tech Stack:** Electron + React 19, existing `ConfirmDialog`, `api.buyersCreate` / `buyerGroupsList`.

## Global Constraints

- Spec: `docs/2026-07-25-add-sale-item-party-rate-design.md`
- No blur-triggered party create; Enter/Tab only
- To must not splice next row; focus Rate same row
- Rate always editable in sale grid
- No new dependencies
- Sale Return shares same components → same behavior

## File map

| File | Responsibility |
|------|----------------|
| `SaleRangeTable.tsx` | Item showPicker + advance; To→Rate; Rate editable |
| `LegacyTransactionShell.tsx` | `onRequestCreateParty` on Enter/Tab miss |
| `SaleEntryPage.tsx` | `createParty` confirm + create + refresh |
| `register.ts` | `buyers-create` role `data_entry` |

---

### Task 1: To → Rate + Rate editable + Item picker

**Files:**
- Modify: `src/renderer/components/transactions/SaleRangeTable.tsx`

**Interfaces:**
- Produces: `commitToAndAdvance` writes `to`, gates on `itemId`, focuses `COL.rate`; Rate Enter still `tryAdvanceFromRate`

- [ ] **Step 1: Set `canEditRate = true`**

Remove manager gate (and unused `isAtLeastRole` import if unused elsewhere in file).

```tsx
const canEditRate = true;
```

- [ ] **Step 2: Rewrite `commitToAndAdvance` success path**

After resolve To:
- If `row.itemId == null` → toast via `onRowError?.('Select a lottery type.')`, write `to` optional, stay
- Else `updateRow({ to })`, clear draft/timer/absolute, `focusCell(index, COL.rate)`
- Do **not** call `validateRange` for rate, do **not** splice row, do **not** `onBeforeAddRow`

- [ ] **Step 3: Item select open + advance**

On focus: `showPicker?.()` try/catch.
On change: `handleItemChange` then `advanceFrom(index, COL.item)`.

- [ ] **Step 4: Manual check**

From→To settle focuses Rate; Rate Enter adds sticky next From; item change advances.

---

### Task 2: Party create-from-field

**Files:**
- Modify: `LegacyTransactionShell.tsx`, `SaleEntryPage.tsx`, `src/main/ipc/register.ts`

**Interfaces:**
- Consumes: `api.buyerGroupsList`, `api.buyersCreate`, `api.buyersList`
- Produces: `onRequestCreateParty?: (name: string) => void` on shell

- [ ] **Step 1: Lower IPC role**

`register.ts` `'buyers-create'` → `'data_entry'`.

- [ ] **Step 2: Shell callback**

Add prop `onRequestCreateParty?: (name: string) => void`.
On Enter/Tab when `partyQuery.trim()` && `!buyerId` && `filteredBuyers.length === 0`: preventDefault, call callback.
Keep existing Enter pick when filtered has highlight.

- [ ] **Step 3: Page confirm + create**

Extend `ConfirmState` with `{ kind: 'createParty'; name: string }`.
Handler: groups[0] → create stockist → refresh buyers → setBuyerId → focus draw (ref or query).
Cancel: partyFocusRequest bump.
Wire `onRequestCreateParty` to setConfirm.

- [ ] **Step 4: Manual check**

Unmatched Enter → confirm cancel stays; confirm creates buyer.

---

### Task 3: Spec status + smoke note

**Files:**
- Modify: `docs/2026-07-25-add-sale-item-party-rate-design.md` status → implemented

- [ ] **Step 1: Flip status**
- [ ] **Step 2: Done — no auto-commit unless user asks**
