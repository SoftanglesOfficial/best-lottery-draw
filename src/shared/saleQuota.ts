import { parseTicketData } from './ticketData';

export function assertWithinQuota(maxQty: number, usedQty: number, addingQty: number): void {
  if (usedQty + addingQty > maxQty) {
    throw new Error(
      `Sale quota exceeded (max ${maxQty}, used ${usedQty}, adding ${addingQty}).`,
    );
  }
}

function rangeQty(from: string | number, to: string | number, qty?: number, count?: number): number {
  if (qty != null) return qty;
  if (count != null) return count;
  const start = Number(from);
  const end = Number(to);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, end - start + 1);
}

/** Per-item quantities in ticket_data; booking tickets use drawItemId when ranges lack itemId. */
export function qtyByItemId(
  ticketData: string | null | undefined,
  drawItemId?: number | null,
): Map<number, number> {
  const { ranges, tickets } = parseTicketData(ticketData);
  const counts = new Map<number, number>();

  for (const range of ranges) {
    const itemId = range.itemId ?? drawItemId;
    if (itemId == null) continue;
    const qty = rangeQty(range.from, range.to, range.qty, range.count);
    counts.set(itemId, (counts.get(itemId) ?? 0) + qty);
  }

  if (tickets.length > 0 && drawItemId != null) {
    counts.set(drawItemId, (counts.get(drawItemId) ?? 0) + tickets.length);
  }

  return counts;
}
