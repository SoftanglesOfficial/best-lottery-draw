import type { DrawRecord } from '../../shared/types';

type DrawCloseFields = Pick<DrawRecord, 'drawDate' | 'closeTime' | 'status'>;

export function getDrawCloseDateTime(draw: Pick<DrawRecord, 'drawDate' | 'closeTime'>): Date | null {
  if (!draw.closeTime) return null;

  const [hours, minutes] = draw.closeTime.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;

  const drawDate = draw.drawDate instanceof Date ? draw.drawDate : new Date(draw.drawDate);
  if (Number.isNaN(drawDate.getTime())) return null;

  const closeDateTime = new Date(drawDate);
  closeDateTime.setHours(hours, minutes, 0, 0);
  return closeDateTime;
}

export function isDrawPastCloseTime(draw: DrawCloseFields, now: Date = new Date()): boolean {
  if (!draw.closeTime || draw.status === 'locked') return false;
  const closeDateTime = getDrawCloseDateTime(draw);
  if (!closeDateTime) return false;
  return now.getTime() > closeDateTime.getTime();
}

export function isDrawClosingWithin(
  draw: DrawCloseFields,
  withinMs: number,
  now: Date = new Date(),
): boolean {
  if (!draw.closeTime || draw.status === 'locked') return false;
  const closeDateTime = getDrawCloseDateTime(draw);
  if (!closeDateTime) return false;
  const diff = closeDateTime.getTime() - now.getTime();
  return diff > 0 && diff <= withinMs;
}

export function formatCloseTimeLabel(closeTime: string | null | undefined): string {
  if (!closeTime) return '—';
  const [hours, minutes] = closeTime.split(':');
  if (hours == null || minutes == null) return closeTime;
  const hour = Number(hours);
  const minute = Number(minutes);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return closeTime;
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes.padStart(2, '0')} ${period}`;
}
