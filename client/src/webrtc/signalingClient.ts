import type {
  AnswerMessage,
  ClientSignalMessage,
  IceCandidateMessage,
  JoinMessage,
  OfferMessage,
  PeerRole,
  ServerSignalMessage
} from '../types/signaling';

interface SignalingHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
  onMessage?: (message: ServerSignalMessage) => void;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const parseServerMessage = (raw: string): ServerSignalMessage | undefined => {
  try {
    const parsed = JSON.parse(raw) as unknown;

    if (!isObject(parsed) || typeof parsed.type !== 'string') {
      return undefined;
    }

    return parsed as unknown as ServerSignalMessage;
  } catch {
    return undefined;
  }
};

export class SignalingClient {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private readonly handlers: SignalingHandlers;

  constructor(url: string, handlers: SignalingHandlers = {}) {
    this.url = url;
    this.handlers = handlers;
  }

  async connect(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const socket = new WebSocket(this.url);
      this.socket = socket;

      socket.onopen = () => {
        this.handlers.onOpen?.();

        if (!settled) {
          settled = true;
          resolve();
        }
      };

      socket.onmessage = (event) => {
        const message = parseServerMessage(String(event.data));

        if (!message) {
          return;
        }

        this.handlers.onMessage?.(message);
      };

      socket.onerror = (event) => {
        this.handlers.onError?.(event);

        if (!settled) {
          settled = true;
          reject(new Error('Failed to connect to signaling server.'));
        }
      };

      socket.onclose = () => {
        this.handlers.onClose?.();
      };
    });
  }

  joinRoom(roomId: string, peerRole: PeerRole): boolean {
    const message: JoinMessage = {
      type: 'join',
      roomId,
      peerRole
    };

    return this.send(message);
  }

  sendOffer(roomId: string, sdp: OfferMessage['sdp']): boolean {
    return this.send({ type: 'offer', roomId, sdp });
  }

  sendAnswer(roomId: string, sdp: AnswerMessage['sdp']): boolean {
    return this.send({ type: 'answer', roomId, sdp });
  }

  sendIceCandidate(roomId: string, candidate: IceCandidateMessage['candidate']): boolean {
    return this.send({ type: 'ice-candidate', roomId, candidate });
  }

  send(message: ClientSignalMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(JSON.stringify(message));
    return true;
  }

  close(): void {
    if (!this.socket) {
      return;
    }

    if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
      this.socket.close();
    }

    this.socket = null;
  }
}
