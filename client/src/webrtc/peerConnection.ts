export interface PeerConnectionStateSnapshot {
  signalingState: RTCSignalingState;
  iceConnectionState: RTCIceConnectionState;
  connectionState: RTCPeerConnectionState;
}

export interface PeerConnectionHandlers {
  onIceCandidate?: (candidate: {
    candidate: string;
    sdpMid?: string | null;
    sdpMLineIndex?: number | null;
    usernameFragment?: string | null;
  }) => void;
  onTrack?: (stream: MediaStream) => void;
  onDataChannel?: (channel: RTCDataChannel) => void;
  onStateChange?: (state: PeerConnectionStateSnapshot) => void;
}

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export const createPeerConnection = (handlers: PeerConnectionHandlers = {}): RTCPeerConnection => {
  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  const emitState = (): void => {
    handlers.onStateChange?.({
      signalingState: pc.signalingState,
      iceConnectionState: pc.iceConnectionState,
      connectionState: pc.connectionState
    });
  };

  pc.onicecandidate = (event) => {
    if (!event.candidate) {
      return;
    }

    if (!event.candidate.candidate) {
      return;
    }

    handlers.onIceCandidate?.({
      candidate: event.candidate.candidate,
      sdpMid: event.candidate.sdpMid,
      sdpMLineIndex: event.candidate.sdpMLineIndex,
      usernameFragment: event.candidate.usernameFragment
    });
  };

  pc.ontrack = (event) => {
    const [stream] = event.streams;

    if (!stream) {
      return;
    }

    handlers.onTrack?.(stream);
  };

  pc.ondatachannel = (event) => {
    handlers.onDataChannel?.(event.channel);
  };

  pc.onsignalingstatechange = emitState;
  pc.oniceconnectionstatechange = emitState;
  pc.onconnectionstatechange = emitState;

  emitState();

  return pc;
};
