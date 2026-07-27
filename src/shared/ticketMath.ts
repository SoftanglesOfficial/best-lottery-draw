/** Pure ticket range math — shared by renderer and main. No React. */

export type ResolveToMode = 'diff' | 'absolute';

export type ResolveToOk = { ok: true; to: string };
export type ResolveToErr = { ok: false; error: string };
export type ResolveToResult = ResolveToOk | ResolveToErr;

export type SaleRangeFields = {
  itemId: number | null | undefined;
  from: string;
  to: string;
  rate: string | number;
};

const FIVE_DIGITS = /^\d{5}$/;
const DIGITS_ONLY = /^\d+$/;

export function isFiveDigitTicket(value: string): boolean {
  return FIVE_DIGITS.test(value);
}

/** Quantity for an inclusive 5-digit range. Invalid/unordered → 0. */
export function calculateQuantity(from: string, to: string): number {
  if (!isFiveDigitTicket(from) || !isFiveDigitTicket(to)) return 0;
  const start = Number(from);
  const end = Number(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return end - start + 1;
}

export function calculateAmount(qty: number, rate: string | number): number {
  const rateNum = typeof rate === 'number' ? rate : Number(rate);
  if (qty <= 0 || Number.isNaN(rateNum)) return 0;
  return qty * rateNum;
}

/** First other row with same prefix+code (trim, case-insensitive). Empty prefix → -1. */
export function findDuplicatePrefixCodeIndex(
  rows: Array<{ code: string; prefix: string }>,
  index: number,
): number {
  const prefix = rows[index]?.prefix?.trim().toLowerCase() ?? '';
  const code = rows[index]?.code?.trim().toLowerCase() ?? '';
  if (!prefix) return -1;
  return rows.findIndex(
    (row, i) =>
      i !== index &&
      (row.prefix?.trim().toLowerCase() ?? '') === prefix &&
      (row.code?.trim().toLowerCase() ?? '') === code,
  );
}

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

/**
 * Resolve To from From + input.
 * - diff: To = From + Number(input); output padded to 5 digits
 * - absolute: input must already be exactly 5 digits (no pad of short input)
 * Empty input in diff → ok:false with empty (caller treats as blank To)
 */
export function resolveTo(
  from: string,
  input: string,
  mode: ResolveToMode,
): ResolveToResult {
  const trimmed = String(input ?? '').trim();

  if (mode === 'absolute') {
    if (!isFiveDigitTicket(trimmed)) {
      return { ok: false, error: 'To must be exactly 5 digits.' };
    }
    if (!isFiveDigitTicket(from)) {
      return { ok: false, error: 'From must be exactly 5 digits.' };
    }
    if (Number(trimmed) < Number(from)) {
      return { ok: false, error: 'To must be greater than or equal to From.' };
    }
    return { ok: true, to: trimmed };
  }

  // diff
  if (trimmed === '') {
    return { ok: false, error: 'empty' };
  }
  if (!DIGITS_ONLY.test(trimmed)) {
    return { ok: false, error: 'To difference must be a number.' };
  }
  if (!isFiveDigitTicket(from)) {
    return { ok: false, error: 'From must be exactly 5 digits.' };
  }

  const fromNum = Number(from);
  const diff = Number(trimmed);
  if (Number.isNaN(diff) || diff < 0) {
    return { ok: false, error: 'To difference must be zero or greater.' };
  }

  const toNum = fromNum + diff;
  if (toNum > 99999) {
    return { ok: false, error: 'To would exceed 99999.' };
  }
  if (toNum < fromNum) {
    return { ok: false, error: 'To must be greater than or equal to From.' };
  }

  return { ok: true, to: String(toNum).padStart(5, '0') };
}

/** Save/filter: sticky item-only pad rows are not completable. */
export function isCompletableSaleRangeRow(row: {
  from?: string | null;
  to?: string | null;
}): boolean {
  return String(row.from ?? '').trim() !== '' && String(row.to ?? '').trim() !== '';
}

export function validateRange(row: SaleRangeFields): string | null {
  if (row.itemId == null) {
    return 'Select a lottery type.';
  }
  if (!isFiveDigitTicket(row.from)) {
    return 'From must be exactly 5 digits.';
  }
  if (!isFiveDigitTicket(row.to)) {
    return 'To must be exactly 5 digits.';
  }
  if (Number(row.to) < Number(row.from)) {
    return 'To must be greater than or equal to From.';
  }
  const rate = typeof row.rate === 'number' ? row.rate : Number(row.rate);
  if (Number.isNaN(rate) || rate <= 0) {
    return 'Rate must be greater than zero.';
  }
  if (calculateQuantity(row.from, row.to) <= 0) {
    return 'To must be greater than or equal to From.';
  }
  return null;
}

/** Server: qty in payload must match inclusive range. */
export function qtyMatchesRange(from: string, to: string, qty: number): boolean {
  return calculateQuantity(from, to) === qty;
}

/** Server/client: validate persisted sale range snapshots against math + optional item master. */
export function validateSaleTicketSnapshot(
  ranges: Array<{
    from?: string | number;
    to?: string | number;
    qty?: number;
    rate?: number;
    itemId?: number;
    code?: string;
    prefix?: string;
    series?: string;
  }>,
  itemById: Map<
    number,
    { code: string | null; prefix: string | null; defaultSeries: string | null }
  > = new Map(),
): string | null {
  if (ranges.length === 0) {
    return 'At least one ticket range is required.';
  }

  for (let index = 0; index < ranges.length; index += 1) {
    const range = ranges[index];
    const rowNo = index + 1;
    const from = String(range.from ?? '');
    const to = String(range.to ?? '');
    const rate = range.rate ?? 0;
    const itemId = range.itemId ?? null;

    const fieldError = validateRange({ itemId, from, to, rate });
    if (fieldError) {
      return `Row ${rowNo}: ${fieldError}`;
    }

    const qty = range.qty ?? calculateQuantity(from, to);
    if (!qtyMatchesRange(from, to, qty)) {
      return `Row ${rowNo}: Quantity does not match From–To range.`;
    }

    if (itemId != null && itemById.size > 0) {
      const item = itemById.get(itemId);
      if (!item) {
        return `Row ${rowNo}: Item not found.`;
      }
      const code = range.code ?? null;
      const prefix = range.prefix ?? null;
      const series = range.series ?? null;
      if (code != null && code !== '' && (item.code ?? '') !== code) {
        return `Row ${rowNo}: Code does not match item master.`;
      }
      if (prefix != null && prefix !== '' && (item.prefix ?? '') !== prefix) {
        return `Row ${rowNo}: Prefix does not match item master.`;
      }
      if (series != null && series !== '' && (item.defaultSeries ?? '') !== series) {
        return `Row ${rowNo}: Series does not match item master.`;
      }
    }
  }

  return null;
}
