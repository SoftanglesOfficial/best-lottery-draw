import { and, eq } from 'drizzle-orm';
import { ensureConnected, getDb } from '../db';
import { companies, userCompanies, users } from '../schema';
import type { CompanySummary, SessionUser } from '../../shared/types';
export async function getUserCompanies(
  userId: number,
): Promise<{ success: true; companies: CompanySummary[] } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();

    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return { success: false, error: 'User not found' };
    }

    let rows: CompanySummary[];

    if (user.role === 'admin') {
      rows = await db
        .select({
          id: companies.id,
          name: companies.name,
          status: companies.status,
        })
        .from(companies);

      if (rows.length === 0) {
        const [created] = await db
          .insert(companies)
          .values({ name: 'Default Company', status: 'active' })
          .returning({
            id: companies.id,
            name: companies.name,
            status: companies.status,
          });
        if (created) {
          rows = [created];
        }
      }
    } else {
      rows = await db
        .select({
          id: companies.id,
          name: companies.name,
          status: companies.status,
        })
        .from(userCompanies)
        .innerJoin(companies, eq(userCompanies.companyId, companies.id))
        .where(eq(userCompanies.userId, userId));
    }

    return { success: true, companies: rows };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load companies',
    };
  }
}

export async function setActiveCompany(
  userId: number,
  companyId: number,
): Promise<{ success: true; user: SessionUser; companyName: string } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();

    const [company] = await db
      .select({ id: companies.id, name: companies.name })
      .from(companies)
      .where(eq(companies.id, companyId))
      .limit(1);

    if (!company) {
      return { success: false, error: 'Company not found' };
    }

    const [updated] = await db
      .update(users)
      .set({ activeCompanyId: companyId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
      });

    if (!updated) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      user: updated,
      companyName: company.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set active company',
    };
  }
}

export async function assignUserCompany(
  userId: number,
  companyId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const [existing] = await db
      .select({ id: userCompanies.id })
      .from(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)))
      .limit(1);

    if (existing) {
      return { success: true };
    }

    await db.insert(userCompanies).values({ userId, companyId });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to assign company',
    };
  }
}

export async function removeUserCompany(
  userId: number,
  companyId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    await db
      .delete(userCompanies)
      .where(and(eq(userCompanies.userId, userId), eq(userCompanies.companyId, companyId)));
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove company',
    };
  }
}

export async function listUserCompanies(
  userId: number,
): Promise<{ success: true; companies: CompanySummary[] } | { success: false; error: string }> {
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
        status: companies.status,
      })
      .from(userCompanies)
      .innerJoin(companies, eq(userCompanies.companyId, companies.id))
      .where(eq(userCompanies.userId, userId))
      .orderBy(companies.name);

    return { success: true, companies: rows };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load companies',
    };
  }
}
