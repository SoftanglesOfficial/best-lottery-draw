import { randomUUID } from 'crypto';
import { safeStorage } from 'electron';
import type { UserRole } from '../shared/types';
import { getConfigValue, setConfig } from './configStore';

export type StoredSession = {
  userId: number;
  role: UserRole;
  activeCompanyId: number | null;
  activeShiftId: number | null;
  expiresAt: number;
};

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, StoredSession>();
let persistedSessionLoaded = false;

function persistSession(token: string, session: StoredSession): boolean {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const encrypted = safeStorage.encryptString(JSON.stringify(session)).toString('base64');
    setConfig({ sessionToken: token, session: encrypted });
    return true;
  } catch {
    return false;
  }
}

export function clearPersistedSession(): boolean {
  try {
    setConfig({ sessionToken: null, session: null });
    return true;
  } catch {
    return false;
  }
}

function loadPersistedSession(): void {
  if (persistedSessionLoaded) return;
  persistedSessionLoaded = true;
  const token = getConfigValue<string | null>('sessionToken', null);
  const encrypted = getConfigValue<string | null>('session', null);
  if (!token || !encrypted || !safeStorage.isEncryptionAvailable()) {
    clearPersistedSession();
    return;
  }
  try {
    const session = JSON.parse(
      safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
    ) as StoredSession;
    if (!Number.isInteger(session.userId) || session.expiresAt < Date.now()) {
      clearPersistedSession();
      return;
    }
    sessions.set(token, { ...session, activeShiftId: session.activeShiftId ?? null });
  } catch {
    clearPersistedSession();
  }
}

export function createSession(
  userId: number,
  role: UserRole,
): string {
  const token = randomUUID();
  const session: StoredSession = {
    userId,
    role,
    activeCompanyId: null,
    activeShiftId: null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  if (!persistSession(token, session)) {
    throw new Error('Failed to securely persist the session');
  }
  persistedSessionLoaded = true;
  sessions.set(token, session);
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

export function touchSession(token: string): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  const updated = { ...session, expiresAt: Date.now() + SESSION_TTL_MS };
  if (!persistSession(token, updated)) return false;
  sessions.set(token, updated);
  return true;
}

export function revokeSession(token: string): boolean {
  sessions.delete(token);
  return clearPersistedSession();
}

export function updateSessionCompany(token: string, activeCompanyId: number | null): boolean {
  const session = sessions.get(token);
  if (!session) return false;
  const updated = { ...session, activeCompanyId, activeShiftId: null };
  if (!persistSession(token, updated)) return false;
  sessions.set(token, updated);
  return true;
}

export function updateSessionShift(
  token: string,
  activeShiftId: number | null,
  expectedCompanyId = sessions.get(token)?.activeCompanyId ?? null,
): boolean {
  const session = sessions.get(token);
  if (!session || session.activeCompanyId !== expectedCompanyId) return false;
  const updated = { ...session, activeShiftId };
  if (!persistSession(token, updated)) return false;
  sessions.set(token, updated);
  return true;
}

export function refreshSessionAuthorization(
  token: string,
  role: UserRole,
  activeCompanyId: number | null,
  expectedCompanyId = sessions.get(token)?.activeCompanyId ?? null,
): boolean {
  const session = sessions.get(token);
  if (!session || session.activeCompanyId !== expectedCompanyId) return false;
  const updated = {
    ...session,
    role,
    activeCompanyId,
    activeShiftId: session.activeCompanyId === activeCompanyId ? session.activeShiftId : null,
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  if (!persistSession(token, updated)) return false;
  sessions.set(token, updated);
  return true;
}

export function isSessionSelectionCurrent(
  token: string,
  companyId: number | null,
  shiftId: number | null,
): boolean {
  const session = sessions.get(token);
  return session?.activeCompanyId === companyId && session.activeShiftId === shiftId;
}

export function getPersistedSessionToken(): string | null {
  loadPersistedSession();
  return getConfigValue<string | null>('sessionToken', null);
}
