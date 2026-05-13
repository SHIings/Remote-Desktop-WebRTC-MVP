import { app, BrowserWindow, desktopCapturer, ipcMain, shell, systemPreferences } from 'electron';
import path from 'node:path';
import { executeSystemControlEvent } from './systemInputController';

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173';
const WINDOW_LABEL = process.env.WINDOW_LABEL?.trim();
const START_MODE = process.env.START_MODE?.trim();
const OPEN_DEVTOOLS = process.env.OPEN_DEVTOOLS === '1';

const parseStartMode = (): 'host' | 'viewer' | undefined => {
  if (START_MODE === 'host' || START_MODE === 'viewer') {
    return START_MODE;
  }

  return undefined;
};

const buildDevRendererUrl = (): string => {
  const url = new URL(DEV_SERVER_URL);
  const startMode = parseStartMode();

  if (WINDOW_LABEL) {
    url.searchParams.set('label', WINDOW_LABEL);
  }

  if (startMode) {
    url.searchParams.set('mode', startMode);
  }

  return url.toString();
};

interface ScreenSource {
  id: string;
  name: string;
  displayId: string;
}

interface ControlEventPayload {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'keydown' | 'keyup';
  x: number;
  y: number;
  button?: number;
  key?: string;
  code?: string;
  timestamp: number;
}

type ScreenRecordingStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

const allowedControlEventTypes: ControlEventPayload['type'][] = [
  'mousemove',
  'mousedown',
  'mouseup',
  'click',
  'keydown',
  'keyup'
];

const isControlEventPayload = (value: unknown): value is ControlEventPayload => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const event = value as Partial<ControlEventPayload>;

  return (
    typeof event.type === 'string' &&
    allowedControlEventTypes.includes(event.type as ControlEventPayload['type']) &&
    typeof event.x === 'number' &&
    typeof event.y === 'number' &&
    typeof event.timestamp === 'number'
  );
};

let accessibilityPromptRequested = false;

const ACCESSIBILITY_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility';

const getScreenRecordingStatus = (): ScreenRecordingStatus => {
  if (process.platform !== 'darwin') {
    return 'unknown';
  }

  const status = systemPreferences.getMediaAccessStatus('screen');

  if (
    status === 'not-determined' ||
    status === 'granted' ||
    status === 'denied' ||
    status === 'restricted' ||
    status === 'unknown'
  ) {
    return status;
  }

  return 'unknown';
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: WINDOW_LABEL ? `Remote Desktop MVP - ${WINDOW_LABEL}` : 'Remote Desktop MVP',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (app.isPackaged) {
    const query: Record<string, string> = {};
    const startMode = parseStartMode();

    if (WINDOW_LABEL) {
      query.label = WINDOW_LABEL;
    }

    if (startMode) {
      query.mode = startMode;
    }

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'), { query }).catch((error) => {
      console.error('Failed to load production HTML:', error);
    });
  } else {
    mainWindow.loadURL(buildDevRendererUrl()).catch((error) => {
      console.error('Failed to load dev server URL:', error);
    });

    if (OPEN_DEVTOOLS) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  }
};

ipcMain.handle('desktop:get-sources', async (): Promise<ScreenSource[]> => {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 0, height: 0 }
  });

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    displayId: source.display_id
  }));
});

ipcMain.handle('control:execute', async (_event, payload: unknown) => {
  if (!isControlEventPayload(payload)) {
    return {
      mode: 'mock',
      reason: 'Invalid control event payload'
    };
  }

  if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
    if (!accessibilityPromptRequested) {
      accessibilityPromptRequested = true;
      systemPreferences.isTrustedAccessibilityClient(true);
    }

    return {
      mode: 'mock',
      reason: 'Accessibility permission is not granted for this Electron app'
    };
  }

  return executeSystemControlEvent(payload);
});

ipcMain.handle('permissions:get-control-status', () => {
  return {
    platform: process.platform,
    accessibilityTrusted:
      process.platform === 'darwin' ? systemPreferences.isTrustedAccessibilityClient(false) : true,
    screenRecordingStatus: getScreenRecordingStatus()
  };
});

ipcMain.handle('permissions:request-accessibility', async () => {
  if (process.platform !== 'darwin') {
    return true;
  }

  accessibilityPromptRequested = true;
  const trusted = systemPreferences.isTrustedAccessibilityClient(true);

  if (!trusted) {
    await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
  }

  return trusted;
});

ipcMain.handle('permissions:open-control-settings', async () => {
  if (process.platform !== 'darwin') {
    return false;
  }

  await shell.openExternal(ACCESSIBILITY_SETTINGS_URL);
  return true;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
