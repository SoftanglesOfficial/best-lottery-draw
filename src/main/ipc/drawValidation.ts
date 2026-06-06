import { eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { draws } from '../schema';

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

  if (draw.closeTime) {
    const now = new Date();
    const [hours, minutes] = draw.closeTime.split(':').map(Number);
    const closeDateTime = new Date(draw.drawDate);
    closeDateTime.setHours(hours, minutes, 0, 0);

    if (now > closeDateTime) {
      throw new Error(
        `Draw closed at ${draw.closeTime}. No entries or returns allowed after draw closing time.`,
      );
    }
  }
  return draw;
}
