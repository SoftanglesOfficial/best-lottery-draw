# Purchase ↔ Sale parity — manual smoke checklist

**Date:** 2026-07-25  
**Design:** [2026-07-25-purchase-sale-parity-design.md](./2026-07-25-purchase-sale-parity-design.md) §8  
**Automated helpers:** `node scripts/verify-worksheet-arrow.mjs` (locked-column arrow order); full suite via `npm test`.

Run after purchase/sale/arrow changes. Check each box in the app (logged in, active company, open draw).

---

## Sale regression (must still work)

| # | Screen | Steps | Pass |
|---|--------|-------|------|
| S1 | Add Sale | Unique Code → Enter → From (5 digits) → To (diff or absolute) → Rate → Rate Enter → focus next row **From** with same code/item/prefix/series | ☐ |
| S2 | Add Sale | Ambiguous code → item picker; miss → toast | ☐ |
| S3 | Add Sale | F2 save; F5 delete row (confirm); F8 clear (confirm); Esc exit | ☐ |
| S4 | Sale Return | Provider/party summary banner visible; **F6 Make Sale** → `/transactions/sale-entry` | ☐ |
| S5 | Add Sale | Quick-create buyer confirm → new party in first buyer group → can complete row | ☐ |

---

## Purchase path (keyboard fast path)

| # | Screen | Steps | Pass |
|---|--------|-------|------|
| P1 | Add Purchase | Provider → Draw → unique Code Enter → From → To → Rate → Rate Enter → **next From sticky** (same code/item/prefix/series) | ☐ |
| P2 | Add Purchase | Default Rate = selected provider **purchaseRate**; editable per row | ☐ |
| P3 | Add Purchase | To diff settle (~350 ms); absolute To requires manager unlock | ☐ |
| P4 | Add Purchase | Blue spreadsheet chrome; legacy AppShell (no standard page chrome) | ☐ |
| P5 | Add Purchase | F2 save creates purchase with `providerId`, `ticket_data`, computed amount | ☐ |

---

## Provider quick-create

| # | Screen | Steps | Pass |
|---|--------|-------|------|
| V1 | Add Purchase | Unknown provider name + Enter on party field → **create confirm** → provider created in **first provider group** → pick provider → continue to Draw/grid | ☐ |
| V2 | Add Purchase | `data_entry` role can quick-create via IPC (Master Providers UI still manager+) | ☐ |

---

## voucherNo

| # | Screen | Steps | Pass |
|---|--------|-------|------|
| N1 | Add Purchase | Enter value in **Voucher** header field before save | ☐ |
| N2 | Add Purchase | After F2 create, reopen or list txn — **voucherNo persisted** on transaction | ☐ |

---

## Purchase return summary + F6

| # | Screen | Steps | Pass |
|---|--------|-------|------|
| R1 | Purchase Return | Summary banner shows provider purchase context (parity with sale return banner) | ☐ |
| R2 | Purchase Return | **F6 Make Purchase** → `/transactions/purchase-entry` | ☐ |

---

## Arrow navigation (SaleRangeTable + booking grid)

Applies: Add Sale, Sale Return, Add Purchase, Purchase Return (`SaleRangeTable`); Booking (`TicketNumberTable` blueSpreadsheet).

| # | Case | Expected | Pass |
|---|------|----------|------|
| A1 | ←→ caret **mid-field** | Caret moves inside text; **does not** leave cell | ☐ |
| A2 | ←→ at **caret edge** | Moves to prev/next editable column on same row | ☐ |
| A3 | ↑↓ | Same column, previous/next row; **no page scroll**; **no wrap** at first/last row | ☐ |
| A4 | Locked prefix/series (`!fieldsUnlocked`) | ←→ **skips** prefix/series columns | ☐ |
| A5 | Leave **To** via arrow | `commitTo` only — **no** auto-advance to Rate, **no** add-row | ☐ |
| A6 | Item `<select>` | ↑↓ moves grid when picker does not consume key | ☐ |
| A7 | Enter / To→Rate / Rate Enter | Unchanged vs pre-arrow behavior | ☐ |
| A8 | Booking grid | ↑↓ column move on ticket number table (same rules where applicable) | ☐ |

**Automated (column order when locked):** `node scripts/verify-worksheet-arrow.mjs` — asserts item→from and to boundaries when prefix/series locked.

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|-------|
| Tester | | | |
