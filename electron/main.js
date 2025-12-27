import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
  Tray,
} from 'electron';
import process from 'process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const iconPath = isDev
  ? path.join(__dirname, 'icons', 'app-dev.ico')
  : path.join(process.resourcesPath, 'icons', 'app-dev.ico');
const preloadPath = path.join(__dirname, 'preload.js');
const WINDOW_STATE_CHANNEL = 'window-state-changed';
const WINDOW_CONTROL_CHANNEL = 'window-control';
const WINDOW_STATE_REQUEST_CHANNEL = 'window-state';
const WINDOW_THEME_CHANNEL = 'window-theme';
let mainWindow = null;
let tray = null;
let isQuiting = false;
let hasStartedProxy = false;
const gotTheLock = app.requestSingleInstanceLock();

const buildTray = () => {
  if (tray) return tray;

  tray = new Tray(iconPath);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏窗口',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: isDev ? '切换开发者工具' : '显示窗口',
      click: () => {
        if (!mainWindow) return;
        if (isDev) {
          mainWindow.webContents.toggleDevTools();
        } else {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip('FlashChat X');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
};
const getContentSecurityPolicy = () =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' blob:",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self' http://localhost:3000 ws://localhost:3000 http://localhost:8787 ws://localhost:8787 https:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

const createWindow = () => {
  const windowBackground = nativeTheme.shouldUseDarkColors
    ? '#0a0a0a'
    : '#ffffff';

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    icon: iconPath,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: windowBackground,
    show: false,
    webPreferences: {
      contextIsolation: true,
      preload: preloadPath,
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL(
      process.env.ELECTRON_START_URL || 'http://localhost:3000'
    );
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  const sendWindowState = () => {
    if (!mainWindow) return;
    mainWindow.webContents.send(WINDOW_STATE_CHANNEL, {
      isMaximized: mainWindow.isMaximized(),
    });
  };

  mainWindow.on('maximize', sendWindowState);
  mainWindow.on('unmaximize', sendWindowState);
  mainWindow.once('ready-to-show', () => {
    if (!mainWindow) return;
    mainWindow.show();
    sendWindowState();
  });

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `Window failed to load ${validatedURL}: [${errorCode}] ${errorDescription}`
      );
    }
  );

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('close', event => {
    if (isQuiting) return;
    event.preventDefault();
    mainWindow?.hide();
  });
};

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      createWindow();
      buildTray();
      return;
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    mainWindow.focus();
  });
}

ipcMain.handle(WINDOW_CONTROL_CHANNEL, (event, action) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return;

  switch (action) {
    case 'minimize':
      win.minimize();
      break;
    case 'toggle-maximize':
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
      break;
    case 'close':
      win.close();
      break;
    default:
      break;
  }
});

ipcMain.handle(WINDOW_STATE_REQUEST_CHANNEL, event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return {
    isMaximized: win?.isMaximized() ?? false,
  };
});

ipcMain.on(WINDOW_THEME_CHANNEL, (event, color) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || typeof color !== 'string') return;
  win.setBackgroundColor(color);
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.flashchatx.app');

  const csp = getContentSecurityPolicy();
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const headers = details.responseHeaders ?? {};
    headers['Content-Security-Policy'] = [csp];
    callback({ responseHeaders: headers });
  });

  // In packaged builds, start the local proxy server inside the Electron main process.
  // This avoids relying on an external `npm run proxy` process and prevents CORS issues.
  if (!isDev && !hasStartedProxy) {
    hasStartedProxy = true;
    import('../server/proxy.js').catch(error => {
      console.error('[main] Failed to start bundled proxy server:', error);
    });
  }

  if (gotTheLock) {
    createWindow();
    buildTray();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
