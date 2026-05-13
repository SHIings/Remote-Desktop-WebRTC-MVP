import type { ControlEvent } from '../types/control';
import type { ControlExecutionResult } from '../types/electron';

export const executeControlEvent = async (event: ControlEvent): Promise<ControlExecutionResult> => {
  try {
    const result = await window.electronAPI.executeControlEvent(event);

    if (result.mode === 'mock') {
      console.log('execute control event (mock fallback)', { event, reason: result.reason });
    }

    return result;
  } catch (error) {
    console.error('Failed to execute system control event, fallback to mock.', error);
    console.log('execute control event (mock fallback)', event);
    return {
      mode: 'mock',
      reason: error instanceof Error ? error.message : 'IPC execution failed'
    };
  }
};
