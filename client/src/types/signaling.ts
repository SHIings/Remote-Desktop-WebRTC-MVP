export type PeerRole = 'host' | 'viewer';

export interface JoinMessage {
  type: 'join';
  roomId: string;
  peerRole: PeerRole;
}

export interface OfferMessage {
  type: 'offer';
  roomId: string;
  sdp: {
    type: 'offer';
    sdp: string;
  };
}

export interface AnswerMessage {
  type: 'answer';
  roomId: string;
  sdp: {
    type: 'answer';
    sdp: string;
  };
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  roomId: string;
  candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  };
}

export interface PeerJoinedMessage {
  type: 'peer-joined';
  roomId: string;
}

export interface PeerLeftMessage {
  type: 'peer-left';
  roomId: string;
}

export interface ErrorMessage {
  type: 'error';
  code?: string;
  message: string;
  roomId?: string;
}

export type ClientSignalMessage = JoinMessage | OfferMessage | AnswerMessage | IceCandidateMessage;

export type ServerSignalMessage =
  | PeerJoinedMessage
  | PeerLeftMessage
  | ErrorMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage;
