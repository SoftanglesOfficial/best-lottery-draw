import { and, asc, eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { buyerGroups, buyers } from '../schema';
import { requireCompanyId } from './companyScope';
import type { BuyerGroupInput, BuyerGroupRecord, BuyerInput, BuyerRecord } from '../../shared/types';

export async function listBuyerGroups(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(buyerGroups)
      .where(eq(buyerGroups.companyId, companyId))
      .orderBy(asc(buyerGroups.name));
    return { success: true as const, groups: rows as BuyerGroupRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load buyer groups' };
  }
}

export async function createBuyerGroup(data: BuyerGroupInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db.insert(buyerGroups).values(data).returning();
    if (!created) return { success: false as const, error: 'Failed to create buyer group' };
    return { success: true as const, group: created as BuyerGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create buyer group' };
  }
}

export async function updateBuyerGroup(id: number, data: BuyerGroupInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(buyerGroups)
      .set({ name: data.name })
      .where(and(eq(buyerGroups.id, id), eq(buyerGroups.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Buyer group not found' };
    return { success: true as const, group: updated as BuyerGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update buyer group' };
  }
}

export async function deleteBuyerGroup(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(buyerGroups)
      .where(and(eq(buyerGroups.id, id), eq(buyerGroups.companyId, scoped.companyId)))
      .returning({ id: buyerGroups.id });
    if (!deleted) return { success: false as const, error: 'Buyer group not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete buyer group' };
  }
}

export async function listBuyers(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: buyers.id,
        name: buyers.name,
        type: buyers.type,
        buyerGroupId: buyers.buyerGroupId,
        groupName: buyerGroups.name,
        companyId: buyers.companyId,
        saleRate: buyers.saleRate,
        commission: buyers.commission,
        status: buyers.status,
        phone: buyers.phone,
        address: buyers.address,
        createdAt: buyers.createdAt,
        updatedAt: buyers.updatedAt,
      })
      .from(buyers)
      .innerJoin(buyerGroups, eq(buyers.buyerGroupId, buyerGroups.id))
      .where(eq(buyers.companyId, companyId))
      .orderBy(asc(buyers.name));
    return { success: true as const, buyers: rows as BuyerRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load buyers' };
  }
}

export async function createBuyer(data: BuyerInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: buyers.id })
      .from(buyers)
      .where(and(eq(buyers.companyId, data.companyId), eq(buyers.name, data.name.trim())))
      .limit(1);
    if (existing) {
      return { success: false as const, error: 'Duplicate buyer name in this company.' };
    }

    const [created] = await db
      .insert(buyers)
      .values({
        name: data.name.trim(),
        type: data.type ?? 'stockist',
        buyerGroupId: data.buyerGroupId,
        companyId: data.companyId,
        saleRate: data.saleRate != null ? String(data.saleRate) : null,
        commission: data.commission != null ? String(data.commission) : null,
        status: data.status ?? 'active',
        phone: data.phone ?? null,
        address: data.address ?? null,
      })
      .returning();
    if (!created) return { success: false as const, error: 'Failed to create buyer' };
    const list = await listBuyers(data.companyId);
    const buyer = list.success ? list.buyers.find((b) => b.id === created.id) : null;
    return { success: true as const, buyer: buyer ?? ({ ...created, groupName: null } as BuyerRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create buyer' };
  }
}

export async function updateBuyer(id: number, data: BuyerInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(buyers)
      .set({
        name: data.name.trim(),
        type: data.type ?? 'stockist',
        buyerGroupId: data.buyerGroupId,
        saleRate: data.saleRate != null ? String(data.saleRate) : null,
        commission: data.commission != null ? String(data.commission) : null,
        status: data.status ?? 'active',
        phone: data.phone ?? null,
        address: data.address ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(buyers.id, id), eq(buyers.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Buyer not found' };
    const list = await listBuyers(updated.companyId);
    const buyer = list.success ? list.buyers.find((b) => b.id === id) : null;
    return { success: true as const, buyer: buyer ?? ({ ...updated, groupName: null } as BuyerRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update buyer' };
  }
}

export async function deleteBuyer(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(buyers)
      .where(and(eq(buyers.id, id), eq(buyers.companyId, scoped.companyId)))
      .returning({ id: buyers.id });
    if (!deleted) return { success: false as const, error: 'Buyer not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete buyer' };
  }
}
