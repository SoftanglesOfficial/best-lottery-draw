import { randomUUID } from 'crypto';
import type { UserRole } from '../shared/types';
import { getConfigValue, setConfigValue } from './configStore';

export type StoredSession = {
  userId: number;
  role: UserRole;
  activeCompanyId: number | null;
  expiresAt: number;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, StoredSession>();

function persistSession(token: string, session: StoredSession): void {
  setConfigValue('sessionToken', token);
  setConfigValue('session', session);
}

export function clearPersistedSession(): void {
  setConfigValue('sessionToken', null);
  setConfigValue('session', null);
}

function loadPersistedSession(): void {
  const token = getConfigValue<string | null>('sessionToken', null);
  const session = getConfigValue<StoredSession | null>('session', null);
  if (!token || !session) return;
  if (session.expiresAt < Date.now()) {
    clearPersistedSession();
    return;
  }
  sessions.set(token, session);
}

loadPersistedSession();

export function createSession(
  userId: number,
  role: UserRole,
  activeCompanyId: number | null,
): string {
  const token = randomUUID();
  const session: StoredSession = {
    userId,
    role,
    activeCompanyId,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  sessions.set(token, session);
  persistSession(token, session);
  return token;
}

export function validateSession(token: string): StoredSession | null {
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    clearPersistedSession();
    return null;
  }
  return session;
}

export function touchSession(token: string): void {
  const session = sessions.get(token);
  if (session) {
    session.expiresAt = Date.now() + SESSION_TTL_MS;
    persistSession(token, session);
  }
}

export function revokeSession(token: string): void {
  sessions.delete(token);
  clearPersistedSession();
}

export function updateSessionCompany(token: string, activeCompanyId: number | null): void {
  const session = sessions.get(token);
  if (session) {
    session.activeCompanyId = activeCompanyId;
    persistSession(token, session);
  }
}

export function getPersistedSessionToken(): string | null {
  return getConfigValue<string | null>('sessionToken', null);
}
