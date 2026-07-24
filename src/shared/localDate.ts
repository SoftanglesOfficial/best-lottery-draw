/** Calendar YYYY-MM-DD in the runtime's local timezone (not UTC). */
export function toLocalDateString(value: Date | string = new Date()): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Compare a Date/ISO value to a YYYY-MM-DD calendar day in local time. */
export function isSameCalendarDay(value: Date | string, dateStr: string): boolean {
  return toLocalDateString(value) === dateStr;
}
