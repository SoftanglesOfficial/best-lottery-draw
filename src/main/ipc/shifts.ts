import { and, asc, eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { shiftGroups, shifts } from '../schema';
import { requireCompanyId } from './companyScope';
import { formatDbError } from './ipcUtils';
import type { ActiveShift, ShiftGroupInput, ShiftGroupRecord, ShiftInput, ShiftRecord } from '../../shared/types';

export async function listShiftGroups(companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select()
      .from(shiftGroups)
      .where(eq(shiftGroups.companyId, scoped.companyId))
      .orderBy(asc(shiftGroups.name));
    return { success: true as const, groups: rows as ShiftGroupRecord[] };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function createShiftGroup(data: ShiftGroupInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  if (!data.name?.trim()) {
    return { success: false as const, error: 'Shift group name is required' };
  }
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [created] = await db
      .insert(shiftGroups)
      .values({ name: data.name.trim(), companyId: scoped.companyId })
      .returning();
    if (!created) return { success: false as const, error: 'Failed to create shift group' };
    return { success: true as const, group: created as ShiftGroupRecord };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function updateShiftGroup(id: number, data: ShiftGroupInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  if (!data.name?.trim()) {
    return { success: false as const, error: 'Shift group name is required' };
  }
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [updated] = await db
      .update(shiftGroups)
      .set({ name: data.name.trim(), companyId: scoped.companyId })
      .where(and(eq(shiftGroups.id, id), eq(shiftGroups.companyId, scoped.companyId)))
      .returning();
    if (!updated) return { success: false as const, error: 'Shift group not found' };
    return { success: true as const, group: updated as ShiftGroupRecord };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function deleteShiftGroup(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [deleted] = await db
      .delete(shiftGroups)
      .where(and(eq(shiftGroups.id, id), eq(shiftGroups.companyId, scoped.companyId)))
      .returning({ id: shiftGroups.id });
    if (!deleted) return { success: false as const, error: 'Shift group not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function listShifts(shiftGroupId: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const rows = await db
      .select({
        id: shifts.id,
        name: shifts.name,
        shiftGroupId: shifts.shiftGroupId,
      })
      .from(shifts)
      .innerJoin(shiftGroups, eq(shifts.shiftGroupId, shiftGroups.id))
      .where(and(
        eq(shifts.shiftGroupId, shiftGroupId),
        eq(shiftGroups.companyId, scoped.companyId),
      ))
      .orderBy(asc(shifts.name));
    return { success: true as const, shifts: rows as ShiftRecord[] };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function createShift(data: ShiftInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  if (!data.name?.trim()) {
    return { success: false as const, error: 'Shift name is required' };
  }
  if (!data.shiftGroupId) {
    return { success: false as const, error: 'Shift group is required' };
  }
  try {
    const db = getDb();
    const [group] = await db
      .select({ id: shiftGroups.id })
      .from(shiftGroups)
      .where(and(
        eq(shiftGroups.id, data.shiftGroupId),
        eq(shiftGroups.companyId, scoped.companyId),
      ))
      .limit(1);
    if (!group) {
      return { success: false as const, error: 'Shift group not found' };
    }

    const [created] = await db
      .insert(shifts)
      .values({ name: data.name.trim(), shiftGroupId: data.shiftGroupId })
      .returning();
    if (!created) return { success: false as const, error: 'Failed to create shift' };
    return { success: true as const, shift: created as ShiftRecord };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function updateShift(id: number, data: ShiftInput, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  if (!data.name?.trim()) {
    return { success: false as const, error: 'Shift name is required' };
  }
  if (!data.shiftGroupId) {
    return { success: false as const, error: 'Shift group is required' };
  }
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .innerJoin(shiftGroups, eq(shifts.shiftGroupId, shiftGroups.id))
      .where(and(eq(shifts.id, id), eq(shiftGroups.companyId, scoped.companyId)))
      .limit(1);
    if (!existing) return { success: false as const, error: 'Shift not found' };

    const [targetGroup] = await db
      .select({ id: shiftGroups.id })
      .from(shiftGroups)
      .where(and(
        eq(shiftGroups.id, data.shiftGroupId),
        eq(shiftGroups.companyId, scoped.companyId),
      ))
      .limit(1);
    if (!targetGroup) return { success: false as const, error: 'Shift group not found' };

    const [updated] = await db
      .update(shifts)
      .set({ name: data.name.trim(), shiftGroupId: data.shiftGroupId })
      .where(eq(shifts.id, id))
      .returning();
    if (!updated) return { success: false as const, error: 'Shift not found' };
    return { success: true as const, shift: updated as ShiftRecord };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function deleteShift(id: number, companyId: number | null) {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) return { success: false as const, error: connection.error ?? 'Database is not connected' };
  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: shifts.id })
      .from(shifts)
      .innerJoin(shiftGroups, eq(shifts.shiftGroupId, shiftGroups.id))
      .where(and(eq(shifts.id, id), eq(shiftGroups.companyId, scoped.companyId)))
      .limit(1);
    if (!existing) return { success: false as const, error: 'Shift not found' };

    const [deleted] = await db.delete(shifts).where(eq(shifts.id, id)).returning({ id: shifts.id });
    if (!deleted) return { success: false as const, error: 'Shift not found' };
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: formatDbError(error) };
  }
}

export async function getShiftForCompany(
  id: number,
  companyId: number | null,
): Promise<
  { success: true; shift: ActiveShift | null } | { success: false; error: string }
> {
  const scoped = requireCompanyId(companyId);
  if (!scoped.success) return scoped;
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }
  try {
    const db = getDb();
    const [shift] = await db
      .select({
        id: shifts.id,
        name: shifts.name,
        shiftGroupId: shifts.shiftGroupId,
        shiftGroupName: shiftGroups.name,
      })
      .from(shifts)
      .innerJoin(shiftGroups, eq(shifts.shiftGroupId, shiftGroups.id))
      .where(and(eq(shifts.id, id), eq(shiftGroups.companyId, scoped.companyId)))
      .limit(1);
    return { success: true, shift: (shift as ActiveShift | undefined) ?? null };
  } catch (error) {
    return { success: false, error: formatDbError(error) };
  }
}
