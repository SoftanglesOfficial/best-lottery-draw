# Excel Entry Auto-Clean + Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-skip sticky/incomplete pad rows on Save, quiet incomplete mid-entry toasts, keep hard validation for real bad rows, and make F2/F5/F7/F8 + Ctrl+A work without Electron stealing F-keys.

**Architecture:** Patch the shared `validateSaleRangeRows` filter and From Enter path in `SaleRangeTable` (Sale/Purchase/returns inherit). Add Ctrl+A on Sale/Purchase pages. One `before-input-event` guard in Electron main. No new hooks or util modules.

**Tech Stack:** Electron 42, React 19, existing `scripts/verify-sale-excel.mjs` (TypeScript transpile asserts).

## Global Constraints

- Spec: `docs/2026-07-27-excel-entry-auto-clean-shortcuts-design.md` (canonical; `docs/superpowers/` is gitignored)
- Never invent From/To/qty/rate
- Server `validateSaleTicketSnapshot` unchanged
- Draw-close banner stays
- Ponytail: fewest files; no new shortcut hook / hygiene util
- Conventional Commits; commit per task; do not push
- Caveman-commit style subjects ≤72 chars

## File map

| File | Responsibility |
|------|----------------|
| `src/shared/ticketMath.ts` | Pure `isCompletableSaleRangeRow` helper |
| `scripts/verify-sale-excel.mjs` | Asserts completable filter + sticky-itemId ignore |
| `src/renderer/components/transactions/SaleRangeTable.tsx` | Use helper in validate; quiet From Enter |
| `src/renderer/pages/transactions/SaleEntryPage.tsx` | Ctrl+A arm; button label |
| `src/renderer/pages/transactions/PurchaseEntryPage.tsx` | Same as Sale |
| `src/main/index.ts` | `before-input-event` for F2/F5/F7/F8 |

---

### Task 1: Completable-row helper + verify script

**Files:**
- Modify: `src/shared/ticketMath.ts`
- Modify: `scripts/verify-sale-excel.mjs`
- Test: `npm test` (includes `verify-sale-excel.mjs`)

**Interfaces:**
- Produces: `export function isCompletableSaleRangeRow(row: { from?: string | null; to?: string | null }): boolean`
  - Returns true iff `String(row.from ?? '').trim()` and `String(row.to ?? '').trim()` are both non-empty
- Consumes: nothing new

- [ ] **Step 1: Write failing asserts in verify-sale-excel.mjs**

Append after existing asserts (before the final `console.log`):

```js
const { findDuplicatePrefixCodeIndex, isCompletableSaleRangeRow } = module.exports;

assert.equal(
  typeof isCompletableSaleRangeRow,
  'function',
  'isCompletableSaleRangeRow exported',
);

assert.equal(
  isCompletableSaleRangeRow({ from: '', to: '', itemId: 1, code: 'M10' }),
  false,
  'sticky itemId alone not completable',
);
assert.equal(
  isCompletableSaleRangeRow({ from: '12345', to: '', itemId: 1 }),
  false,
  'from-only not completable',
);
assert.equal(
  isCompletableSaleRangeRow({ from: '12345', to: '12350', itemId: null }),
  true,
  'span completable even if itemId null (validateRange still fails item later)',
);
assert.equal(
  isCompletableSaleRangeRow({ from: ' 12345 ', to: ' 12350 ' }),
  true,
  'trim whitespace',
);
```

Update the existing destructure at top so `isCompletableSaleRangeRow` is imported once (replace the old single-import line).

- [ ] **Step 2: Run test — expect fail**

Run: `node scripts/verify-sale-excel.mjs`  
Expected: FAIL — `isCompletableSaleRangeRow` undefined / not a function

- [ ] **Step 3: Implement helper in ticketMath.ts**

Add near `validateRange`:

```ts
/** Save/filter: sticky item-only pad rows are not completable. */
export function isCompletableSaleRangeRow(row: {
  from?: string | null;
  to?: string | null;
}): boolean {
  return String(row.from ?? '').trim() !== '' && String(row.to ?? '').trim() !== '';
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `node scripts/verify-sale-excel.mjs`  
Expected: `verify-sale-excel: ok`

- [ ] **Step 5: Commit**

```bash
git add src/shared/ticketMath.ts scripts/verify-sale-excel.mjs
git commit -m "$(cat <<'EOF'
feat(txn): add completable sale-range row helper

EOF
)"
```

---

### Task 2: Auto-clean validateSaleRangeRows + quiet From Enter

**Files:**
- Modify: `src/renderer/components/transactions/SaleRangeTable.tsx`
- Verify: `node scripts/verify-sale-excel.mjs`

**Interfaces:**
- Consumes: `isCompletableSaleRangeRow` from `../../../shared/ticketMath`
- Changes `validateSaleRangeRows` filter from `row.from || row.to || row.itemId != null` to `isCompletableSaleRangeRow(row)`
- From Enter incomplete: `setInvalidCell` only — **remove** `onRowError?.('From must be exactly 5 digits.')`

- [ ] **Step 1: Import helper**

In `SaleRangeTable.tsx`, extend the ticketMath import to include `isCompletableSaleRangeRow`.

- [ ] **Step 2: Change validateSaleRangeRows filter**

Replace:

```ts
const validRows = rows.filter((row) => row.from || row.to || row.itemId != null);
```

With:

```ts
const validRows = rows.filter((row) => isCompletableSaleRangeRow(row));
```

Keep the rest of `validateSaleRangeRows` unchanged (`validateRange`, Row N prefix, qty check).

- [ ] **Step 3: Quiet From Enter**

In the From input `onKeyDown` Enter branch, when `!isFiveDigitTicket(row.from)`:

```ts
if (!isFiveDigitTicket(row.from)) {
  setInvalidCell(`${index}:from`);
  return;
}
```

Do **not** call `onRowError` for this incomplete case.

Leave Code miss/ambiguous toasts and `resolveTo` hard-fail toasts unchanged.

- [ ] **Step 4: Verify**

Run: `node scripts/verify-sale-excel.mjs`  
Expected: ok

Optional: `npx eslint --ext .ts,.tsx src/renderer/components/transactions/SaleRangeTable.tsx` → exit 0

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/transactions/SaleRangeTable.tsx
git commit -m "$(cat <<'EOF'
fix(txn): skip sticky pad rows on Save; quiet From Enter

EOF
)"
```

---

### Task 3: Ctrl+A Arm Absolute To (Sale + Purchase)

**Files:**
- Modify: `src/renderer/pages/transactions/SaleEntryPage.tsx`
- Modify: `src/renderer/pages/transactions/PurchaseEntryPage.tsx`

**Interfaces:**
- Consumes: existing `armAbsoluteTo`, `canManageUnlock`
- Produces: keydown `Ctrl+A` → `armAbsoluteTo` when `canManageUnlock`; button label includes `(Ctrl+A)`

- [ ] **Step 1: SaleEntryPage keydown**

Inside the legacy `handleKeyDown` effect, after the Ctrl+U block, add:

```ts
if ((event.key === 'a' || event.key === 'A') && event.ctrlKey && canManageUnlock) {
  event.preventDefault();
  armAbsoluteTo();
}
```

Add `armAbsoluteTo` to the effect dependency array.

- [ ] **Step 2: SaleEntryPage button label**

In `unlockActions`, change Arm Absolute label to:

```ts
label: absoluteToArmed ? 'Absolute To Armed' : 'Arm Absolute To (Ctrl+A)',
```

Optionally show Unlock hint: `fieldsUnlocked ? 'Lock Fields' : 'Unlock Fields (Ctrl+U)'` — do this for parity.

- [ ] **Step 3: PurchaseEntryPage — same two edits**

Mirror Step 1–2 exactly in `PurchaseEntryPage.tsx`.

- [ ] **Step 4: Verify**

Run: `npx eslint --ext .ts,.tsx src/renderer/pages/transactions/SaleEntryPage.tsx src/renderer/pages/transactions/PurchaseEntryPage.tsx`  
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/transactions/SaleEntryPage.tsx src/renderer/pages/transactions/PurchaseEntryPage.tsx
git commit -m "$(cat <<'EOF'
feat(txn): Ctrl+A arms absolute To on sale/purchase

EOF
)"
```

---

### Task 4: Electron before-input-event F-key guard

**Files:**
- Modify: `src/main/index.ts`

**Interfaces:**
- After `BrowserWindow` created and `registerWindowHandlers(mainWindow)`, register:

```ts
mainWindow.webContents.on('before-input-event', (event, input) => {
  if (input.type !== 'keyDown') return;
  if (input.key === 'F2' || input.key === 'F5' || input.key === 'F7' || input.key === 'F8') {
    event.preventDefault();
  }
});
```

Renderer page handlers still perform the actions. Menu Reload stays `CmdOrCtrl+R`.

- [ ] **Step 1: Add listener** in `createWindow` (or equivalent) right after `registerWindowHandlers(mainWindow)`.

- [ ] **Step 2: Sanity check** — confirm no other `before-input-event` already exists (`rg before-input-event src/main`).

- [ ] **Step 3: Commit**

```bash
git add src/main/index.ts
git commit -m "$(cat <<'EOF'
fix(electron): stop Chromium stealing F2/F5/F7/F8

EOF
)"
```

---

### Task 5: Final verification

**Files:** none (verify only)

- [ ] **Step 1:** Run `node scripts/verify-sale-excel.mjs` — ok
- [ ] **Step 2:** Run `npm test` — all verify scripts pass
- [ ] **Step 3:** Manual smoke checklist from spec §5 (operator / implementer notes in commit body if anything flaky)

No commit unless a fix was needed; if fix needed, commit as `fix(txn): …` then re-run Step 1–2.

---

## Spec coverage (self-review)

| Spec section | Task |
|--------------|------|
| §1 completable filter / validateSaleRangeRows | Task 1–2 |
| §1 no invent / server unchanged | Task 2 (no server edits) |
| §2 quiet From Enter | Task 2 |
| §2 keep Code/resolveTo/Rate toasts | Task 2 (explicit non-change) |
| §3 Ctrl+A + labels | Task 3 |
| §3 F2/F5/F7/F8 Electron guard | Task 4 |
| §5 verify / smoke | Task 1 asserts + Task 5 |
| Booking shortcuts only / no Unlock | no Booking code change (F-key guard covers) |

## Placeholder scan

None. Exact code, paths, commands included.
