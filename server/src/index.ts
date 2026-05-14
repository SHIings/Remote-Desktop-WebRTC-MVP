import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import { getServerConfig } from './config';
import { logger } from './logger';
import { RoomManager } from './roomManager';
import type { ClientMessage, ErrorMessage, PeerRole, ServerMessage } from './types';

const MAX_ROOM_ID_LENGTH = 64;
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

const isValidRoomId = (roomId: unknown): roomId is string => {
  return typeof roomId === 'string' && roomId.length > 0 && roomId.length <= MAX_ROOM_ID_LENGTH;
};

const config = getServerConfig();
const roomManager = new RoomManager();

const httpServer = createServer((req, res) => {
  if (req.url === '/healthz') {
    const stats = roomManager.getStats();
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(
      JSON.stringify({
        status: 'ok',
        uptimeSec: Math.floor(process.uptime()),
        ...stats
      })
    );
    return;
  }

  res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ status: 'not_found' }));
});

const wss = new WebSocketServer({ server: httpServer });
const lastPongAt = new Map<WebSocket, number>();
const socketId = new Map<WebSocket, string>();

let socketCounter = 0;
const nextSocketId = (): string => {
  socketCounter += 1;
  return `peer-${socketCounter}`;
};

const sendMessage = (socket: WebSocket, message: ServerMessage): void => {
  if (socket.readyState !== socket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(message));
};

const sendError = (socket: WebSocket, message: string, roomId?: string, code?: string): void => {
  const errorPayload: ErrorMessage = { type: 'error', code, message, roomId };
  sendMessage(socket, errorPayload);
};

wss.on('connection', (socket, request) => {
  const peerSocketId = nextSocketId();
  const sourceIp = request.socket.remoteAddress ?? 'unknown';

  socketId.set(socket, peerSocketId);
  lastPongAt.set(socket, Date.now());

  logger.info('WebSocket connected', { socketId: peerSocketId, sourceIp });

  socket.on('pong', () => {
    lastPongAt.set(socket, Date.now());
  });

  socket.on('message', (raw) => {
    lastPongAt.set(socket, Date.now());

    const message = parseMessage(raw);

    if (!message) {
      sendError(socket, 'Invalid message payload.', undefined, 'INVALID_PAYLOAD');
      return;
    }

    if (message.type === 'join') {
      const { roomId, peerRole } = message;

      if (!isValidRoomId(roomId) || !isPeerRole(peerRole)) {
        sendError(socket, 'Invalid join payload.', undefined, 'INVALID_JOIN');
        return;
      }

      const result = roomManager.join(socket, roomId, peerRole);

      if (!result.ok) {
        sendError(socket, result.error ?? 'Failed to join room.', roomId, 'JOIN_REJECTED');
        return;
      }

      logger.info('Peer joined room', { socketId: peerSocketId, roomId, peerRole });

      if (result.shouldNotifyPeerJoined) {
        const room = roomManager.getRoom(roomId);

        if (room?.host) {
          sendMessage(room.host, { type: 'peer-joined', roomId });
        }

        if (room?.viewer) {
          sendMessage(room.viewer, { type: 'peer-joined', roomId });
        }

        logger.info('Room paired', { roomId });
      }

      return;
    }

    if (message.type === 'offer' || message.type === 'answer' || message.type === 'ice-candidate') {
      const peerInfo = roomManager.getPeerInfo(socket);

      if (!peerInfo) {
        sendError(socket, 'Join a room before signaling.', undefined, 'NOT_JOINED');
        return;
      }

      if (message.roomId !== peerInfo.roomId) {
        sendError(socket, 'Room mismatch in signaling message.', peerInfo.roomId, 'ROOM_MISMATCH');
        return;
      }

      const target = roomManager.getOtherPeer(socket);

      if (!target) {
        sendError(socket, 'No peer in room yet.', peerInfo.roomId, 'PEER_NOT_FOUND');
        return;
      }

      sendMessage(target, message);
      return;
    }

    sendError(socket, `Unsupported message type: ${(message as { type: string }).type}`, undefined, 'UNSUPPORTED');
  });

  socket.on('close', () => {
    lastPongAt.delete(socket);
    socketId.delete(socket);

    const leaveResult = roomManager.leave(socket);

    if (leaveResult?.peerToNotify) {
      sendMessage(leaveResult.peerToNotify, {
        type: 'peer-left',
        roomId: leaveResult.roomId
      });
    }

    logger.info('WebSocket disconnected', {
      socketId: peerSocketId,
      roomId: leaveResult?.roomId,
      role: leaveResult?.role
    });
  });

  socket.on('error', (error) => {
    logger.error('WebSocket error', { socketId: peerSocketId, error: String(error) });
  });
});

wss.on('error', (error) => {
  logger.error('WebSocket server error', { error: String(error) });
});

const heartbeatTimer = setInterval(() => {
  const now = Date.now();

  for (const socket of wss.clients) {
    const last = lastPongAt.get(socket) ?? 0;

    if (now - last > config.idleTimeoutMs) {
      logger.warn('Closing stale socket', {
        socketId: socketId.get(socket),
        idleMs: now - last
      });
      socket.terminate();
      continue;
    }

    if (socket.readyState === socket.OPEN) {
      socket.ping();
    }
  }
}, config.heartbeatIntervalMs);

httpServer.listen(config.port, () => {
  logger.info('Signaling server started', {
    port: config.port,
    heartbeatIntervalMs: config.heartbeatIntervalMs,
    idleTimeoutMs: config.idleTimeoutMs
  });
});

httpServer.on('error', (error) => {
  logger.error('HTTP server error', { error: String(error) });
});

let shuttingDown = false;
const shutdown = (signal: NodeJS.Signals): void => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.warn('Shutdown signal received', { signal });

  clearInterval(heartbeatTimer);
  wss.close(() => {
    httpServer.close(() => {
      logger.info('Server shutdown complete');
      process.exit(0);
    });
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
