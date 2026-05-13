import type WebSocket from 'ws';
import type { PeerInfo, PeerRole, Room } from './types';

export interface JoinResult {
  ok: boolean;
  error?: string;
  room?: Room;
  shouldNotifyPeerJoined?: boolean;
}

export interface LeaveResult {
  roomId: string;
  role: PeerRole;
  peerToNotify?: WebSocket;
}

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  private readonly peers = new Map<WebSocket, PeerInfo>();

  join(socket: WebSocket, roomId: string, role: PeerRole): JoinResult {
    const existingPeer = this.peers.get(socket);

    if (existingPeer) {
      this.leave(socket);
    }

    const room = this.rooms.get(roomId) ?? { roomId };

    if (role === 'host' && room.host) {
      return {
        ok: false,
        error: `Room ${roomId} already has a host.`
      };
    }

    if (role === 'viewer' && room.viewer) {
      return {
        ok: false,
        error: `Room ${roomId} already has a viewer.`
      };
    }

    if (role === 'host') {
      room.host = socket;
    } else {
      room.viewer = socket;
    }

    this.rooms.set(roomId, room);
    this.peers.set(socket, { roomId, role });

    return {
      ok: true,
      room,
      shouldNotifyPeerJoined: Boolean(room.host && room.viewer)
    };
  }

  getPeerInfo(socket: WebSocket): PeerInfo | undefined {
    return this.peers.get(socket);
  }

  getOtherPeer(socket: WebSocket): WebSocket | undefined {
    const peerInfo = this.peers.get(socket);

    if (!peerInfo) {
      return undefined;
    }

    const room = this.rooms.get(peerInfo.roomId);

    if (!room) {
      return undefined;
    }

    return peerInfo.role === 'host' ? room.viewer : room.host;
  }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  leave(socket: WebSocket): LeaveResult | undefined {
    const peerInfo = this.peers.get(socket);

    if (!peerInfo) {
      return undefined;
    }

    const room = this.rooms.get(peerInfo.roomId);

    this.peers.delete(socket);

    if (!room) {
      return {
        roomId: peerInfo.roomId,
        role: peerInfo.role
      };
    }

    const peerToNotify = peerInfo.role === 'host' ? room.viewer : room.host;

    if (room.host) {
      this.peers.delete(room.host);
    }

    if (room.viewer) {
      this.peers.delete(room.viewer);
    }

    this.rooms.delete(room.roomId);

    return {
      roomId: room.roomId,
      role: peerInfo.role,
      peerToNotify
    };
  }
}
