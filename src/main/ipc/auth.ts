import { and, eq, inArray } from 'drizzle-orm';
import type { AuthUser, LoginResult, UserInput, UserRecord } from '../../shared/types';
import { ensureConnected, getDb, hashPassword, isLegacyPasswordHash, verifyPassword } from '../db';
import {
  createSession,
  getPersistedSessionToken,
  refreshSessionAuthorization,
  revokeSession,
  validateSession,
} from '../sessionStore';
import { companies, userCompanies, users } from '../schema';

export type { AuthUser };

function toUserRecord(user: {
  id: number;
  username: string;
  fullName: string | null;
  role: UserRecord['role'];
  companyId: number | null;
  activeCompanyId: number | null;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}): UserRecord {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    companyId: user.companyId,
    activeCompanyId: user.activeCompanyId,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function login(username: string, password: string): Promise<LoginResult> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return {
      success: false,
      error:
        connection.error ??
        'Database is not connected. Press Ctrl+, to open Settings and connect.',
    };
  }

  const trimmedUsername = username.trim();
  const trimmedPassword = password;

  try {
    const db = getDb();

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, trimmedUsername))
      .limit(1);

    if (!user || !verifyPassword(trimmedPassword, user.passwordHash)) {
      return { success: false, error: 'Invalid username or password' };
    }

    if (isLegacyPasswordHash(user.passwordHash)) {
      await db
        .update(users)
        .set({ passwordHash: hashPassword(trimmedPassword), updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      activeCompanyId: null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
    const sessionToken = createSession(user.id, user.role);
    return { success: true, user: authUser, sessionToken };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Login failed',
    };
  }
}

export function logout(sessionToken: string): { success: true } | { success: false; error: string } {
  if (!sessionToken) {
    return { success: false, error: 'No active session' };
  }
  if (!revokeSession(sessionToken)) {
    return { success: false, error: 'Failed to clear the stored session' };
  }
  return { success: true };
}

export async function restoreSession(): Promise<
  | { success: true; user: AuthUser; sessionToken: string; companyName: string | null }
  | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  const token = getPersistedSessionToken();
  if (!token) {
    return { success: false, error: 'No stored session' };
  }

  const session = validateSession(token);
  if (!session) {
    return { success: false, error: 'Session expired or invalid' };
  }

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (!user) {
      revokeSession(token);
      return { success: false, error: 'User not found' };
    }

    let companyName: string | null = null;
    if (session.activeCompanyId != null) {
      let authorized = user.role === 'admin';
      if (!authorized) {
        const [membership] = await db
          .select({ id: userCompanies.id })
          .from(userCompanies)
          .where(and(
            eq(userCompanies.userId, user.id),
            eq(userCompanies.companyId, session.activeCompanyId),
          ))
          .limit(1);
        authorized = Boolean(membership);
      }
      if (authorized) {
        const [company] = await db
          .select({ name: companies.name })
          .from(companies)
          .where(eq(companies.id, session.activeCompanyId))
          .limit(1);
        companyName = company?.name ?? null;
      }
    }
    const activeCompanyId = companyName == null ? null : session.activeCompanyId;
    if (!refreshSessionAuthorization(
      token,
      user.role,
      activeCompanyId,
      session.activeCompanyId,
    )) {
      return { success: false, error: 'Failed to securely refresh the session' };
    }

    const authUser: AuthUser = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      companyId: user.companyId,
      activeCompanyId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    return { success: true, user: authUser, sessionToken: token, companyName };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to restore session',
    };
  }
}

async function syncUserCompanies(userId: number, companyIds: number[]): Promise<void> {
  const db = getDb();
  await db.delete(userCompanies).where(eq(userCompanies.userId, userId));

  if (companyIds.length === 0) {
    return;
  }

  await db.insert(userCompanies).values(
    companyIds.map((companyId) => ({
      userId,
      companyId,
    })),
  );
}

export async function createUser(
  data: UserInput,
): Promise<{ success: true; user: UserRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  if (!data.password) {
    return { success: false, error: 'Password is required' };
  }

  try {
    const db = getDb();
    const [created] = await db
      .insert(users)
      .values({
        username: data.username.trim(),
        fullName: data.fullName.trim(),
        passwordHash: hashPassword(data.password),
        role: data.role,
      })
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!created) {
      return { success: false, error: 'Failed to create user' };
    }

    if (data.companyIds?.length) {
      await syncUserCompanies(created.id, data.companyIds);
    }

    return { success: true, user: toUserRecord(created) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    if (message.includes('unique') || message.includes('duplicate')) {
      return { success: false, error: 'Username already exists' };
    }
    return { success: false, error: message };
  }
}

export async function getUsersByCompany(
  companyId: number,
): Promise<{ success: true; users: UserRecord[] } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .innerJoin(userCompanies, eq(userCompanies.userId, users.id))
      .where(eq(userCompanies.companyId, companyId))
      .orderBy(users.fullName);

    return { success: true, users: rows.map(toUserRecord) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}

export async function getAllUsers(): Promise<
  { success: true; users: UserRecord[] } | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(users.fullName);

    return { success: true, users: rows.map(toUserRecord) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}

export async function getOwners(): Promise<
  { success: true; users: UserRecord[] } | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.role, 'owner'))
      .orderBy(users.fullName);

    return { success: true, users: rows.map(toUserRecord) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load owners',
    };
  }
}

export async function getOwnerAdminUsers(): Promise<
  { success: true; users: UserRecord[] } | { success: false; error: string }
> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(inArray(users.role, ['owner', 'admin']))
      .orderBy(users.fullName);

    return { success: true, users: rows.map(toUserRecord) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load users',
    };
  }
}

export async function updateUser(
  id: number,
  data: Partial<UserInput>,
): Promise<{ success: true; user: UserRecord } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const updateData: {
      fullName?: string;
      username?: string;
      role?: UserRecord['role'];
      passwordHash?: string;
      updatedAt: Date;
    } = { updatedAt: new Date() };

    if (data.fullName !== undefined) updateData.fullName = data.fullName.trim();
    if (data.username !== undefined) updateData.username = data.username.trim();
    if (data.role !== undefined) updateData.role = data.role;
    if (data.password) updateData.passwordHash = hashPassword(data.password);

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        companyId: users.companyId,
        activeCompanyId: users.activeCompanyId,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      });

    if (!updated) {
      return { success: false, error: 'User not found' };
    }

    if (data.companyIds !== undefined) {
      await syncUserCompanies(id, data.companyIds);
    }

    return { success: true, user: toUserRecord(updated) };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update user';
    if (message.includes('unique') || message.includes('duplicate')) {
      return { success: false, error: 'Username already exists' };
    }
    return { success: false, error: message };
  }
}

export async function deleteUser(
  id: number,
  currentUserId: number,
): Promise<{ success: true } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  if (id === currentUserId) {
    return { success: false, error: 'You cannot delete your own account' };
  }

  try {
    const db = getDb();
    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (!deleted) {
      return { success: false, error: 'User not found' };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete user',
    };
  }
}

export async function getUserCompanyIds(
  userId: number,
): Promise<{ success: true; companyIds: number[] } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  try {
    const db = getDb();
    const rows = await db
      .select({ companyId: userCompanies.companyId })
      .from(userCompanies)
      .where(eq(userCompanies.userId, userId));

    return { success: true, companyIds: rows.map((row) => row.companyId) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load company assignments',
    };
  }
}

export async function changePassword(
  userId: number,
  currentPassword: string,
  newPassword: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const connection = await ensureConnected();
  if (!connection.success) {
    return { success: false, error: connection.error ?? 'Database is not connected' };
  }

  if (newPassword.length < 6) {
    return { success: false, error: 'New password must be at least 6 characters' };
  }

  try {
    const db = getDb();
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    if (!verifyPassword(currentPassword, user.passwordHash)) {
      return { success: false, error: 'Current password is incorrect' };
    }

    await db
      .update(users)
      .set({ passwordHash: hashPassword(newPassword), updatedAt: new Date() })
      .where(eq(users.id, userId));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change password',
    };
  }
}
