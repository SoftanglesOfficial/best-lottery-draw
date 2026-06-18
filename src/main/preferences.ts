import { getConfigValue, setConfigValue } from './configStore';

export interface WindowBounds {
  x?: number;
  y?: number;
  width: number;
  height: number;
}

export type NetworkMode = 'server' | 'client';

export interface AppPreferences {
  autoBackup: boolean;
  lastBackupDate: string | null;
  windowBounds: WindowBounds | null;
  networkMode: NetworkMode;
}

const DEFAULTS: AppPreferences = {
  autoBackup: false,
  lastBackupDate: null,
  windowBounds: null,
  networkMode: 'client',
};

export function getPreferences(): AppPreferences {
  return {
    autoBackup: getConfigValue('autoBackup', DEFAULTS.autoBackup),
    lastBackupDate: getConfigValue('lastBackupDate', DEFAULTS.lastBackupDate),
    windowBounds: getConfigValue('windowBounds', DEFAULTS.windowBounds),
    networkMode: getConfigValue('networkMode', DEFAULTS.networkMode),
  };
}

export function setAutoBackup(enabled: boolean): void {
  setConfigValue('autoBackup', enabled);
}

export function setLastBackupDate(date: string): void {
  setConfigValue('lastBackupDate', date);
}

export function setWindowBounds(bounds: WindowBounds): void {
  setConfigValue('windowBounds', bounds);
}

export function getAutoBackupEnabled(): boolean {
  return getConfigValue('autoBackup', DEFAULTS.autoBackup);
}

export function getLastBackupDate(): string | null {
  return getConfigValue('lastBackupDate', DEFAULTS.lastBackupDate);
}

export function getNetworkMode(): NetworkMode {
  return getConfigValue('networkMode', DEFAULTS.networkMode);
}

export function setNetworkMode(mode: NetworkMode): void {
  setConfigValue('networkMode', mode);
}
