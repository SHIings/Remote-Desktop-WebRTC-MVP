import type { ControlEvent } from '../types/control';

export const CONTROL_CHANNEL_LABEL = 'control';

interface ControlChannelHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
  onEvent?: (event: ControlEvent) => void;
}

const isControlEvent = (value: unknown): value is ControlEvent => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const event = value as Partial<ControlEvent>;

  return (
    typeof event.type === 'string' &&
    typeof event.x === 'number' &&
    typeof event.y === 'number' &&
    typeof event.timestamp === 'number'
  );
};

export const bindControlChannel = (
  channel: RTCDataChannel,
  handlers: ControlChannelHandlers = {}
): void => {
  channel.onopen = () => {
    handlers.onOpen?.();
  };

  channel.onclose = () => {
    handlers.onClose?.();
  };

  channel.onerror = () => {
    handlers.onError?.();
  };

  channel.onmessage = (event) => {
    try {
      const parsed = JSON.parse(String(event.data));

      if (!isControlEvent(parsed)) {
        return;
      }

      handlers.onEvent?.(parsed);
    } catch {
      // Ignore malformed control payloads.
    }
  };
};

export const createControlChannel = (
  pc: RTCPeerConnection,
  handlers: ControlChannelHandlers = {}
): RTCDataChannel => {
  const channel = pc.createDataChannel(CONTROL_CHANNEL_LABEL);
  bindControlChannel(channel, handlers);
  return channel;
};

export const sendControlEvent = (channel: RTCDataChannel | null, event: ControlEvent): boolean => {
  if (!channel || channel.readyState !== 'open') {
    return false;
  }

  channel.send(JSON.stringify(event));
  return true;
};
