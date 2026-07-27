# E2E Smoke + Booking Party UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Green route-smoke Playwright coverage, Booking Entry party-create UX matching Add Sale, then deep purchase/sale/booking happy-path tests — mock `window.api` harness only.

**Architecture:** Extract/extend `installMockApi` so every smokable page has mount IPC stubs. Add `route-smoke.spec.ts` (S01–S38). Copy sale’s `createParty` confirm flow into `BookingEntryPage` only (keep `TicketNumberTable`). Add `txn-happy-path.spec.ts` for money flows + booking party cases. Prefer cheap subagent models.

**Tech Stack:** Playwright `@playwright/test`, Vite renderer @`127.0.0.1:4173`, React entry pages, existing `LegacyTransactionShell` / `ConfirmDialog`.

**Spec:** `docs/2026-07-25-e2e-and-booking-party-ux-design.md` (commit `e7d7434`). Vault: Obsidian `docs/best-12-e2e-booking-party-ux.md`.

## Global Constraints

- Booking stays ticket-number grid (`TicketNumberTable`); **no** `SaleRangeTable` / rates / amounts.
- Party create = stockist via first `buyerGroupsList` group + `buyersCreate` (same as `SaleEntryPage`).
- E2E = renderer + mock IPC only — **no** Electron / live Postgres.
- No page-object framework; no shared party hook.
- Prefer fewest files; reuse `installMockApi`.
- After each task: `npx playwright test <files>` green before commit.
- Obsidian update only after Phase tasks that ship (Task 5).
- `docs/superpowers/` is **gitignored** — commit plans/specs under `docs/2026-07-25-*.md`.

## File map

| File | Responsibility |
|------|----------------|
| `tests/e2e/helpers/mockApi.ts` | Shared `MockOptions`, `installMockApi`; mount stubs for smoke + `buyerGroupsList` / `buyersCreate` |
| `tests/e2e/company-shift-flow.spec.ts` | Import helper; keep existing tests |
| `tests/e2e/route-smoke.spec.ts` | S01–S38 route load asserts |
| `tests/e2e/txn-happy-path.spec.ts` | T01–T04, B01–B05 |
| `src/renderer/pages/transactions/BookingEntryPage.tsx` | Party-create confirm + shell props |

---

### Task 1: Extract mock helper + smoke IPC stubs

**Files:**
- Create: `tests/e2e/helpers/mockApi.ts`
- Modify: `tests/e2e/company-shift-flow.spec.ts` (replace local `installMockApi` / `MockOptions` with import)
- Test: existing `tests/e2e/company-shift-flow.spec.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `export type MockOptions = { role?: 'admin' \| 'owner' \| 'manager' \| 'supervisor' \| 'data_entry'; seedCompanyId?: number \| null; seedShiftId?: number \| null; staleShift?: boolean; foreignShift?: boolean; noShiftGroups?: boolean; racingShiftGroups?: boolean; transactionsFailOnce?: boolean; noBuyerGroups?: boolean; }`
  - `export async function installMockApi(page: Page, options?: MockOptions): Promise<void>`
  - localStorage keys: `transactionsCreatePayload`, `buyersCreatePayload`, `buyersCreateCalls` (number string)

- [ ] **Step 1: Move existing mock into helper**

Create `tests/e2e/helpers/mockApi.ts`. Cut `MockOptions` + `installMockApi` from `company-shift-flow.spec.ts` (currently ~lines 5–257) into the helper. Add:

```ts
import { type Page } from '@playwright/test';

export type MockOptions = {
  role?: 'admin' | 'owner' | 'manager' | 'supervisor' | 'data_entry';
  seedCompanyId?: number | null;
  seedShiftId?: number | null;
  staleShift?: boolean;
  foreignShift?: boolean;
  noShiftGroups?: boolean;
  racingShiftGroups?: boolean;
  transactionsFailOnce?: boolean;
  /** When true, buyerGroupsList returns empty groups (booking party B04). */
  noBuyerGroups?: boolean;
};

export async function installMockApi(page: Page, options: MockOptions = {}) {
  await page.addInitScript((mockOptions) => {
    // ... keep ALL existing mock body from company-shift-flow.spec.ts ...
  }, options);
}
```

In `company-shift-flow.spec.ts` replace the cut block with:

```ts
import { installMockApi } from './helpers/mockApi';
```

Keep local `login` helper in the spec file (not exported unless needed later).

- [ ] **Step 2: Add stubs required for route smoke + party create**

Inside the same `window.api` object in `installMockApi`, add (or replace if already present) these methods. Empty-success is enough for smoke; party tests need real create behavior:

```js
// --- mount stubs for master / reports / admin / returns ---
dbGetConfig: async () => ({ success: true, config: { host: '127.0.0.1', port: 5432, database: 'best12_dev', user: 'postgres' } }),
lanGetStatus: async () => ({ isBroadcasting: false, port: 41234, localIp: '127.0.0.1' }),
authGetAllUsers: async () => ({ success: true, users: [{ id: 1, username: 'admin', fullName: 'Admin User', role: 'admin', companyId: null, activeCompanyId: null }] }),
authGetUsers: async () => ({ success: true, users: [{ id: 1, username: 'admin', fullName: 'Admin User', role: 'admin' }] }),
providerGroupsList: async () => ({ success: true, groups: [{ id: 71, name: 'Default Providers', companyId: getId('activeCompanyId') ?? 7 }] }),
providersList: async () => ({
  success: true,
  providers: [{ id: 81, name: 'Lucky Provider', providerGroupId: 71, purchaseRate: '1.5' }],
}),
providersCreate: async (payload) => {
  localStorage.setItem('providersCreatePayload', JSON.stringify(payload));
  return { success: true, provider: { id: 82, name: payload.name, providerGroupId: payload.providerGroupId, purchaseRate: null } };
},
buyerGroupsList: async () => ({
  success: true,
  groups: mockOptions.noBuyerGroups
    ? []
    : [{ id: 61, name: 'Default Buyers', companyId: getId('activeCompanyId') ?? 7 }],
}),
buyersCreate: async (payload) => {
  const calls = Number(localStorage.getItem('buyersCreateCalls') ?? '0') + 1;
  localStorage.setItem('buyersCreateCalls', String(calls));
  localStorage.setItem('buyersCreatePayload', JSON.stringify(payload));
  const buyer = {
    id: 42,
    name: payload.name,
    type: payload.type ?? 'stockist',
    saleRate: '2.5',
    buyerGroupId: payload.buyerGroupId,
  };
  // Append so subsequent buyersList returns the new party
  const prev = JSON.parse(localStorage.getItem('extraBuyers') ?? '[]');
  prev.push(buyer);
  localStorage.setItem('extraBuyers', JSON.stringify(prev));
  return { success: true, buyer };
},
// Update existing buyersList to merge extraBuyers:
// buyers: [ Blue Star Agency, ...JSON.parse(localStorage.getItem('extraBuyers') ?? '[]') ]
itemGroupsList: async () => ({ success: true, groups: [{ id: 91, name: 'Default Items', companyId: getId('activeCompanyId') ?? 7 }] }),
itemSchemesList: async () => ({ success: true, schemes: [] }),
itemSchemesListByItem: async () => ({ success: true, schemes: [] }),
itemSchemesGet: async () => ({ success: false, error: 'Not found' }),
drawResultsList: async () => ({ success: true, results: [] }),
winningTicketsList: async () => ({ success: true, tickets: [] }),
reportsDashboard: async () => ({
  success: true,
  dashboard: { drawsToday: 1, sales: 0, purchases: 0, net: 0 },
}),
auditLogsList: async () => ({ success: true, logs: [] }),
backupsList: async () => ({ success: true, backups: [] }),
diagnosticsGet: async () => ({ success: true, diagnostics: { ok: true } }),
transactionsGetBuyerSaleSummary: async () => ({
  success: true,
  summary: { totalSold: 0, totalReturned: 0, net: 0 },
}),
transactionsGetProviderPurchaseSummary: async () => ({
  success: true,
  summary: { totalPurchased: 0, totalReturned: 0, net: 0 },
}),
```

Keep existing `drawsList`, `buyersList`, `itemsList`, `transactionsCreate`, `transactionsList`, auth/shift stubs unchanged except `buyersList` merge of `extraBuyers`.

- [ ] **Step 3: Run existing E2E to prove extraction did not break**

Run: `npx playwright test tests/e2e/company-shift-flow.spec.ts`

Expected: PASS (same as before extraction).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/helpers/mockApi.ts tests/e2e/company-shift-flow.spec.ts
git commit -m "$(cat <<'EOF'
test: extract installMockApi helper with smoke stubs

EOF
)"
```

---

### Task 2: Route smoke suite (S01–S38)

**Files:**
- Create: `tests/e2e/route-smoke.spec.ts`
- Test: `tests/e2e/route-smoke.spec.ts`
- Consumes: `installMockApi` from Task 1

**Interfaces:**
- Consumes: `installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 })`
- Produces: green smoke covering all rows below

- [ ] **Step 1: Write failing smoke spec**

Create `tests/e2e/route-smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 900 } });

const routes: { path: string; expectText: string | RegExp }[] = [
  { path: '/menu', expectText: 'Add Sale' },
  { path: '/dashboard', expectText: /Welcome,/ },
  { path: '/settings', expectText: /Database|Settings/ },
  { path: '/master/users', expectText: 'Users' },
  { path: '/master/shift-groups', expectText: 'Shift Groups' },
  { path: '/master/shifts', expectText: 'Shifts' },
  { path: '/master/provider-groups', expectText: 'Provider Groups' },
  { path: '/master/providers', expectText: 'Providers' },
  { path: '/master/buyer-groups', expectText: 'Buyer Groups' },
  { path: '/master/buyers', expectText: 'Buyers' },
  { path: '/master/item-groups', expectText: 'Item Groups' },
  { path: '/master/items', expectText: 'Items' },
  { path: '/master/item-schemes-list', expectText: 'Item Schemes' },
  { path: '/item-schemes', expectText: /Item Scheme|New Item Scheme/ },
  { path: '/draws', expectText: 'Draws' },
  { path: '/draws/31/results', expectText: /Result|Draw/ },
  { path: '/transactions/purchase-entry', expectText: 'Add Purchase' },
  { path: '/transactions/purchase', expectText: 'Purchase List' },
  { path: '/transactions/purchase-return', expectText: 'Purchase Return' },
  { path: '/transactions/purchase-returns', expectText: 'Purchase Returns' },
  { path: '/transactions/sale-entry', expectText: 'Add Sale' },
  { path: '/transactions/sale', expectText: 'Sale List' },
  { path: '/transactions/sale-return', expectText: 'Sale Return' },
  { path: '/transactions/sale-returns', expectText: 'Sale Returns' },
  { path: '/transactions/booking-entry', expectText: 'Add Booking' },
  { path: '/transactions/bookings', expectText: 'Bookings' },
  { path: '/transactions/winning-tickets', expectText: 'Winning Tickets' },
  { path: '/transactions/ticket-search', expectText: /Ticket Search|Search/ },
  { path: '/transactions/draw-results', expectText: /Draw Results|Results/ },
  { path: '/reports', expectText: /Summary|Report/ },
  { path: '/reports/pnl', expectText: /Profit|P&L|Loss/ },
  { path: '/reports/buyer-ledger', expectText: /Buyer Ledger|Ledger/ },
  { path: '/reports/provider-ledger', expectText: /Provider Ledger|Ledger/ },
  { path: '/admin/owners', expectText: 'Company Owners' },
  { path: '/admin/companies', expectText: 'Companies' },
  { path: '/admin/audit-logs', expectText: 'Audit Logs' },
  { path: '/admin/backups', expectText: 'Backups' },
  { path: '/admin/diagnostics', expectText: /Diagnostics/ },
];

test.beforeEach(async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
});

for (const route of routes) {
  test(`smoke ${route.path}`, async ({ page }) => {
    await page.goto(route.path);
    await expect(page).not.toHaveURL(/\/$|\/open-company|\/open-shift/);
    await expect(page.getByText(route.expectText).first()).toBeVisible({ timeout: 15000 });
  });
}
```

If a specific `expectText` mismatches real UI copy, fix the string to the page’s actual `PageHeader` / `pageTitle` / `h1` — do not skip the route.

- [ ] **Step 2: Run smoke — fix mock gaps until green**

Run: `npx playwright test tests/e2e/route-smoke.spec.ts`

Expected first run: some FAIL (missing stub or wrong heading). For each failure:

1. If `TypeError: api.X is not a function` → add stub in `mockApi.ts`.
2. If wrong text → adjust `expectText` to real visible title.
3. If redirect to open-company/open-shift → seed options wrong.

Re-run until all smoke tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/route-smoke.spec.ts tests/e2e/helpers/mockApi.ts
git commit -m "$(cat <<'EOF'
test: add Playwright route smoke for ActiveShift modules

EOF
)"
```

---

### Task 3: Booking party-create UX (B01–B04 product + failing tests first)

**Files:**
- Modify: `src/renderer/pages/transactions/BookingEntryPage.tsx`
- Create (or extend): `tests/e2e/txn-happy-path.spec.ts` with B01–B04 first
- Reference: `src/renderer/pages/transactions/SaleEntryPage.tsx` (`applyConfirm` createParty ~218–252, `onRequestCreateParty` ~261–267, ConfirmDialog ~561–575)

**Interfaces:**
- Consumes: `LegacyTransactionShell` props `onRequestCreateParty`, `partyFocusRequest`, `drawFocusRequest`; `api.buyerGroupsList`, `api.buyersCreate`, `api.buyersList`
- Produces: unmatched Book For + Enter opens confirm; Create selects new buyer

- [ ] **Step 1: Write failing booking party tests**

Create `tests/e2e/txn-happy-path.spec.ts` with at least:

```ts
import { expect, test } from '@playwright/test';
import { installMockApi } from './helpers/mockApi';

test.use({ viewport: { width: 1440, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-07-17T07:48:12.000Z'));
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
});

test('B01-B02: unmatched Book For creates stockist party', async ({ page }) => {
  await page.goto('/transactions/booking-entry');
  await expect(page.getByRole('heading', { name: 'Add Booking' })).toBeVisible();

  const party = page.getByLabel('Book For *');
  await party.fill('New Booker Co');
  await party.press('Enter');

  await expect(page.getByText('Create party "New Booker Co" as stockist?')).toBeVisible();
  await page.getByRole('button', { name: 'Create' }).click();

  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('buyersCreatePayload') ?? 'null')),
  ).toMatchObject({
    name: 'New Booker Co',
    companyId: 7,
    buyerGroupId: 61,
    type: 'stockist',
  });
  await expect(party).toHaveValue('New Booker Co');
});

test('B03: cancel party create does not call buyersCreate', async ({ page }) => {
  await page.goto('/transactions/booking-entry');
  const party = page.getByLabel('Book For *');
  await party.fill('Cancel Me');
  await party.press('Enter');
  await page.getByRole('button', { name: /Cancel|No/i }).click();
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('buyersCreateCalls')),
  ).toBeNull();
});

test('B04: no buyer groups shows toast and skips create', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21, noBuyerGroups: true });
  await page.goto('/transactions/booking-entry');
  const party = page.getByLabel('Book For *');
  await party.fill('Orphan Party');
  await party.press('Enter');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(/No buyer group/i)).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => localStorage.getItem('buyersCreateCalls')),
  ).toBeNull();
});
```

Note: B04 re-installs mock after `beforeEach` — either drop `beforeEach` for that test’s seed or clear `localStorage` and use a dedicated `test` without conflicting init. Prefer: remove global `beforeEach` and call `installMockApi` at start of each test.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx playwright test tests/e2e/txn-happy-path.spec.ts -g "B0"`

Expected: FAIL — confirm dialog never appears (`onRequestCreateParty` not wired).

- [ ] **Step 3: Implement party create on BookingEntryPage**

Replace boolean `confirmDelete` with a union confirm state matching sale’s pattern (keep delete):

```tsx
type ConfirmState =
  | null
  | { kind: 'delete'; message: string }
  | { kind: 'createParty'; name: string; message: string };

const [confirm, setConfirm] = useState<ConfirmState>(null);
const [partyFocusRequest, setPartyFocusRequest] = useState(0);
const [drawFocusRequest, setDrawFocusRequest] = useState(0);
```

Wire delete to `setConfirm({ kind: 'delete', message: ... })` instead of `setConfirmDelete(true)`.

Add handlers (copy behavior from `SaleEntryPage` — adapt buyer only):

```tsx
const onRequestCreateParty = useCallback((name: string) => {
  setConfirm({
    kind: 'createParty',
    name,
    message: `Create party "${name}" as stockist?`,
  });
}, []);

const applyConfirm = useCallback(async () => {
  if (!confirm) return;
  if (confirm.kind === 'delete') {
    doDeleteActiveRow();
    setConfirm(null);
    return;
  }
  if (confirm.kind === 'createParty') {
    const name = confirm.name;
    setConfirm(null);
    if (companyId == null) {
      showToast('No active company.', 'error');
      setPartyFocusRequest((n) => n + 1);
      return;
    }
    const groupsResult = await api.buyerGroupsList(companyId);
    if (!groupsResult.success || groupsResult.groups.length === 0) {
      showToast(
        groupsResult.success
          ? 'No buyer group — create one in Master first.'
          : groupsResult.error,
        'error',
      );
      setPartyFocusRequest((n) => n + 1);
      return;
    }
    const createResult = await api.buyersCreate({
      name,
      companyId,
      buyerGroupId: groupsResult.groups[0].id,
      type: 'stockist',
    });
    if (!createResult.success || !createResult.buyer) {
      showToast(createResult.success ? 'Failed to create party.' : createResult.error, 'error');
      setPartyFocusRequest((n) => n + 1);
      return;
    }
    const listResult = await api.buyersList(companyId);
    if (listResult.success) setBuyers(listResult.buyers);
    setBuyerId(createResult.buyer.id);
    setDrawFocusRequest((n) => n + 1);
  }
}, [companyId, confirm, doDeleteActiveRow, showToast]);

const cancelConfirm = useCallback(() => {
  if (confirm?.kind === 'createParty') setPartyFocusRequest((n) => n + 1);
  setConfirm(null);
}, [confirm]);
```

Pass to shell:

```tsx
partyFocusRequest={partyFocusRequest}
drawFocusRequest={drawFocusRequest}
onRequestCreateParty={onRequestCreateParty}
```

Single `ConfirmDialog`:

```tsx
{confirm ? (
  <ConfirmDialog
    message={confirm.message}
    onConfirm={() => void applyConfirm()}
    onCancel={cancelConfirm}
    confirmLabel={confirm.kind === 'createParty' ? 'Create' : 'Confirm'}
  />
) : null}
```

Check `ConfirmDialog` props — if it has no `confirmLabel`, match sale’s actual prop name (`confirmLabel` / `confirmText`) from `SaleEntryPage` usage.

Do **not** change ticket grid, amount, or create payload shape.

- [ ] **Step 4: Re-run B0* tests — expect PASS**

Run: `npx playwright test tests/e2e/txn-happy-path.spec.ts -g "B0"`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/pages/transactions/BookingEntryPage.tsx tests/e2e/txn-happy-path.spec.ts
git commit -m "$(cat <<'EOF'
feat: booking party quick-create matching Add Sale UX

EOF
)"
```

---

### Task 4: Deep money happy-paths (T01–T03, B05) + regression T04

**Files:**
- Modify: `tests/e2e/txn-happy-path.spec.ts`
- Consumes: mock from Task 1; booking UX from Task 3; existing sale flow in `company-shift-flow.spec.ts` as reference

**Interfaces:**
- Consumes: `transactionsCreate` → `localStorage.transactionsCreatePayload`
- Produces: T01 purchase, T02 sale (may `test.describe` import or duplicate minimal sale fill), T03 booking save, list spot-checks

- [ ] **Step 1: Add purchase happy-path (T01)**

```ts
test('T01: purchase entry saves purchase memo', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/purchase-entry');
  await expect(page.getByRole('heading', { name: 'Add Purchase' })).toBeVisible();

  await page.getByLabel('Row 1 item name').selectOption('51');
  await page.getByLabel('Row 1 from ticket').fill('00010');
  await page.getByLabel('Row 1 from ticket').blur();
  await page.getByLabel('Row 1 to ticket').fill('0'); // qty 1 if diff mode: From+0
  await page.getByLabel('Row 1 to ticket').press('Tab');
  await page.getByLabel('Row 1 rate').fill('1.5');
  await page.getByRole('button', { name: 'Save (F2)' }).click();

  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
  ).toMatchObject({ type: 'purchase', companyId: 7, drawId: 31 });

  await page.goto('/transactions/purchase');
  await expect(page.getByText('Purchase List')).toBeVisible();
});
```

If purchase To/diff semantics differ, mirror whatever `PurchaseEntryPage` / existing sale test uses (`fill('2')` for qty 3). Adjust until create payload `type === 'purchase'`.

- [ ] **Step 2: Add sale happy-path (T02)**

Copy the working fill/save assertions from `company-shift-flow.spec.ts` test `enters, edits, saves, and captures the blue sale spreadsheet` (payload expect with `type: 'sale'`). Then:

```ts
await page.goto('/transactions/sale');
await expect(page.getByText('Sale List')).toBeVisible();
```

- [ ] **Step 3: Add booking save (T03 / B05)**

```ts
test('T03/B05: booking saves tickets payload', async ({ page }) => {
  await installMockApi(page, { seedCompanyId: 7, seedShiftId: 21 });
  await page.goto('/transactions/booking-entry');
  await page.getByLabel('Ticket number row 1').fill('12345');
  await page.getByRole('button', { name: 'Save (F2)' }).click();
  await expect(page.getByText(/tickets booked/i)).toBeVisible();
  await expect.poll(() =>
    page.evaluate(() => JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null')),
  ).toMatchObject({
    type: 'booking',
    companyId: 7,
    buyerId: 41,
    drawId: 31,
    amount: null,
  });
  const payload = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('transactionsCreatePayload') ?? 'null'),
  );
  expect(JSON.parse(payload.ticketData)).toEqual({ tickets: [{ number: '12345' }] });

  await page.goto('/transactions/bookings');
  await expect(page.getByText('Bookings')).toBeVisible();
});
```

- [ ] **Step 4: T04 — run existing company-shift suite (regression)**

Run: `npx playwright test tests/e2e/company-shift-flow.spec.ts tests/e2e/route-smoke.spec.ts tests/e2e/txn-happy-path.spec.ts`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/txn-happy-path.spec.ts
git commit -m "$(cat <<'EOF'
test: deep purchase/sale/booking Playwright happy paths

EOF
)"
```

---

### Task 5: Obsidian memory + playwright-skill spot check

**Files:**
- Vault: `docs/best-12-e2e-booking-party-ux.md`, `domains/best-12/README.md`, `LOG.md`
- Optional: playwright-skill visible browser against `http://127.0.0.1:4173` for booking party only

**Interfaces:**
- Consumes: green Task 1–4
- Produces: vault reflects shipped state

- [ ] **Step 1: playwright-skill spot check (optional but preferred)**

```bash
cd "$SKILL_DIR" && node -e "require('./lib/helpers').detectDevServers().then(s => console.log(JSON.stringify(s)))"
```

If Vite @4173 up (or start via `npx playwright test` webServer), write `/tmp/playwright-test-booking-party.js` that opens booking-entry, types unmatched Book For, asserts confirm text, screenshot `/tmp/booking-party.png`. Run via `node run.js`.

- [ ] **Step 2: Update Obsidian**

Via `obsidian` CLI:

- Append to `docs/best-12-e2e-booking-party-ux.md`: phases 1–3 shipped; link commits.
- Set `domains/best-12/README` Current focus back / note E2E+booking party done.
- Append `LOG.md` entry with commit SHAs.

- [ ] **Step 3: No code commit required** unless screenshots/docs in repo added.

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|------------------|------|
| Phase 1 route smoke S01–S38 | Task 2 |
| Mock extract + buyersCreate/buyerGroupsList | Task 1 |
| Phase 2 Booking party UX A | Task 3 |
| B01–B05 | Task 3 + Task 4 B05 |
| Phase 3 T01–T04 | Task 4 |
| Obsidian memory | Task 5 |
| playwright-skill verify | Task 5 |
| Out: SaleRangeTable on booking, Electron live, PO framework | none (skipped) |

Placeholder scan: none remaining after write.

Type consistency: `MockOptions.noBuyerGroups`, localStorage `buyersCreatePayload` / `buyersCreateCalls` / `extraBuyers` used consistently in Tasks 1, 3, 4.

---

## Execution handoff

Plan complete and saved to `docs/2026-07-25-e2e-and-booking-party-ux-plan.md` (tracked). Mirror also under gitignored `docs/superpowers/plans/` if useful locally.

**Two execution options:**

**1. Subagent-Driven (recommended)** — fresh cheap subagent per task, review between tasks

**2. Inline Execution** — this session via executing-plans, batch with checkpoints

**Which approach?**
