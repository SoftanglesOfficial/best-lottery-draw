# Purchase ↔ Sale worksheet parity + arrow navigation

**Date:** 2026-07-25  
**Status:** approved (Approach 1 + Rate A + arrow-key standard)  
**Scope:** Add Purchase, Add Purchase Return, Excel-style grids (`SaleRangeTable`, `TicketNumberTable`)  
**Approach:** Parameterize existing sale stack — no clone, no shared transaction factory  
**Related:** `docs/2026-07-25-add-sale-item-party-rate-design.md`, `docs/2026-07-25-sale-range-keyboard-fast-path-design.md`, `docs/2026-07-25-sale-range-excel-arrow-nav-design.md` (arrow § subsumed here for all worksheet screens)

## Goal

Purchase entry / return feel identical to Add Sale / Sale Return: dense blue/orange spreadsheet, same keyboard-first row workflow, same confirms and shortcuts — with purchase business mapping. Operators move the worksheet cursor with ←→↑↓ on every Excel-style entry screen without the mouse.

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| Architecture | Approach 1: reuse `LegacyTransactionShell` + `SaleRangeTable` |
| Rate | Per-row Rate; default `provider.purchaseRate`; editable; To→Rate→next From |
| Party | Shell `parties` / `partyId` (generic); sale maps buyers; purchase maps providers |
| `voucherNo` | Keep in purchase header |
| Provider quick-create | Confirm → first provider group; `providers-create` min role `data_entry` |
| Accents | Blue purchase / orange purchase return (same as sale) |
| Arrow keys | Standard on all Excel-style grids; not a special mode |
| Factory | No mega shared TransactionWorksheet page |
| Rename `SaleRangeTable` file | Out of scope this cycle |

## §1 Mapping

| Sale | Purchase |
|------|----------|
| Party / buyer | Provider / Supplier |
| `buyerId` | `providerId` |
| `buyer.saleRate` | `provider.purchaseRate` |
| buyer sale summary | provider purchase summary |
| F6 Make Sale → sale-entry | F6 Make Purchase → purchase-entry |
| create stockist in first buyer group | create provider in first provider group |
| — | `voucherNo` header field |

## §2 Keyboard fast path (purchase)

```
Provider → Draw → Code Enter unique / Item picker → From (exactly 5)
  → To (diff settle / absolute) → Rate (same row) → Rate Enter → next From (sticky)
```

Parity with sale: unique/ambiguous/miss code toasts; From auto-advance; To settle ~350ms; absolute To manager arm; sticky code/itemId/prefix/series; F2 save; F5 delete row (confirm); F7 search; F8 clear (confirm); Esc exit; manager unlock prefix/series + absolute To.

## §3 Arrow-key cursor (all worksheet grids)

Applies to: Add Sale, Sale Return, Add Purchase, Purchase Return (`SaleRangeTable`), Booking (`TicketNumberTable` blueSpreadsheet).

Rules (from excel-arrow-nav design, now cross-screen):

- **←→:** caret inside text; leave cell only at caret edge (collapsed selection). Range selection → native only.
- **↑↓:** same column, prev/next row; always preventDefault (no page scroll); no wrap.
- Locked prefix/series: skip on ←→ when `!fieldsUnlocked`.
- Leaving To via arrow: `commitTo` only — **not** `commitToAndAdvance` (no Rate auto-advance / no add-row).
- Item `<select>`: arrows move grid when picker does not consume key.
- Enter / To→Rate / Rate Enter / Party combobox: unchanged.
- Header Party/Draw: out of scope for grid arrows (Party list keeps its own ↑↓).

## §4 Shell parameterization

`LegacyTransactionShell` party API:

- Replace buyer-specific props with:
  - `partyId: number | null`
  - `onPartyIdChange: (id: number | null) => void`
  - `parties: { id: number; name: string; detail?: string }[]`
  - `partyLabel?: string` (default `Party Name *`; purchase uses `Provider Name *`)
- Optional purchase header: `voucherNo?: string`, `onVoucherNoChange?: (v: string) => void` — render Voucher field when `onVoucherNoChange` provided.
- SaleEntryPage maps `buyers` → `parties` (`detail` = stockist/seller label).
- PurchaseEntryPage maps `providers` → `parties` (optional detail omit or group name).

## §5 PurchaseEntryPage

Rewrite to mirror SaleEntryPage legacy path:

- Load draws, providers, items; `defaultRate` from selected provider `purchaseRate`.
- `LegacyTransactionShell` + `SaleRangeTable` `variant="blueSpreadsheet"`.
- Create: `providerId`, `voucherNo`, `amount` from `totalSaleRangeAmount(rows)`, `ticket_data` from `saleRangesToTicketData`.
- Return: `transactionsGetProviderPurchaseSummary` banner; F6 → `/transactions/purchase-entry`.
- Confirm kinds: delete / clear / dup / createParty (provider).
- `AppShell.isLegacyEntryRoute`: add `/transactions/purchase-entry`, `/transactions/purchase-return`.
- Thin `PurchaseReturnPage` unchanged pattern (`type="purchase_return"`).

## §6 IPC

- `providers-create` `requireRole` `manager` → `data_entry` (Master Providers UI stays manager+).
- `# ponytail: shared providers-create role lowered; split quick-create IPC if Master abuse matters`
- No new transaction channels; server remains source of truth for create validation.

## §7 Out of scope

- Clone PurchaseRangeTable / second shell
- Mega TransactionWorksheet factory
- Renaming `SaleRangeTable.tsx`
- Lists / reports / full redesign / new libraries
- Header Party↔Draw arrow remap; wrap-around; Shift+arrow ranges
- `TicketRangeTable` (abandoned by purchase after migration; leave as-is)

## §8 Verification

Manual smoke (sale + purchase + booking grid):

1. Purchase: unique Code → From → To → Rate → next From sticky.
2. Provider miss Enter → create confirm → pick → Draw.
3. Purchase return summary banner; F6 Make Purchase.
4. `voucherNo` saves on create.
5. Arrows: caret mid-field; edge leave; ↑↓ no wrap; locked skip; To arrow no add-row.
6. Sale regression: same flows still work.

## Success criteria

Purchase modules feel like Sale: same design language, row workflow, keyboard-first entry, auto-advance, errors/confirms, dense grid. Arrow keys are the standard way to move the worksheet cursor on every Excel-style entry screen.
