import { contextBridge, ipcRenderer } from 'electron';

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

interface ControlExecutionResult {
  mode: 'native' | 'mock';
  reason?: string;
}

type ScreenRecordingStatus = 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';

interface ControlPermissionStatus {
  platform: string;
  accessibilityTrusted: boolean;
  screenRecordingStatus: ScreenRecordingStatus;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getScreenSources: (): Promise<ScreenSource[]> => ipcRenderer.invoke('desktop:get-sources'),
  executeControlEvent: (event: ControlEventPayload): Promise<ControlExecutionResult> =>
    ipcRenderer.invoke('control:execute', event),
  getControlPermissionStatus: (): Promise<ControlPermissionStatus> =>
    ipcRenderer.invoke('permissions:get-control-status'),
  requestAccessibilityPermission: (): Promise<boolean> =>
    ipcRenderer.invoke('permissions:request-accessibility'),
  openControlPermissionSettings: (): Promise<boolean> =>
    ipcRenderer.invoke('permissions:open-control-settings')
});
