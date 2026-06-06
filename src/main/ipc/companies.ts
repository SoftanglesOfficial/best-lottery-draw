import { asc, eq } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { ensureConnected, getDb } from '../db';
import { companies, users } from '../schema';
import type { CompanyInput, CompanyRecord, CompanyStatus } from '../../shared/types';

const owners = alias(users, 'owners');

function mapCompany(row: {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  status: CompanyStatus | null;
  billingLocked: boolean | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}): CompanyRecord {
  return row;
}

export async function getAllCompanies(): Promise<
  { success: true; companies: CompanyRecord[] } | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: companies.id,
        name: companies.name,
        ownerId: companies.ownerId,
        ownerName: owners.fullName,
        status: companies.status,
        billingLocked: companies.billingLocked,
        address: companies.address,
        phone: companies.phone,
        email: companies.email,
        createdAt: companies.createdAt,
        updatedAt: companies.updatedAt,
      })
      .from(companies)
      .leftJoin(owners, eq(companies.ownerId, owners.id))
      .orderBy(asc(companies.name));

    return { success: true, companies: rows.map(mapCompany) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load companies',
    };
  }
}

export async function createCompany(
  data: CompanyInput,
): Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [created] = await db
      .insert(companies)
      .values({
        name: data.name,
        ownerId: data.ownerId ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
      })
      .returning();

    if (!created) {
      return { success: false, error: 'Failed to create company' };
    }

    let ownerName: string | null = null;
    if (created.ownerId) {
      const [owner] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, created.ownerId))
        .limit(1);
      ownerName = owner?.fullName ?? null;
    }

    return {
      success: true,
      company: mapCompany({ ...created, ownerName }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create company',
    };
  }
}

export async function updateCompany(
  id: number,
  data: CompanyInput,
): Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [updated] = await db
      .update(companies)
      .set({
        name: data.name,
        ownerId: data.ownerId ?? null,
        address: data.address ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        updatedAt: new Date(),
      })
      .where(eq(companies.id, id))
      .returning();

    if (!updated) {
      return { success: false, error: 'Company not found' };
    }

    let ownerName: string | null = null;
    if (updated.ownerId) {
      const [owner] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, updated.ownerId))
        .limit(1);
      ownerName = owner?.fullName ?? null;
    }

    return {
      success: true,
      company: mapCompany({ ...updated, ownerName }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update company',
    };
  }
}

export async function cloneCompany(
  id: number,
): Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [source] = await db.select().from(companies).where(eq(companies.id, id)).limit(1);
    if (!source) {
      return { success: false, error: 'Company not found' };
    }

    const [created] = await db
      .insert(companies)
      .values({
        name: `${source.name} (Copy)`,
        ownerId: source.ownerId,
        status: source.status,
        billingLocked: source.billingLocked,
        address: source.address,
        phone: source.phone,
        email: source.email,
      })
      .returning();

    if (!created) {
      return { success: false, error: 'Failed to clone company' };
    }

    let ownerName: string | null = null;
    if (created.ownerId) {
      const [owner] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, created.ownerId))
        .limit(1);
      ownerName = owner?.fullName ?? null;
    }

    return {
      success: true,
      company: mapCompany({ ...created, ownerName }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to clone company',
    };
  }
}

export async function setCompanyStatus(
  id: number,
  status: CompanyStatus,
): Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [updated] = await db
      .update(companies)
      .set({ status, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    if (!updated) {
      return { success: false, error: 'Company not found' };
    }

    let ownerName: string | null = null;
    if (updated.ownerId) {
      const [owner] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, updated.ownerId))
        .limit(1);
      ownerName = owner?.fullName ?? null;
    }

    return {
      success: true,
      company: mapCompany({ ...updated, ownerName }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update status',
    };
  }
}

export async function setCompanyBillingLock(
  id: number,
  locked: boolean,
): Promise<{ success: true; company: CompanyRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [updated] = await db
      .update(companies)
      .set({ billingLocked: locked, updatedAt: new Date() })
      .where(eq(companies.id, id))
      .returning();

    if (!updated) {
      return { success: false, error: 'Company not found' };
    }

    let ownerName: string | null = null;
    if (updated.ownerId) {
      const [owner] = await db
        .select({ fullName: users.fullName })
        .from(users)
        .where(eq(users.id, updated.ownerId))
        .limit(1);
      ownerName = owner?.fullName ?? null;
    }

    return {
      success: true,
      company: mapCompany({ ...updated, ownerName }),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update billing lock',
    };
  }
}
