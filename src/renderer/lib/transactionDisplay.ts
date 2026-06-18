import { extractTicketNumbers, parseTicketData } from '../../shared/ticketData';

export { extractTicketNumbers, parseTicketData };

export function formatTxnDate(value: Date | string | null | undefined) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
}

export function formatAmount(value: string | null | undefined) {
  if (value == null || value === '') return '—';
  return `₹${value}`;
}

export function formatRanges(ticketData: string | null | undefined) {
  const { ranges } = parseTicketData(ticketData);
  if (ranges.length === 0) return '—';
  return ranges
    .map((range) => {
      const count =
        range.qty ??
        range.count ??
        (Number(range.to) >= Number(range.from) ? Number(range.to) - Number(range.from) + 1 : 0);
      return `${range.from}–${range.to} (${count})`;
    })
    .join(', ');
}

export function rangeCount(from: string, to: string) {
  const start = Number(from);
  const end = Number(to);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return end - start + 1;
}
