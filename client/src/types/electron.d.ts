export interface ScreenSource {
  id: string;
  name: string;
  displayId: string;
}

export interface ControlEventPayload {
  type: 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'keydown' | 'keyup';
  x: number;
  y: number;
  button?: number;
  key?: string;
  code?: string;
  timestamp: number;
}

export interface ControlExecutionResult {
  mode: 'native' | 'mock';
  reason?: string;
}

export type ScreenRecordingStatus =
  | 'not-determined'
  | 'granted'
  | 'denied'
  | 'restricted'
  | 'unknown';

export interface ControlPermissionStatus {
  platform: string;
  accessibilityTrusted: boolean;
  screenRecordingStatus: ScreenRecordingStatus;
}

declare global {
  interface Window {
    electronAPI: {
      getScreenSources: () => Promise<ScreenSource[]>;
      executeControlEvent: (event: ControlEventPayload) => Promise<ControlExecutionResult>;
      getControlPermissionStatus: () => Promise<ControlPermissionStatus>;
      requestAccessibilityPermission: () => Promise<boolean>;
      openControlPermissionSettings: () => Promise<boolean>;
    };
  }
}

export {};
