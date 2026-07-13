import { randomUUID } from 'crypto';
import type { UserRole } from '../shared/types';

export type StoredSession = {
  userId: number;
  role: UserRole;
  activeCompanyId: number | null;
  expiresAt: number;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, StoredSession>();

export function createSession(
  userId: number,
  role: UserRole,
  activeCompanyId: number | null,
): string {
  const token = randomUUID();
  sessions.set(token, {
    userId,
    role,
    activeCompanyId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function validateSession(token: string): StoredSession | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function touchSession(token: string): void {
  const session = sessions.get(token);
  if (session) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
  }
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

export function updateSessionCompany(token: string, activeCompanyId: number | null): void {
  const session = sessions.get(token);
  if (session) {
    session.activeCompanyId = activeCompanyId;
  }
}
