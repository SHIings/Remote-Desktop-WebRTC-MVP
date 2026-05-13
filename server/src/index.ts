import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { RoomManager } from './roomManager';
import type { ClientMessage, ErrorMessage, PeerRole, ServerMessage } from './types';

const DEFAULT_PORT = 8080;
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const roomManager = new RoomManager();

const wss = new WebSocketServer({ port });

const sendMessage = (socket: WebSocket, message: ServerMessage): void => {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
};

const sendError = (socket: WebSocket, message: string, roomId?: string): void => {
  const errorPayload: ErrorMessage = { type: 'error', message, roomId };
  sendMessage(socket, errorPayload);
};

const isPeerRole = (value: unknown): value is PeerRole => value === 'host' || value === 'viewer';

const parseMessage = (raw: WebSocket.RawData): ClientMessage | undefined => {
  try {
    const parsed = JSON.parse(raw.toString()) as ClientMessage;

    if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
      return undefined;
    }

    return parsed;
  } catch {
    return undefined;
  }
};

wss.on('connection', (socket) => {
  socket.on('message', (raw) => {
    const message = parseMessage(raw);

    if (!message) {
      sendError(socket, 'Invalid message payload.');
      return;
    }

    if (message.type === 'join') {
      const { roomId, peerRole } = message;

      if (!roomId || typeof roomId !== 'string' || !isPeerRole(peerRole)) {
        sendError(socket, 'Invalid join payload.');
        return;
      }

      const result = roomManager.join(socket, roomId, peerRole);

      if (!result.ok) {
        sendError(socket, result.error ?? 'Failed to join room.', roomId);
        return;
      }

      if (result.shouldNotifyPeerJoined) {
        const room = roomManager.getRoom(roomId);

        if (room?.host) {
          sendMessage(room.host, { type: 'peer-joined', roomId });
        }

        if (room?.viewer) {
          sendMessage(room.viewer, { type: 'peer-joined', roomId });
        }
      }

      return;
    }

    if (message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate') {
      const peerInfo = roomManager.getPeerInfo(socket);

      if (!peerInfo) {
        sendError(socket, 'Join a room before signaling.');
        return;
      }

      if (message.roomId !== peerInfo.roomId) {
        sendError(socket, 'Room mismatch in signaling message.', peerInfo.roomId);
        return;
      }

      const target = roomManager.getOtherPeer(socket);

      if (!target) {
        sendError(socket, 'No peer in room yet.', peerInfo.roomId);
        return;
      }

      sendMessage(target, message);
      return;
    }

    sendError(socket, `Unsupported message type: ${(message as { type: string }).type}`);
  });

  socket.on('close', () => {
    const leaveResult = roomManager.leave(socket);

    if (!leaveResult?.peerToNotify) {
      return;
    }

    sendMessage(leaveResult.peerToNotify, {
      type: 'peer-left',
      roomId: leaveResult.roomId
    });
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

console.log(`Signaling server running at ws://localhost:${port}`);
