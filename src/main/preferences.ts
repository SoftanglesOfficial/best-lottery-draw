import Store from 'electron-store';

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

const preferencesStore = new Store<AppPreferences>({
  name: 'app-preferences',
  defaults: {
    autoBackup: false,
    lastBackupDate: null,
    windowBounds: null,
    networkMode: 'client',
  },
});

export function getPreferences(): AppPreferences {
  return {
    autoBackup: preferencesStore.get('autoBackup', false),
    lastBackupDate: preferencesStore.get('lastBackupDate', null),
    windowBounds: preferencesStore.get('windowBounds', null),
    networkMode: preferencesStore.get('networkMode', 'client'),
  };
}

export function setAutoBackup(enabled: boolean): void {
  preferencesStore.set('autoBackup', enabled);
}

export function setLastBackupDate(date: string): void {
  preferencesStore.set('lastBackupDate', date);
}

export function setWindowBounds(bounds: WindowBounds): void {
  preferencesStore.set('windowBounds', bounds);
}

export function getAutoBackupEnabled(): boolean {
  return preferencesStore.get('autoBackup', false);
}

export function getLastBackupDate(): string | null {
  return preferencesStore.get('lastBackupDate', null);
}

export function getNetworkMode(): NetworkMode {
  return preferencesStore.get('networkMode', 'client');
}

export function setNetworkMode(mode: NetworkMode): void {
  preferencesStore.set('networkMode', mode);
}
