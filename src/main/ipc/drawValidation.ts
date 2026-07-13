import { eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { draws } from '../schema';
import { getDrawCloseDateTime } from '../../shared/drawCloseTime';

export async function getDrawById(drawId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    throw new Error(connection.error ?? 'Database is not connected');
  }
  const db = getDb();
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1);
  return draw ?? null;
}

export async function validateDrawOpen(drawId: number) {
  const draw = await getDrawById(drawId);
  if (!draw) throw new Error('Draw not found');
  if (draw.status === 'locked') throw new Error('Draw is locked. No entries allowed.');

  const closeDateTime = getDrawCloseDateTime({
    drawDate: draw.drawDate,
    closeTime: draw.closeTime,
  });
  if (closeDateTime && new Date() > closeDateTime) {
    throw new Error(
      `Draw closed at ${draw.closeTime}. No entries or returns allowed after draw closing time.`,
    );
  }
}
