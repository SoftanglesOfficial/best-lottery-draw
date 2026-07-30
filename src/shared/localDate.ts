/** Calendar YYYY-MM-DD in the runtime's local timezone (not UTC). */
export function toLocalDateString(value: Date | string = new Date()): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // ponytail: date-only UI strings — skip UTC Date parse (shifts day in UTC-)
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Start of a YYYY-MM-DD filter day in the runtime's local timezone. */
export function startOfLocalDay(value: string): Date {
  const dateStr = value.slice(0, 10);
  return new Date(`${dateStr}T00:00:00`);
}

/** End of a YYYY-MM-DD filter day in the runtime's local timezone. */
export function endOfLocalDay(value: string): Date {
  const date = startOfLocalDay(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

/** Compare a Date/ISO value to a YYYY-MM-DD calendar day in local time. */
export function isSameCalendarDay(value: Date | string, dateStr: string): boolean {
  return toLocalDateString(value) === dateStr;
}
