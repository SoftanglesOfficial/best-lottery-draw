import { safeStorage } from 'electron';
import { getConfigValue, setConfigValue } from './configStore';

const RESULT_KEY_ENC_PREFIX = 'enc:v1:';
const CONFIG_KEY = 'resultKeys';

type StoredResultKeys = Record<string, string>;

function encryptKeyBytes(key32: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    return key32.toString('base64');
  }
  return `${RESULT_KEY_ENC_PREFIX}${safeStorage.encryptString(key32.toString('base64')).toString('base64')}`;
}

function decryptKeyBytes(stored: string): Buffer | null {
  if (stored.startsWith(RESULT_KEY_ENC_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      const plain = safeStorage.decryptString(
        Buffer.from(stored.slice(RESULT_KEY_ENC_PREFIX.length), 'base64'),
      );
      return Buffer.from(plain, 'base64');
    } catch {
      return null;
    }
  }
  try {
    return Buffer.from(stored, 'base64');
  } catch {
    return null;
  }
}

function readMap(): StoredResultKeys {
  return getConfigValue<StoredResultKeys>(CONFIG_KEY, {});
}

function writeMap(map: StoredResultKeys): void {
  setConfigValue(CONFIG_KEY, map);
}

export function hasCompanyResultKey(companyId: number): boolean {
  return getCompanyResultKey(companyId) != null;
}

export function getCompanyResultKey(companyId: number): Buffer | null {
  const stored = readMap()[String(companyId)];
  if (!stored) return null;
  const key = decryptKeyBytes(stored);
  return key != null && key.length === 32 ? key : null;
}

export function setCompanyResultKey(companyId: number, key32: Buffer): void {
  if (key32.length !== 32) throw new Error('Result key must be 32 bytes');
  const map = readMap();
  map[String(companyId)] = encryptKeyBytes(key32);
  writeMap(map);
}
