# E2E coverage + Booking party UX parity

Date: 2026-07-25  
Status: approved design  
Repo: best-lottery-draw (Best-12)

## Decisions locked

| Decision | Choice |
|----------|--------|
| Booking vs Add Sale | **A — UX parity only**: party create, shell/keyboard/confirms; keep `TicketNumberTable` + `{tickets}` + `amount: null` |
| Playwright depth | **B — route smoke + deep money happy-paths** |
| Build order | **B — smoke first → booking UX → deep txn tests** |
| Architecture | **Approach 1**: split Playwright specs; copy sale party-create into `BookingEntryPage`; reuse `installMockApi` |

## Goal

Prove modules are not broken (smoke + purchase/sale/booking happy-paths), then Booking matches Add Sale **party UX**, keep Obsidian memory current. Run E2E via existing Playwright harness and playwright-skill.

## Out of scope

- Booking ranges / rates / amounts / `SaleRangeTable`
- Full master CRUD, report number asserts, admin deep ops, SessionTimeout
- Real Electron + Postgres E2E
- Page-object framework; shared `useQuickCreateParty` hook (defer until dup hurts)
- `stock_transfer` UI

## Architecture

### Harness

- Renderer Vite @ `http://127.0.0.1:4173` (`playwright.config.ts`)
- Mock `window.api` via `installMockApi` (extract to `tests/e2e/helpers/mockApi.ts` when second spec needs it)
- No Electron launch for this workstream
- Manual/UI spot-check: playwright-skill against detected server

### Phase 1 — Route smoke

- File: `tests/e2e/route-smoke.spec.ts`
- Seed: admin + company + shift
- For each ActiveShift / company-scoped menu route: `goto` → expect heading or primary landmark
- Role-gated admin/report routes: admin mock role
- Fail = crash or auth redirect loop

### Phase 2 — Booking party UX

- File: `src/renderer/pages/transactions/BookingEntryPage.tsx` (+ existing `ConfirmDialog`)
- Wire sale pattern:
  - `confirm` kind `createParty`
  - `onRequestCreateParty` → `LegacyTransactionShell`
  - `applyConfirm`: `buyerGroupsList` → `buyersCreate` (first group, `stockist`) → refresh buyers → select new buyer
  - Cancel: no create; refocus party
- Keep: `TicketNumberTable`, `amount: null`, `{ tickets }`, no items/rates
- Errors: no company / no buyer group / create fail → toast + party refocus (same as sale)

### Phase 3 — Deep money paths

- File: `tests/e2e/txn-happy-path.spec.ts` (or extend existing)
- Flows: purchase save, sale save, booking save (incl. party-create), list spot-check
- Mock must record `transactionsCreate` / `buyersCreate` (extend mock: today has `transactionsCreate` payload in localStorage; **add `buyersCreate` + `buyerGroupsList` stubs** if missing)

## Test case matrix

### Seed (all)

Mock `admin`, company `7`, shift `21`, open draw, ≥1 buyer group; buyers/items/providers as needed.

### Phase 1 — `route-smoke.spec.ts`

| ID | Route | Assert |
|----|-------|--------|
| S01 | `/menu` | Menu / Add Sale link |
| S02 | `/dashboard` | Dashboard shell |
| S03 | `/settings` | Settings heading |
| S04–S14 | `/master/*` + `/item-schemes` | Page title / primary h1 |
| S15 | `/draws` | Draws heading |
| S16 | `/draws/1/results` | Results UI (mock draw id 1) |
| S17–S20 | purchase-entry, purchase, purchase-return, purchase-returns | Entry/list shell |
| S21–S24 | sale-entry, sale, sale-return, sale-returns | same |
| S25–S26 | booking-entry, bookings | same |
| S27–S29 | winning-tickets, ticket-search, draw-results | same |
| S30–S33 | `/reports`, pnl, buyer-ledger, provider-ledger | heading |
| S34–S38 | admin owners, companies, audit-logs, backups, diagnostics | heading (admin) |

Implementation may use one `{ path, expectText }[]` loop.

### Phase 2 — booking party

| ID | Steps | Assert |
|----|-------|--------|
| B01 | Unmatched Book For + Enter/Tab | Confirm create stockist |
| B02 | Confirm Create | `buyersCreate`; party selected; focus advances |
| B03 | Cancel | No create; party refocus |
| B04 | No buyer groups | Toast; no create |
| B05 | Save with tickets | `transactionsCreate` `type:'booking'` + `ticket_data.tickets` |

### Phase 3 — `txn-happy-path.spec.ts`

| ID | Flow | Assert |
|----|------|--------|
| T01 | Purchase entry + Save | `purchase` create; list shows memo |
| T02 | Sale entry + Save | `sale` create; list shows |
| T03 | Booking party-create + ticket + Save | `booking` create; list shows |
| T04 | Existing company-shift login/onboard | stay green |

## Files to touch

| File | Change |
|------|--------|
| `tests/e2e/helpers/mockApi.ts` | Extract `installMockApi`; add buyer group/create stubs |
| `tests/e2e/company-shift-flow.spec.ts` | Import shared helper |
| `tests/e2e/route-smoke.spec.ts` | S01–S38 |
| `tests/e2e/txn-happy-path.spec.ts` | T01–T04 + B01–B05 |
| `BookingEntryPage.tsx` | Party create confirm + shell props |

**No touch:** `SaleRangeTable`, booking ticket JSON shape, IPC contracts, page-object lib.

## Obsidian memory

- Durable vault note: `docs/best-12-e2e-booking-party-ux.md` (links this repo spec)
- Update `domains/best-12/README` Current focus + Timeline when phases ship
- Append `LOG.md` after phase ships

## Success criteria

1. Route smoke green on ActiveShift + admin routes listed above
2. Unmatched Book For → confirm → buyer created → selected
3. Deep: purchase + sale + booking memos via UI; list shows them
4. Vault docs match shipped truth

## Agent execution notes

- Prefer cheap models for subagents (`composer-2.5-fast` / flash-class)
- Order: Phase 1 → Phase 2 → Phase 3 → playwright-skill verify → Obsidian append
- Verify: `npx playwright test`
