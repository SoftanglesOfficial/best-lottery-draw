import type { DbConfig, UserRole } from '../../shared/types';
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

export function canAccessCompany(ctx: SessionContext, companyId: number): boolean {
  return ctx.role === 'admin' || ctx.activeCompanyId === companyId;
}

export function assertCompanyAccess(
  ctx: SessionContext,
  companyId: number,
): { success: false; error: string } | null {
  if (!canAccessCompany(ctx, companyId)) {
    return { success: false, error: 'Access denied for this company.' };
  }
  return null;
}

export function redactDbConfig(config: DbConfig): DbConfig {
  return { ...config, password: config.password ? '********' : '' };
}

export function popSessionToken(args: unknown[]): { token: string | undefined; rest: unknown[] } {
  if (args.length === 0) return { token: undefined, rest: [] };
  const last = args[args.length - 1];
  if (typeof last !== 'string') return { token: undefined, rest: args };
  return { token: last, rest: args.slice(0, -1) };
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

export async function withSession<T>(
  args: unknown[],
  handler: (ctx: SessionContext, ...rest: unknown[]) => Promise<T>,
  minRole?: UserRole,
): Promise<T | { success: false; error: string }> {
  const { token, rest } = popSessionToken(args);
  const session = requireSession(token);
  if (!session.success) return session;
  if (minRole) {
    const roleCheck = requireRole(session.ctx, minRole);
    if (!roleCheck.success) return roleCheck;
  }
  return handler(session.ctx, ...rest);
}
