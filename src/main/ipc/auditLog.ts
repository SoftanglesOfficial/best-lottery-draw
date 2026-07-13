import { getDb } from '../db';
import { auditLogs } from '../schema';

export async function insertAuditLog(
  userId: number,
  action: string,
  entity: string,
  entityId: number,
  details?: string | Record<string, unknown> | null,
): Promise<void> {
  const db = getDb();
  const storedDetails =
    details == null
      ? null
      : typeof details === 'string'
        ? details
        : JSON.stringify(details);
  await db.insert(auditLogs).values({
    userId,
    action,
    entity,
    entityId,
    details: storedDetails,
  });
}
