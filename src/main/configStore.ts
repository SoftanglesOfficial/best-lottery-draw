import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

type ConfigData = Record<string, unknown>;

let migrated = false;

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function migrateLegacyElectronStoreFiles(): void {
  if (migrated) return;
  migrated = true;

  const configPath = getConfigPath();
  if (fs.existsSync(configPath)) return;

  const userData = app.getPath('userData');
  const legacyDbPath = path.join(userData, 'db-config.json');
  const legacyPrefsPath = path.join(userData, 'app-preferences.json');
  const merged: ConfigData = {};

  if (fs.existsSync(legacyDbPath)) {
    try {
      const legacyDb = JSON.parse(fs.readFileSync(legacyDbPath, 'utf8')) as ConfigData;
      if (legacyDb.db) merged.db = legacyDb.db;
    } catch {
      // Ignore corrupt legacy file.
    }
  }

  if (fs.existsSync(legacyPrefsPath)) {
    try {
      const legacyPrefs = JSON.parse(fs.readFileSync(legacyPrefsPath, 'utf8')) as ConfigData;
      for (const key of ['autoBackup', 'lastBackupDate', 'windowBounds', 'networkMode'] as const) {
        if (legacyPrefs[key] !== undefined) merged[key] = legacyPrefs[key];
      }
    } catch {
      // Ignore corrupt legacy file.
    }
  }

  if (Object.keys(merged).length > 0) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf8');
  }
}

export function getConfig(): ConfigData {
  migrateLegacyElectronStoreFiles();
  try {
    const configPath = getConfigPath();
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as ConfigData;
    }
  } catch {
    // Ignore corrupt or unreadable config.
  }
  return {};
}

export function setConfig(data: ConfigData): void {
  const configPath = getConfigPath();
  const current = getConfig();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify({ ...current, ...data }, null, 2), 'utf8');
}

export function getConfigValue<T>(key: string, defaultValue: T): T {
  const value = getConfig()[key];
  return (value === undefined ? defaultValue : value) as T;
}

export function setConfigValue(key: string, value: unknown): void {
  setConfig({ [key]: value });
}
