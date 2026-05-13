export type ControlEventType = 'mousemove' | 'mousedown' | 'mouseup' | 'click' | 'keydown' | 'keyup';

export interface ControlEvent {
  type: ControlEventType;
  x: number;
  y: number;
  button?: number;
  key?: string;
  code?: string;
  timestamp: number;
}
