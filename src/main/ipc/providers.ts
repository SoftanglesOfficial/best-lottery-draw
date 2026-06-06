import { asc, eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { providerGroups, providers } from '../schema';
import type {
  ProviderGroupInput,
  ProviderGroupRecord,
  ProviderInput,
  ProviderRecord,
} from '../../shared/types';

export async function listProviderGroups(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(providerGroups)
      .where(eq(providerGroups.companyId, companyId))
      .orderBy(asc(providerGroups.name));
    return { success: true as const, groups: rows as ProviderGroupRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load provider groups' };
  }
}

export async function createProviderGroup(data: ProviderGroupInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db.insert(providerGroups).values(data).returning();
    if (!created) return { success: false as const, error: 'Failed to create provider group' };
    return { success: true as const, group: created as ProviderGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create provider group' };
  }
}

export async function updateProviderGroup(id: number, data: ProviderGroupInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db.update(providerGroups).set(data).where(eq(providerGroups.id, id)).returning();
    if (!updated) return { success: false as const, error: 'Provider group not found' };
    return { success: true as const, group: updated as ProviderGroupRecord };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update provider group' };
  }
}

export async function deleteProviderGroup(id: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db.delete(providerGroups).where(eq(providerGroups.id, id)).returning({ id: providerGroups.id });
    if (!deleted) return { success: false as const, error: 'Provider group not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete provider group' };
  }
}

export async function listProviders(companyId: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: providers.id,
        name: providers.name,
        providerGroupId: providers.providerGroupId,
        groupName: providerGroups.name,
        companyId: providers.companyId,
        purchaseRate: providers.purchaseRate,
        commission: providers.commission,
        status: providers.status,
        phone: providers.phone,
        address: providers.address,
        createdAt: providers.createdAt,
        updatedAt: providers.updatedAt,
      })
      .from(providers)
      .innerJoin(providerGroups, eq(providers.providerGroupId, providerGroups.id))
      .where(eq(providers.companyId, companyId))
      .orderBy(asc(providers.name));
    return { success: true as const, providers: rows as ProviderRecord[] };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to load providers' };
  }
}

export async function createProvider(data: ProviderInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db
      .insert(providers)
      .values({
        name: data.name,
        providerGroupId: data.providerGroupId,
        companyId: data.companyId,
        purchaseRate: data.purchaseRate != null ? String(data.purchaseRate) : null,
        commission: data.commission != null ? String(data.commission) : null,
        status: data.status ?? 'active',
        phone: data.phone ?? null,
        address: data.address ?? null,
      })
      .returning();
    if (!created) return { success: false as const, error: 'Failed to create provider' };
    const list = await listProviders(data.companyId);
    const provider = list.success ? list.providers.find((p) => p.id === created.id) : null;
    return { success: true as const, provider: provider ?? ({ ...created, groupName: null } as ProviderRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to create provider' };
  }
}

export async function updateProvider(id: number, data: ProviderInput) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(providers)
      .set({
        name: data.name,
        providerGroupId: data.providerGroupId,
        purchaseRate: data.purchaseRate != null ? String(data.purchaseRate) : null,
        commission: data.commission != null ? String(data.commission) : null,
        status: data.status ?? 'active',
        phone: data.phone ?? null,
        address: data.address ?? null,
        updatedAt: new Date(),
      })
      .where(eq(providers.id, id))
      .returning();
    if (!updated) return { success: false as const, error: 'Provider not found' };
    const list = await listProviders(updated.companyId);
    const provider = list.success ? list.providers.find((p) => p.id === id) : null;
    return { success: true as const, provider: provider ?? ({ ...updated, groupName: null } as ProviderRecord) };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to update provider' };
  }
}

export async function deleteProvider(id: number) {
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db.delete(providers).where(eq(providers.id, id)).returning({ id: providers.id });
    if (!deleted) return { success: false as const, error: 'Provider not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : 'Failed to delete provider' };
  }
}
