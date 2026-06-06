import { and, eq, gt, sql } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { userSessions } from '../schema';

export async function sessionHeartbeat(
  userId: number,
  companyId: number,
  ipAddress?: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    await db
      .insert(userSessions)
      .values({
        userId,
        companyId,
        lastSeen: new Date(),
        ipAddress: ipAddress ?? null,
      })
      .onConflictDoUpdate({
        target: userSessions.userId,
        set: {
          companyId,
          lastSeen: new Date(),
          ipAddress: ipAddress ?? null,
        },
      });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update session',
    };
  }
}

export async function sessionActiveCount(
  companyId: number,
): Promise<{ success: true; count: number } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(userSessions)
      .where(and(eq(userSessions.companyId, companyId), gt(userSessions.lastSeen, cutoff)));

    return { success: true, count: Number(row?.count ?? 0) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to count active sessions',
    };
  }
}

export async function listActiveSessions(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);
    const rows = await db
      .select()
      .from(userSessions)
      .where(and(eq(userSessions.companyId, companyId), gt(userSessions.lastSeen, cutoff)));

    return { success: true as const, sessions: rows };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load sessions',
    };
  }
}
