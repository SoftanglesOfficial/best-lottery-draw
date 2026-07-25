# Sale Range keyboard fast path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Add Sale (`SaleRangeTable`) keyboard-first: unique Code Enter → From; 5-digit From → To; diff To settle-commit; absolute To one-shot; sticky next row focused on From.

**Architecture:** Localize all UI focus/commit changes in `SaleRangeTable.tsx`. Add one pure `matchItemByCode` helper in `shared/ticketMath.ts` so unique/ambiguous/miss lookup is assert-tested. Reuse existing `resolveTo`, `commitTo`, `tryAdvanceFromRate`, `validateRange`. No new React hook; no shared settle util; no purchase table changes.

**Tech Stack:** Electron/React renderer, existing `SaleRangeTable`, Node assert scripts via `npm test` (`scripts/verify-ticket-math.mjs`).

**Spec:** `docs/2026-07-25-sale-range-keyboard-fast-path-design.md`

## Global Constraints

- Touch `SaleRangeTable.tsx` + `ticketMath.ts` + `verify-ticket-math.mjs` only (plus this plan/spec docs if needed).
- No purchase / `TicketRangeTable` changes.
- No new hook; no shared settle utility file.
- Diff To: commit only on pause (~350ms) / blur / Enter — never first-keystroke-only rule.
- Ambiguous code: error + stay on Code — never silent first-match.
- From Enter advances only when exactly 5 digits.
- Enter on Code/From/To: `preventDefault` + `stopPropagation`.
- Clear settle timer on unmount, row change, commit, Escape/cancel.
- Rate stays off default fast path; sticky next row: code, itemId, prefix, series; focus From.
- Absolute To remains manager one-shot via existing `absoluteToArmed` / `onAbsoluteToConsumed`.

---

### Task 1: `matchItemByCode` + verify asserts

**Files:**
- Modify: `src/shared/ticketMath.ts` (append near other pure helpers)
- Modify: `scripts/verify-ticket-math.mjs` (import + asserts)

**Interfaces:**
- Consumes: items with optional `code` string
- Produces:

```ts
export type MatchItemByCodeResult<T> =
  | { status: 'unique'; item: T }
  | { status: 'none' }
  | { status: 'ambiguous' };

export function matchItemByCode<T extends { code?: string | null }>(
  items: T[],
  rawCode: string,
): MatchItemByCodeResult<T>;
```

Match rule: `(item.code ?? '').trim().toLowerCase() === rawCode.trim().toLowerCase()`. Empty trimmed code → `{ status: 'none' }`. Exactly one match → `unique`. Two or more → `ambiguous`.

- [ ] **Step 1: Write failing asserts in `verify-ticket-math.mjs`**

Add to destructuring: `matchItemByCode`.

```js
const items = [
  { id: 1, code: 'AB' },
  { id: 2, code: 'cd' },
  { id: 3, code: 'DUP' },
  { id: 4, code: 'dup' },
];
assert.equal(matchItemByCode(items, '').status, 'none');
assert.equal(matchItemByCode(items, '  ').status, 'none');
assert.equal(matchItemByCode(items, 'nope').status, 'none');
assert.deepEqual(matchItemByCode(items, 'ab'), { status: 'unique', item: items[0] });
assert.deepEqual(matchItemByCode(items, '  CD '), { status: 'unique', item: items[1] });
assert.equal(matchItemByCode(items, 'dup').status, 'ambiguous');
```

- [ ] **Step 2: Run verify to confirm fail**

Run: `node scripts/verify-ticket-math.mjs`  
Expected: FAIL (export missing / not a function)

- [ ] **Step 3: Implement `matchItemByCode` in `ticketMath.ts`**

```ts
export type MatchItemByCodeResult<T> =
  | { status: 'unique'; item: T }
  | { status: 'none' }
  | { status: 'ambiguous' };

export function matchItemByCode<T extends { code?: string | null }>(
  items: T[],
  rawCode: string,
): MatchItemByCodeResult<T> {
  const needle = String(rawCode ?? '').trim().toLowerCase();
  if (!needle) return { status: 'none' };
  const hits = items.filter(
    (item) => (item.code ?? '').trim().toLowerCase() === needle,
  );
  if (hits.length === 0) return { status: 'none' };
  if (hits.length > 1) return { status: 'ambiguous' };
  return { status: 'unique', item: hits[0] };
}
```

- [ ] **Step 4: Re-run verify**

Run: `node scripts/verify-ticket-math.mjs`  
Expected: PASS (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/shared/ticketMath.ts scripts/verify-ticket-math.mjs
git commit -m "feat(ticketMath): unique/ambiguous item code match"
```

---

### Task 2: Sticky next row + From focus

**Files:**
- Modify: `src/renderer/components/transactions/SaleRangeTable.tsx` — `addRow` (~204–212)

**Interfaces:**
- Consumes: `rows[afterIndex]` sticky fields; `emptySaleRangeRow(defaultRate)`
- Produces: new row with `code`, `itemId`, `prefix`, `series` copied; `from`/`to` empty; focus `COL.from`

- [ ] **Step 1: Replace `addRow` body**

```ts
const addRow = (afterIndex: number) => {
  const prev = rows[afterIndex];
  const blank = {
    ...emptySaleRangeRow(defaultRate),
    code: prev?.code ?? '',
    itemId: prev?.itemId ?? null,
    prefix: prev?.prefix ?? '',
    series: prev?.series ?? '',
  };
  const next = [...rows];
  next.splice(afterIndex + 1, 0, blank);
  onChange(next);
  setActiveRow(afterIndex + 1);
  focusCell(afterIndex + 1, COL.from);
};
```

- [ ] **Step 2: Manual check note** — after later tasks, confirm new row lands on From with sticky fields (smoke step 6).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/transactions/SaleRangeTable.tsx
git commit -m "feat(sale): sticky item fields; focus From on new row"
```

---

### Task 3: Code Enter unique lookup → From

**Files:**
- Modify: `SaleRangeTable.tsx` — imports + Code `onKeyDown` (~381–386)

**Interfaces:**
- Consumes: `matchItemByCode(items, row.code)`, `handleItemChange`, `focusCell`, `onRowError`
- Produces: unique → filled row + focus From; none/ambiguous → toast + stay Code

- [ ] **Step 1: Import helper**

```ts
import {
  calculateAmount,
  calculateQuantity,
  matchItemByCode,
  resolveTo,
  validateRange,
  isFiveDigitTicket,
} from '../../../shared/ticketMath';
```

- [ ] **Step 2: Replace Code Enter handler**

```ts
onKeyDown={(event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  event.stopPropagation();
  const match = matchItemByCode(items, row.code);
  if (match.status === 'none') {
    onRowError?.(row.code.trim() ? 'No item matches this code.' : 'Enter an item code.');
    return;
  }
  if (match.status === 'ambiguous') {
    onRowError?.('Multiple items share this code. Pick the item from the list.');
    return;
  }
  handleItemChange(index, match.item.id);
  focusCell(index, COL.from);
}}
```

(`ItemRecord` has `id` — use `match.item.id`.)

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/transactions/SaleRangeTable.tsx
git commit -m "feat(sale): Code Enter resolves unique item then focuses From"
```

---

### Task 4: Strict From auto-advance + Enter gate

**Files:**
- Modify: `SaleRangeTable.tsx` — From input `onChange` / `onKeyDown` (~501–520)

**Interfaces:**
- Consumes: `isFiveDigitTicket`, `focusCell`, `COL.to`
- Produces: auto-focus To only at exactly 5 digits; Enter advances only if valid

- [ ] **Step 1: Update From handlers**

```ts
onChange={(event) => {
  const from = event.target.value.replace(/\D/g, '').slice(0, 5);
  updateRow(index, { from });
  if (isFiveDigitTicket(from)) focusCell(index, COL.to);
}}
onKeyDown={(event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  event.stopPropagation();
  if (!isFiveDigitTicket(row.from)) {
    setInvalidCell(`${index}:from`);
    onRowError?.('From must be exactly 5 digits.');
    return;
  }
  focusCell(index, COL.to);
}}
```

Keep existing `onBlur` pad behavior.

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/transactions/SaleRangeTable.tsx
git commit -m "feat(sale): From advances only when exactly 5 digits"
```

---

### Task 5: To settle timer (diff) + absolute 5 + cleanup

**Files:**
- Modify: `SaleRangeTable.tsx` — component body + To input handlers

**Interfaces:**
- Consumes: `commitTo`, `advanceFrom` / post-commit advance, `absoluteToArmed`, `toDraft`
- Produces: diff settle commit; absolute immediate at 5; no advance on fail; timer cleared on unmount/row change/commit/Escape

- [ ] **Step 1: Add settle constant + ref near other refs**

```ts
/** # ponytail: 350ms settle; bump if operators clip multi-digit diffs */
const TO_SETTLE_MS = 350;
const toSettleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const clearToSettleTimer = () => {
  if (toSettleTimerRef.current != null) {
    clearTimeout(toSettleTimerRef.current);
    toSettleTimerRef.current = null;
  }
};
```

- [ ] **Step 2: Helper to commit To then advance (only on success)**

```ts
const commitToAndAdvance = (index: number, rawInput: string) => {
  clearToSettleTimer();
  if (!commitTo(index, rawInput)) return;
  // skip Rate on fast path: jump to add-row path
  const next = nextTypingCol(COL.to);
  if (next === 'add' || next === COL.rate) {
    void tryAdvanceFromRate(index);
    return;
  }
  focusCell(index, next);
};
```

Note: `nextTypingCol(COL.to)` returns `rate` if `canEditRate`, else `'add'`. Spec: Rate off fast path — always treat post-To success as `tryAdvanceFromRate` (same as skipping Rate).

Simpler (preferred):

```ts
const commitToAndAdvance = (index: number, rawInput: string) => {
  clearToSettleTimer();
  if (!commitTo(index, rawInput)) return;
  void tryAdvanceFromRate(index);
};
```

- [ ] **Step 3: Clear timer on unmount + active row change**

```ts
useEffect(() => () => clearToSettleTimer(), []);

useEffect(() => {
  clearToSettleTimer();
}, [activeRowIndex]);
```

- [ ] **Step 4: Replace To `onChange` / `onBlur` / `onKeyDown` / `onFocus`**

```ts
onChange={(event) => {
  const maxLen = absoluteToArmed ? 5 : 6;
  const value = event.target.value.replace(/\D/g, '').slice(0, maxLen);
  setToDraft({ index, value });
  clearToSettleTimer();
  if (absoluteToArmed) {
    if (value.length === 5) commitToAndAdvance(index, value);
    return;
  }
  // diff: settle only — never commit on first keystroke alone without pause
  toSettleTimerRef.current = setTimeout(() => {
    toSettleTimerRef.current = null;
    commitToAndAdvance(index, value);
  }, TO_SETTLE_MS);
}}
onFocus={() => {
  clearToSettleTimer();
  setActiveRow(index);
  setToDraft({ index, value: '' });
}}
onBlur={() => {
  clearToSettleTimer();
  if (toDraft?.index === index) {
    // empty draft = cancel (existing commitTo); do not advance on empty
    if (toDraft.value.trim() === '') {
      commitTo(index, toDraft.value);
      return;
    }
    commitToAndAdvance(index, toDraft.value);
  }
}}
onKeyDown={(event) => {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    clearToSettleTimer();
    setToDraft(null);
    setInvalidCell(null);
    return;
  }
  if (event.key !== 'Enter') return;
  event.preventDefault();
  event.stopPropagation();
  if (toDraft?.index === index) {
    commitToAndAdvance(index, toDraft.value);
  }
}}
```

- [ ] **Step 5: Ensure `commitTo` still clears draft/invalid and disarms absolute on success (already does).**

- [ ] **Step 6: Run `node scripts/verify-ticket-math.mjs`** — still PASS.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/transactions/SaleRangeTable.tsx
git commit -m "feat(sale): To settle commit, absolute one-shot, timer cleanup"
```

---

### Task 6: Manual smoke + docs status

**Files:**
- Modify: `docs/2026-07-25-sale-range-keyboard-fast-path-design.md` — set Status to `implemented` when smoke passes (optional same commit)

- [ ] **Step 1: Run full unit gate**

Run: `npm test`  
Expected: all verify scripts PASS

- [ ] **Step 2: Manual smoke** (app running via `npm start`)

Follow design doc Manual smoke script (unique/miss/ambiguous Code; strict From; diff settle `1` vs `10`; absolute 5; Rate not required).

- [ ] **Step 3: Commit docs status if changed**

```bash
git add docs/2026-07-25-sale-range-keyboard-fast-path-design.md
git commit -m "docs: mark sale keyboard fast path implemented"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Unique / none / ambiguous Code Enter | 1, 3 |
| From 5-digit auto + Enter only if valid | 4 |
| Diff settle / blur / Enter; no first-keystroke rule | 5 |
| Absolute 5 + disarm; invalid stay | 5 (`commitTo` + absolute branch) |
| Sticky next row + focus From | 2 |
| Rate off fast path | 5 (`commitToAndAdvance` → `tryAdvanceFromRate`) |
| preventDefault/stopPropagation Enter | 3, 4, 5 |
| Timer cleanup | 5 |
| verify-ticket-math asserts | 1 |
| No TicketRangeTable / hook / settle util | Global |

## Out of scope (do not implement)

- Playwright keyboard e2e
- Full codebase harness / crabbox / `/verify` skill
- Purchase table parity
