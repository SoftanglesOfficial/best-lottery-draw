import {
  app,
  BrowserWindow,
  dialog,
  globalShortcut,
  ipcMain,
  Menu,
  shell,
} from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/register';
import { ensureConnected, getDbStatus, getStoredConfig } from './db';
import { runScheduledAutoBackup } from './ipc/backups';
import { startBroadcast, stopBroadcast } from './lan';
import {
  getAutoBackupEnabled,
  getLastBackupDate,
  getNetworkMode,
  getPreferences,
  setLastBackupDate,
  setWindowBounds,
} from './preferences';

if (started) {
  app.quit();
}

if (app.isPackaged) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { updateElectronApp } = require('update-electron-app');
    updateElectronApp({ updateInterval: '1 hour' });
  } catch {
    console.warn('Auto-updater not available');
  }
}

let mainWindow: BrowserWindow | null = null;

registerIpcHandlers();

function getMainWindow(): BrowserWindow | null {
  return mainWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
}

function sendToRenderer(channel: string, ...args: unknown[]) {
  getMainWindow()?.webContents.send(channel, ...args);
}

function navigateTo(path: string) {
  sendToRenderer('app:navigate', path);
}

function triggerLogout() {
  sendToRenderer('app:logout');
}

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: () => navigateTo('/settings'),
        },
        {
          label: 'Logout',
          accelerator: 'CmdOrCtrl+L',
          click: () => triggerLogout(),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Dashboard',
          accelerator: 'CmdOrCtrl+D',
          click: () => navigateTo('/dashboard'),
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => getMainWindow()?.webContents.reload(),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Best-12',
          click: () => void showAboutDialog(),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function showAboutDialog() {
  const config = getStoredConfig();
  let dbInfo = 'Not connected';
  try {
    const status = await getDbStatus();
    if (status.connected) {
      dbInfo = `${config.host}:${config.port}/${config.database}`;
      if (status.version) {
        dbInfo += `\n${status.version.split(',')[0]}`;
      }
    }
  } catch {
    dbInfo = `${config.host}:${config.port}/${config.database} (disconnected)`;
  }

  await dialog.showMessageBox({
    type: 'info',
    title: 'About Best-12',
    message: 'Best-12 — Morning Booking',
    detail: `Version: ${app.getVersion()}\nDatabase: ${dbInfo}`,
    buttons: ['Close'],
  });
}

function registerWindowHandlers(win: BrowserWindow) {
  win.on('close', () => {
    const bounds = win.getBounds();
    setWindowBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
    });
  });
}

const createWindow = () => {
  const prefs = getPreferences();
  const saved = prefs.windowBounds;

  mainWindow = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: saved?.width ?? 1280,
    height: saved?.height ?? 800,
    minWidth: 1024,
    minHeight: 768,
    title: 'Best-12 — Morning Booking',
    webPreferences: {
      preload: path.join(__dirname, 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  registerWindowHandlers(mainWindow);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

function registerAppShortcuts() {
  globalShortcut.register('CommandOrControl+,', () => navigateTo('/settings'));
  globalShortcut.register('CommandOrControl+D', () => navigateTo('/dashboard'));
  globalShortcut.register('CommandOrControl+L', () => triggerLogout());
}

function startAutoBackupScheduler() {
  setInterval(async () => {
    if (!getAutoBackupEnabled()) return;

    const lastBackup = getLastBackupDate();
    const today = new Date().toDateString();
    const now = new Date();

    if (now.getHours() === 23 && lastBackup !== today) {
      await runScheduledAutoBackup();
      setLastBackupDate(today);
    }
  }, 60 * 60 * 1000);
}

ipcMain.handle('window-set-title', (_event, title: string) => {
  getMainWindow()?.setTitle(title);
});

ipcMain.handle('app-get-version', () => app.getVersion());

ipcMain.handle('app-open-external', (_event, url: string) => {
  void shell.openExternal(url);
});

app.whenReady().then(async () => {
  registerIpcHandlers();
  buildMenu();
  await ensureConnected().catch(() => undefined);

  if (getNetworkMode() === 'server') {
    startBroadcast();
  }

  createWindow();
  registerAppShortcuts();
  startAutoBackupScheduler();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopBroadcast();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
