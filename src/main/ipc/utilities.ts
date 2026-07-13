import { and, eq, inArray } from 'drizzle-orm';
import { ensureConnected, getDb, getPool } from '../db';
import { auditLogs, buyers, providers, transactions } from '../schema';
import { validateDrawOpen } from './drawValidation';
import { insertAuditLog } from './auditLog';
import type { BuyerRecord, ProviderRecord } from '../../shared/types';
  buyerId: number,
  newRate: number,
  userId: number,
): Promise<{ success: true; buyer: BuyerRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [updated] = await db
      .update(buyers)
      .set({ saleRate: String(newRate), updatedAt: new Date() })
      .where(eq(buyers.id, buyerId))
      .returning();
    if (!updated) return { success: false, error: 'Buyer not found' };
    await insertAuditLog(userId, 'RATE_CHANGED', 'buyers', buyerId, {
      field: 'sale_rate',
      newValue: newRate,
    });
    return { success: true, buyer: updated as BuyerRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update buyer rate',
    };
  }
}

export async function changeProviderRate(
  providerId: number,
  newRate: number,
  userId: number,
): Promise<{ success: true; provider: ProviderRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [updated] = await db
      .update(providers)
      .set({ purchaseRate: String(newRate), updatedAt: new Date() })
      .where(eq(providers.id, providerId))
      .returning();
    if (!updated) return { success: false, error: 'Provider not found' };
    await insertAuditLog(userId, 'RATE_CHANGED', 'providers', providerId, {
      field: 'purchase_rate',
      newValue: newRate,
    });
    return { success: true, provider: updated as ProviderRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update provider rate',
    };
  }
}

export async function changeCommission(
  partyType: 'buyer' | 'provider',
  partyId: number,
  newRate: number,
  userId: number,
): Promise<
  | { success: true; party: BuyerRecord | ProviderRecord }
  | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    if (partyType === 'buyer') {
      const [updated] = await db
        .update(buyers)
        .set({ commission: String(newRate), updatedAt: new Date() })
        .where(eq(buyers.id, partyId))
        .returning();
      if (!updated) return { success: false, error: 'Buyer not found' };
      await insertAuditLog(userId, 'RATE_CHANGED', 'buyers', partyId, {
        field: 'commission',
        newValue: newRate,
      });
      return { success: true, party: updated as BuyerRecord };
    }
    const [updated] = await db
      .update(providers)
      .set({ commission: String(newRate), updatedAt: new Date() })
      .where(eq(providers.id, partyId))
      .returning();
    if (!updated) return { success: false, error: 'Provider not found' };
    await insertAuditLog(userId, 'RATE_CHANGED', 'providers', partyId, {
      field: 'commission',
      newValue: newRate,
    });
    return { success: true, party: updated as ProviderRecord };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update commission',
    };
  }
}

export async function bulkRateUpdate(
  buyerGroupId: number,
  newRate: number,
  userId: number,
): Promise<{ success: true; updated: number } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const updated = await db
      .update(buyers)
      .set({ saleRate: String(newRate), updatedAt: new Date() })
      .where(eq(buyers.buyerGroupId, buyerGroupId))
      .returning({ id: buyers.id });
    await insertAuditLog(userId, 'BULK_RATE_CHANGED', 'buyer_groups', buyerGroupId, {
      field: 'sale_rate',
      newValue: newRate,
      count: updated.length,
    });
    return { success: true, updated: updated.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to bulk update rates',
    };
  }
}

export async function deleteMemos(
  drawId: number,
  memoIds: number[],
  ctx: SessionContext,
): Promise<{ success: true; deleted: number } | { success: false; error: string }> {
  if (ctx.role !== 'admin') {
    return { success: false, error: 'Only administrators can delete multiple memos' };
  }
  if (memoIds.length === 0) {
    return { success: false, error: 'No memo IDs provided' };
  }
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    await validateDrawOpen(drawId);
    const db = getDb();
    const deleted = await db
      .delete(transactions)
      .where(and(eq(transactions.drawId, drawId), inArray(transactions.memoId, memoIds)))
      .returning({ id: transactions.id });
    return { success: true, deleted: deleted.length };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete memos',
    };
  }
}

export async function reindexDatabase(): Promise<
  { success: true } | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const pool = getPool();
    await pool.query('VACUUM ANALYZE');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Reindex failed',
    };
  }
}
