import { eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { draws } from '../schema';
import { isDrawPastCloseTime } from '../../shared/drawCloseTime';

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
  if (draw.status === 'closed') {
    throw new Error('Draw is closed. No entries or returns allowed.');
  }

  if (draw.status === 'open' && isDrawPastCloseTime(draw)) {
    // ponytail: write-on-read — auto-close past close_time on validation
    const db = getDb();
    await db
      .update(draws)
      .set({ status: 'closed' })
      .where(eq(draws.id, drawId));
    throw new Error(
      `Draw closed at ${draw.closeTime}. No entries or returns allowed after draw closing time.`,
    );
  }
}
