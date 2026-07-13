import type { UserRole } from '../../shared/types';
import { touchSession, validateSession } from '../sessionStore';

export type SessionContext = {
  userId: number;
  role: UserRole;
  activeCompanyId: number | null;
};

const ROLE_RANK: Record<UserRole, number> = {
  data_entry: 0,
  supervisor: 1,
  manager: 2,
  owner: 3,
  admin: 4,
};

export function isAtLeastRole(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export function requireSession(
  token: string | null | undefined,
): { success: true; ctx: SessionContext } | { success: false; error: string } {
  if (!token) {
    return { success: false, error: 'Not authenticated. Please log in again.' };
  }
  const session = validateSession(token);
  if (!session) {
    return { success: false, error: 'Session expired or invalid. Please log in again.' };
  }
  touchSession(token);
  return {
    success: true,
    ctx: {
      userId: session.userId,
      role: session.role,
      activeCompanyId: session.activeCompanyId,
    },
  };
}

export function requireRole(
  ctx: SessionContext,
  minimum: UserRole,
): { success: true } | { success: false; error: string } {
  if (!isAtLeastRole(ctx.role, minimum)) {
    return { success: false, error: 'You do not have permission for this action.' };
  }
  return { success: true };
}
