import { and, asc, eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { buyers, draws, items, saleQuotas } from '../schema';
import { requireCompanyId } from './companyScope';
import type { SaleQuotaInput, SaleQuotaRecord } from '../../shared/types';

async function assertQuotaDrawItemMatch(
  companyId: number,
  drawId: number,
  itemId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const db = getDb();
  const [draw] = await db
    .select({ itemId: draws.itemId })
    .from(draws)
    .where(and(eq(draws.id, drawId), eq(draws.companyId, companyId)))
    .limit(1);
  if (!draw) {
    return { success: false, error: 'Draw not found.' };
  }
  if (draw.itemId != null && itemId !== draw.itemId) {
    return { success: false, error: 'Selected item does not match the draw item.' };
  }
  return { success: true };
}

export async function listSaleQuotas(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: saleQuotas.id,
        companyId: saleQuotas.companyId,
        buyerId: saleQuotas.buyerId,
        buyerName: buyers.name,
        drawId: saleQuotas.drawId,
        drawName: draws.name,
        itemId: saleQuotas.itemId,
        itemName: items.name,
        maxQty: saleQuotas.maxQty,
        createdAt: saleQuotas.createdAt,
        updatedAt: saleQuotas.updatedAt,
      })
      .from(saleQuotas)
      .innerJoin(buyers, eq(saleQuotas.buyerId, buyers.id))
      .innerJoin(draws, eq(saleQuotas.drawId, draws.id))
      .innerJoin(items, eq(saleQuotas.itemId, items.id))
      .where(eq(saleQuotas.companyId, companyId))
      .orderBy(asc(buyers.name), asc(draws.name), asc(items.name));
    return { success: true as const, quotas: rows as SaleQuotaRecord[] };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to load sale quotas',
    };
  }
}

export async function createSaleQuota(data: SaleQuotaInput) {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (data.maxQty < 0) {
    return { success: false as const, error: 'Max quantity cannot be negative.' };
  }
  try {
    const db = getDb();
    const match = await assertQuotaDrawItemMatch(data.companyId, data.drawId, data.itemId);
    if (!match.success) return match;
    const [created] = await db
      .insert(saleQuotas)
      .values({
        companyId: data.companyId,
        buyerId: data.buyerId,
        drawId: data.drawId,
        itemId: data.itemId,
        maxQty: data.maxQty,
      })
      .returning();
    if (!created) return { success: false as const, error: 'Failed to create sale quota' };
    const list = await listSaleQuotas(data.companyId);
    const quota = list.success ? list.quotas.find((q) => q.id === created.id) : null;
    return {
      success: true as const,
      quota: quota ?? ({ ...created, buyerName: null, drawName: null, itemName: null } as SaleQuotaRecord),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create sale quota';
    if (message.includes('sale_quotas_company_id_buyer_id_draw_id_item_id_key')) {
      return { success: false as const, error: 'Quota already exists for this buyer, draw, and item.' };
    }
    return { success: false as const, error: message };
  }
}

export async function updateSaleQuota(id: number, data: SaleQuotaInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  if (data.maxQty < 0) {
    return { success: false as const, error: 'Max quantity cannot be negative.' };
  }
  try {
    const db = getDb();
    const match = await assertQuotaDrawItemMatch(scoped.companyId, data.drawId, data.itemId);
    if (!match.success) return match;
    const [updated] = await db
      .update(saleQuotas)
      .set({
        buyerId: data.buyerId,
        drawId: data.drawId,
        itemId: data.itemId,
        maxQty: data.maxQty,
        updatedAt: new Date(),
      })
      .where(and(eq(saleQuotas.id, id), eq(saleQuotas.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Sale quota not found' };
    const list = await listSaleQuotas(scoped.companyId);
    const quota = list.success ? list.quotas.find((q) => q.id === updated.id) : null;
    return {
      success: true as const,
      quota: quota ?? ({ ...updated, buyerName: null, drawName: null, itemName: null } as SaleQuotaRecord),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update sale quota';
    if (message.includes('sale_quotas_company_id_buyer_id_draw_id_item_id_key')) {
      return { success: false as const, error: 'Quota already exists for this buyer, draw, and item.' };
    }
    return { success: false as const, error: message };
  }
}

export async function deleteSaleQuota(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false as const, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(saleQuotas)
      .where(and(eq(saleQuotas.id, id), eq(saleQuotas.companyId, scoped.companyId)))
      .returning({ id: saleQuotas.id });
    if (!deleted) return { success: false as const, error: 'Sale quota not found' };
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Failed to delete sale quota',
    };
  }
}
