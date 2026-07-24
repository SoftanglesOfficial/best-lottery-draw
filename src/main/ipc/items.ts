import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import {
  itemGroups,
  itemSchemePrizes,
  itemSchemes,
  items,
} from '../schema';
import { assertCompanyAccess, type SessionContext } from './sessionContext';
import type {
  ItemGroupInput,
  ItemGroupRecord,
  ItemInput,
  ItemRecord,
  ItemSchemeInput,
  ItemSchemePrizeInput,
  ItemSchemeRecord,
  ItemSchemeWithPrizes,
} from '../../shared/types';
import { requireCompanyId } from './companyScope';

function mapPrizeValues(prize: ItemSchemePrizeInput) {
  return {
    prizeRank: prize.prizeRank,
    checkPrefix: prize.checkPrefix ?? null,
    checkSeries: prize.checkSeries ?? null,
    prizeNoLength: prize.prizeNoLength ?? null,
    noOfResult: prize.noOfResult ?? null,
    prizeAmount: prize.prizeAmount != null ? String(prize.prizeAmount) : null,
    bonusReceivable: prize.bonusReceivable != null ? String(prize.bonusReceivable) : null,
    bonusPayable: prize.bonusPayable != null ? String(prize.bonusPayable) : null,
    incentiveReceivable: prize.incentiveReceivable != null ? String(prize.incentiveReceivable) : null,
    incentivePayable: prize.incentivePayable != null ? String(prize.incentivePayable) : null,
  };
}

export async function listItemGroups(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(itemGroups)
      .where(eq(itemGroups.companyId, companyId))
      .orderBy(asc(itemGroups.name));
    return { success: true as const, groups: rows as ItemGroupRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load item groups' };
  }
}

export async function createItemGroup(data: ItemGroupInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db.insert(itemGroups).values(data).returning();
    if (!created) return { success: false as const, error: 'Failed to create item group' };
    return { success: true as const, group: created as ItemGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create item group' };
  }
}

export async function updateItemGroup(id: number, data: ItemGroupInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(itemGroups)
      .set({ name: data.name })
      .where(and(eq(itemGroups.id, id), eq(itemGroups.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Item group not found' };
    return { success: true as const, group: updated as ItemGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update item group' };
  }
}

export async function deleteItemGroup(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(itemGroups)
      .where(and(eq(itemGroups.id, id), eq(itemGroups.companyId, scoped.companyId)))
      .returning({ id: itemGroups.id });
    if (!deleted) return { success: false as const, error: 'Item group not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete item group' };
  }
}

export async function listItems(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: items.id,
        code: items.code,
        name: items.name,
        rate: items.rate,
        itemGroupId: items.itemGroupId,
        groupName: itemGroups.name,
        companyId: items.companyId,
        noOfSeries: items.noOfSeries,
        drawTime: items.drawTime,
        shiftGroupId: items.shiftGroupId,
        type: items.type,
        mrp: items.mrp,
        length: items.length,
        ratePer100: items.ratePer100,
        defaultSeries: items.defaultSeries,
        prefix: items.prefix,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .innerJoin(itemGroups, eq(items.itemGroupId, itemGroups.id))
      .where(eq(items.companyId, companyId))
      .orderBy(asc(items.name));
    return { success: true as const, items: rows as ItemRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load items' };
  }
}

function itemValues(data: ItemInput) {
  return {
    code: data.code ?? null,
    name: data.name,
    rate: data.rate != null ? String(data.rate) : null,
    itemGroupId: data.itemGroupId,
    companyId: data.companyId,
    noOfSeries: data.noOfSeries ?? null,
    drawTime: data.drawTime ?? null,
    shiftGroupId: data.shiftGroupId ?? null,
    type: data.type ?? null,
    mrp: data.mrp != null ? String(data.mrp) : null,
    length: data.length ?? null,
    ratePer100: data.ratePer100 != null ? String(data.ratePer100) : null,
    defaultSeries: data.defaultSeries ?? null,
    prefix: data.prefix ?? null,
  };
}

export async function createItem(data: ItemInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db.insert(items).values(itemValues(data)).returning();
    if (!created) return { success: false as const, error: 'Failed to create item' };
    const list = await listItems(data.companyId);
    const item = list.success ? list.items.find((i) => i.id === created.id) : null;
    return { success: true as const, item: item ?? ({ ...created, groupName: null } as ItemRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create item' };
  }
}

export async function updateItem(id: number, data: ItemInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(items)
      .set({ ...itemValues(data), updatedAt: new Date() })
      .where(and(eq(items.id, id), eq(items.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Item not found' };
    const list = await listItems(updated.companyId);
    const item = list.success ? list.items.find((i) => i.id === id) : null;
    return { success: true as const, item: item ?? ({ ...updated, groupName: null } as ItemRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update item' };
  }
}

export async function deleteItem(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(items)
      .where(and(eq(items.id, id), eq(items.companyId, scoped.companyId)))
      .returning({ id: items.id });
    if (!deleted) return { success: false as const, error: 'Item not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete item' };
  }
}

export async function listItemSchemes(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: itemSchemes.id,
        itemId: itemSchemes.itemId,
        itemName: items.name,
        schemeDate: itemSchemes.schemeDate,
        drawNo: itemSchemes.drawNo,
        companyId: itemSchemes.companyId,
        createdAt: itemSchemes.createdAt,
        updatedAt: itemSchemes.updatedAt,
        prizeCount: sql<number>`count(${itemSchemePrizes.id})`.mapWith(Number),
      })
      .from(itemSchemes)
      .innerJoin(items, eq(itemSchemes.itemId, items.id))
      .leftJoin(itemSchemePrizes, eq(itemSchemePrizes.itemSchemeId, itemSchemes.id))
      .where(eq(itemSchemes.companyId, companyId))
      .groupBy(itemSchemes.id, items.name)
      .orderBy(desc(itemSchemes.schemeDate));
    return { success: true as const, schemes: rows as ItemSchemeRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load item schemes' };
  }
}

export async function listItemSchemesByItem(ctx: SessionContext, itemId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [item] = await db
      .select({ companyId: items.companyId })
      .from(items)
      .where(eq(items.id, itemId))
      .limit(1);
    if (!item) return { success: false as const, error: 'Item not found' };
    const denied = assertCompanyAccess(ctx, item.companyId);
    if (denied) return { success: false as const, error: 'Item not found' };

    const rows = await db
      .select({
        id: itemSchemes.id,
        itemId: itemSchemes.itemId,
        itemName: items.name,
        schemeDate: itemSchemes.schemeDate,
        drawNo: itemSchemes.drawNo,
        companyId: itemSchemes.companyId,
        createdAt: itemSchemes.createdAt,
        updatedAt: itemSchemes.updatedAt,
        prizeCount: sql<number>`count(${itemSchemePrizes.id})`.mapWith(Number),
      })
      .from(itemSchemes)
      .innerJoin(items, eq(itemSchemes.itemId, items.id))
      .leftJoin(itemSchemePrizes, eq(itemSchemePrizes.itemSchemeId, itemSchemes.id))
      .where(eq(itemSchemes.itemId, itemId))
      .groupBy(itemSchemes.id, items.name)
      .orderBy(desc(itemSchemes.schemeDate));
    return { success: true as const, schemes: rows as ItemSchemeRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load item schemes' };
  }
}

export async function getItemSchemePrizes(ctx: SessionContext, itemSchemeId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [row] = await db
      .select({ companyId: itemSchemes.companyId })
      .from(itemSchemes)
      .where(eq(itemSchemes.id, itemSchemeId))
      .limit(1);
    if (!row) return { success: false as const, error: 'Scheme not found' };
    const denied = assertCompanyAccess(ctx, row.companyId);
    if (denied) return { success: false as const, error: 'Scheme not found' };

    const rows = await db
      .select()
      .from(itemSchemePrizes)
      .where(eq(itemSchemePrizes.itemSchemeId, itemSchemeId))
      .orderBy(asc(itemSchemePrizes.prizeRank));
    return { success: true as const, prizes: rows };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load prizes' };
  }
}

async function loadItemSchemeWithPrizes(id: number) {
  const db = getDb();
  const [scheme] = await db
    .select({
      id: itemSchemes.id,
      itemId: itemSchemes.itemId,
      itemName: items.name,
      schemeDate: itemSchemes.schemeDate,
      drawNo: itemSchemes.drawNo,
      companyId: itemSchemes.companyId,
      createdAt: itemSchemes.createdAt,
      updatedAt: itemSchemes.updatedAt,
    })
    .from(itemSchemes)
    .innerJoin(items, eq(itemSchemes.itemId, items.id))
    .where(eq(itemSchemes.id, id))
    .limit(1);
  if (!scheme) return { success: false as const, error: 'Scheme not found' };
  // Internal load after company assert — prizes queried without re-check.
  const prizes = await db
    .select()
    .from(itemSchemePrizes)
    .where(eq(itemSchemePrizes.itemSchemeId, id))
    .orderBy(asc(itemSchemePrizes.prizeRank));
  return {
    success: true as const,
    scheme: { ...scheme, prizeCount: prizes.length, prizes } as ItemSchemeWithPrizes,
  };
}

export async function getItemScheme(ctx: SessionContext, id: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [row] = await db
      .select({ itemCompanyId: items.companyId })
      .from(itemSchemes)
      .innerJoin(items, eq(itemSchemes.itemId, items.id))
      .where(eq(itemSchemes.id, id))
      .limit(1);
    if (!row) return { success: false as const, error: 'Scheme not found' };
    const denied = assertCompanyAccess(ctx, row.itemCompanyId);
    if (denied) return { success: false as const, error: 'Scheme not found' };
    return loadItemSchemeWithPrizes(id);
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load scheme' };
  }
}

export async function createItemScheme(ctx: SessionContext, data: ItemSchemeInput) {
  const denied = assertCompanyAccess(ctx, data.companyId);
  if (denied) return denied;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [item] = await db
      .select({ companyId: items.companyId })
      .from(items)
      .where(eq(items.id, data.itemId))
      .limit(1);
    if (!item || item.companyId !== data.companyId) {
      return { success: false as const, error: 'Item not found' };
    }
    const result = await db.transaction(async (tx) => {
      const [scheme] = await tx
        .insert(itemSchemes)
        .values({
          itemId: data.itemId,
          schemeDate: new Date(data.schemeDate),
          drawNo: data.drawNo ?? null,
          companyId: data.companyId,
        })
        .returning();
      if (!scheme) throw new Error('Failed to create scheme');
      if (data.prizes?.length) {
        await tx.insert(itemSchemePrizes).values(
          data.prizes.map((prize) => ({
            itemSchemeId: scheme.id,
            ...mapPrizeValues(prize),
          })),
        );
      }
      return scheme;
    });
    const full = await loadItemSchemeWithPrizes(result.id);
    if (!full.success) return full;
    return { success: true as const, scheme: full.scheme };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create scheme' };
  }
}

export async function updateItemScheme(id: number, data: ItemSchemeInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(itemSchemes)
        .set({
          itemId: data.itemId,
          schemeDate: new Date(data.schemeDate),
          drawNo: data.drawNo ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(itemSchemes.id, id), eq(itemSchemes.companyId, scoped.companyId)))
        .returning();
      if (!updated) throw new Error('Scheme not found');
      await tx.delete(itemSchemePrizes).where(eq(itemSchemePrizes.itemSchemeId, id));
      if (data.prizes?.length) {
        await tx.insert(itemSchemePrizes).values(
          data.prizes.map((prize) => ({
            itemSchemeId: id,
            ...mapPrizeValues(prize),
          })),
        );
      }
    });
    const full = await loadItemSchemeWithPrizes(id);
    if (!full.success) return full;
    return { success: true as const, scheme: full.scheme };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update scheme' };
  }
}

export async function deleteItemScheme(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(itemSchemes)
      .where(and(eq(itemSchemes.id, id), eq(itemSchemes.companyId, scoped.companyId)))
      .returning({ id: itemSchemes.id });
    if (!deleted) return { success: false as const, error: 'Scheme not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete scheme' };
  }
}
