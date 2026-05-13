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

export interface ControlExecutionResult {
  mode: 'native' | 'mock';
  reason?: string;
}

interface NutModule {
  Button: {
    LEFT: number;
    MIDDLE: number;
    RIGHT: number;
  };
  Key: Record<string, number>;
  Point: new (x: number, y: number) => { x: number; y: number };
  straightTo: (point: { x: number; y: number }) => unknown;
  mouse: {
    move: (path: unknown) => Promise<unknown>;
    click: (button: number) => Promise<unknown>;
    pressButton: (button: number) => Promise<unknown>;
    releaseButton: (button: number) => Promise<unknown>;
  };
  keyboard: {
    pressKey: (...keys: number[]) => Promise<unknown>;
    releaseKey: (...keys: number[]) => Promise<unknown>;
  };
  screen: {
    width: () => Promise<number>;
    height: () => Promise<number>;
  };
}

const KEY_CODE_MAP: Record<string, string> = {
  Enter: 'Enter',
  NumpadEnter: 'Return',
  Tab: 'Tab',
  Escape: 'Escape',
  Space: 'Space',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Insert: 'Insert',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ShiftLeft: 'LeftShift',
  ShiftRight: 'RightShift',
  ControlLeft: 'LeftControl',
  ControlRight: 'RightControl',
  AltLeft: 'LeftAlt',
  AltRight: 'RightAlt',
  MetaLeft: 'LeftSuper',
  MetaRight: 'RightSuper',
  CapsLock: 'CapsLock',
  NumLock: 'NumLock',
  ScrollLock: 'ScrollLock',
  Backquote: 'Grave',
  Minus: 'Minus',
  Equal: 'Equal',
  BracketLeft: 'LeftBracket',
  BracketRight: 'RightBracket',
  Backslash: 'Backslash',
  Semicolon: 'Semicolon',
  Quote: 'Quote',
  Comma: 'Comma',
  Period: 'Period',
  Slash: 'Slash',
  NumpadDivide: 'Divide',
  NumpadMultiply: 'Multiply',
  NumpadSubtract: 'Subtract',
  NumpadAdd: 'Add',
  NumpadDecimal: 'Decimal'
};

const printableKeyToEnumName: Record<string, string> = {
  ' ': 'Space',
  ',': 'Comma',
  '.': 'Period',
  '/': 'Slash',
  ';': 'Semicolon',
  "'": 'Quote',
  '[': 'LeftBracket',
  ']': 'RightBracket',
  '\\': 'Backslash',
  '-': 'Minus',
  '=': 'Equal',
  '`': 'Grave'
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

class SystemInputController {
  private nutModule: NutModule | null = null;
  private initPromise: Promise<void> | null = null;
  private initError: string | null = null;
  private readonly pressedKeys = new Set<number>();

  async execute(event: ControlEvent): Promise<ControlExecutionResult> {
    await this.ensureNutModuleLoaded();

    if (!this.nutModule) {
      console.log('execute control event (mock fallback)', event);
      return {
        mode: 'mock',
        reason: this.initError ?? 'nut.js unavailable'
      };
    }

    try {
      await this.executeWithNut(event);
      return { mode: 'native' };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown runtime error';
      console.error('nut.js runtime error, fallback to mock:', reason);
      console.log('execute control event (mock fallback)', event);
      return {
        mode: 'mock',
        reason
      };
    }
  }

  private async ensureNutModuleLoaded(): Promise<void> {
    if (this.nutModule || this.initError) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = import('@nut-tree/nut-js')
        .then((module) => {
          this.nutModule = module as unknown as NutModule;
        })
        .catch((error) => {
          this.nutModule = null;
          this.initError = error instanceof Error ? error.message : 'Failed to initialize nut.js';
          console.error('Failed to initialize nut.js. Falling back to mock mode.', error);
        });
    }

    await this.initPromise;
  }

  private async executeWithNut(event: ControlEvent): Promise<void> {
    if (!this.nutModule) {
      return;
    }

    switch (event.type) {
      case 'mousemove': {
        await this.moveMouseByNormalizedPosition(event.x, event.y);
        return;
      }
      case 'mousedown': {
        await this.moveMouseByNormalizedPosition(event.x, event.y);
        await this.nutModule.mouse.pressButton(this.resolveMouseButton(event.button));
        return;
      }
      case 'mouseup': {
        await this.moveMouseByNormalizedPosition(event.x, event.y);
        await this.nutModule.mouse.releaseButton(this.resolveMouseButton(event.button));
        return;
      }
      case 'click': {
        await this.moveMouseByNormalizedPosition(event.x, event.y);
        await this.nutModule.mouse.click(this.resolveMouseButton(event.button));
        return;
      }
      case 'keydown': {
        const resolvedKey = this.resolveNutKey(event.code, event.key);

        if (!resolvedKey) {
          return;
        }

        this.pressedKeys.add(resolvedKey);
        await this.nutModule.keyboard.pressKey(resolvedKey);
        return;
      }
      case 'keyup': {
        const resolvedKey = this.resolveNutKey(event.code, event.key);

        if (!resolvedKey) {
          return;
        }

        if (!this.pressedKeys.has(resolvedKey)) {
          await this.nutModule.keyboard.releaseKey(resolvedKey);
          return;
        }

        this.pressedKeys.delete(resolvedKey);
        await this.nutModule.keyboard.releaseKey(resolvedKey);
        return;
      }
      default:
        return;
    }
  }

  private async moveMouseByNormalizedPosition(normalizedX: number, normalizedY: number): Promise<void> {
    if (!this.nutModule) {
      return;
    }

    const width = await this.nutModule.screen.width();
    const height = await this.nutModule.screen.height();

    const x = Math.round(clamp01(normalizedX) * Math.max(width - 1, 0));
    const y = Math.round(clamp01(normalizedY) * Math.max(height - 1, 0));

    const point = new this.nutModule.Point(x, y);
    await this.nutModule.mouse.move(this.nutModule.straightTo(point));
  }

  private resolveMouseButton(button?: number): number {
    if (!this.nutModule) {
      return 0;
    }

    if (button === 1) {
      return this.nutModule.Button.MIDDLE;
    }

    if (button === 2) {
      return this.nutModule.Button.RIGHT;
    }

    return this.nutModule.Button.LEFT;
  }

  private resolveNutKey(code?: string, key?: string): number | undefined {
    if (!this.nutModule) {
      return undefined;
    }

    if (code && /^Key[A-Z]$/.test(code)) {
      return this.nutModule.Key[code.slice(3)];
    }

    if (code && /^Digit[0-9]$/.test(code)) {
      const digit = code.slice(5);
      return this.nutModule.Key[`Num${digit}`];
    }

    if (code && /^Numpad[0-9]$/.test(code)) {
      const digit = code.slice(6);
      return this.nutModule.Key[`NumPad${digit}`];
    }

    if (code && /^F([1-9]|1[0-9]|2[0-4])$/.test(code)) {
      return this.nutModule.Key[code];
    }

    const mappedName = (code && KEY_CODE_MAP[code]) || (key && printableKeyToEnumName[key]);

    if (mappedName && this.nutModule.Key[mappedName] !== undefined) {
      return this.nutModule.Key[mappedName];
    }

    return undefined;
  }
}

const systemInputController = new SystemInputController();

export const executeSystemControlEvent = (event: ControlEvent): Promise<ControlExecutionResult> => {
  return systemInputController.execute(event);
};
