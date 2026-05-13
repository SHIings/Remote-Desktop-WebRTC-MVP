import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlEvent } from '../types/control';
import type { PeerConnectionHandlers, PeerConnectionStateSnapshot } from '../webrtc/peerConnection';
import { createPeerConnection } from '../webrtc/peerConnection';
import { SignalingClient } from '../webrtc/signalingClient';
import { bindControlChannel, CONTROL_CHANNEL_LABEL, sendControlEvent } from '../webrtc/controlChannel';
import RemoteVideo from './RemoteVideo';

interface ViewerPanelProps {
  signalingUrl: string;
  roomId: string;
  onBack: () => void;
}

const MAX_LOG_LINES = 80;

const timestamp = (): string => new Date().toLocaleTimeString();

const ViewerPanel = ({ signalingUrl, roomId, onBack }: ViewerPanelProps): JSX.Element => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);

  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [controlChannelStatus, setControlChannelStatus] = useState('waiting');
  const [controlSendStatus, setControlSendStatus] = useState('idle');
  const [sentEventCount, setSentEventCount] = useState(0);
  const [controlEnabled, setControlEnabled] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [pcState, setPcState] = useState<PeerConnectionStateSnapshot | null>(null);

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => [`[${timestamp()}] ${line}`, ...prev].slice(0, MAX_LOG_LINES));
  }, []);

  const cleanupPeerConnection = useCallback(() => {
    if (controlChannelRef.current) {
      controlChannelRef.current.close();
      controlChannelRef.current = null;
    }

    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }

    setRemoteStream(null);
    setControlChannelStatus('waiting');
    setPcState(null);
  }, []);

  const ensurePeerConnection = useCallback((): RTCPeerConnection => {
    if (pcRef.current) {
      return pcRef.current;
    }

    const handlers: PeerConnectionHandlers = {
      onIceCandidate: (candidate) => {
        if (!signalingRef.current) {
          return;
        }

        signalingRef.current.sendIceCandidate(roomId, candidate);
      },
      onTrack: (stream) => {
        setRemoteStream(stream);
        pushLog('Received remote video stream.');
      },
      onStateChange: (state) => {
        setPcState(state);
      },
      onDataChannel: (channel) => {
        if (channel.label !== CONTROL_CHANNEL_LABEL) {
          return;
        }

        controlChannelRef.current = channel;

        bindControlChannel(channel, {
          onOpen: () => {
            setControlChannelStatus('open');
            pushLog('Control channel open.');
          },
          onClose: () => {
            setControlChannelStatus('closed');
            pushLog('Control channel closed.');
          },
          onError: () => {
            pushLog('Control channel error.');
          }
        });
      }
    };

    const pc = createPeerConnection(handlers);
    pcRef.current = pc;
    return pc;
  }, [pushLog, roomId]);

  const handleControlEvent = useCallback((event: ControlEvent) => {
    if (!controlEnabled) {
      return;
    }

    const ok = sendControlEvent(controlChannelRef.current, event);

    if (!ok) {
      setControlSendStatus('failed: channel not open');
      return;
    }

    setSentEventCount((prev) => prev + 1);
    setControlSendStatus(`sent ${event.type} @ ${new Date(event.timestamp).toLocaleTimeString()}`);
  }, [controlEnabled]);

  useEffect(() => {
    if (!remoteVideoRef.current) {
      return;
    }

    remoteVideoRef.current.srcObject = remoteStream;
  }, [remoteStream]);

  useEffect(() => {
    const signaling = new SignalingClient(signalingUrl, {
      onOpen: () => {
        setConnectionStatus('Signaling connected');
        pushLog('Connected to signaling server.');
        signaling.joinRoom(roomId, 'viewer');
        pushLog(`Joined room "${roomId}" as viewer.`);
      },
      onClose: () => {
        setConnectionStatus('Signaling disconnected');
        pushLog('Signaling connection closed.');
      },
      onError: () => {
        setConnectionStatus('Signaling error');
        pushLog('Signaling connection error.');
      },
      onMessage: (message) => {
        if (message.type === 'peer-joined') {
          setConnectionStatus('Host joined');
          pushLog('Host joined the room.');
          return;
        }

        if (message.type === 'offer') {
          const pc = ensurePeerConnection();

          void pc
            .setRemoteDescription(message.sdp)
            .then(async () => {
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);

              if (!answer.sdp) {
                throw new Error('Failed to generate answer SDP.');
              }

              const sent = signaling.sendAnswer(roomId, {
                type: 'answer',
                sdp: answer.sdp
              });

              if (!sent) {
                throw new Error('Signaling channel is not ready.');
              }

              pushLog('Answer sent to host.');
            })
            .catch((error) => {
              pushLog(`Failed to handle offer: ${String(error)}`);
            });

          return;
        }

        if (message.type === 'ice-candidate') {
          const pc = ensurePeerConnection();

          void pc.addIceCandidate(message.candidate).catch((error) => {
            pushLog(`Failed to add ICE candidate: ${String(error)}`);
          });

          return;
        }

        if (message.type === 'peer-left') {
          setConnectionStatus('Host left');
          pushLog('Host left the room.');
          cleanupPeerConnection();
          return;
        }

        if (message.type === 'error') {
          setConnectionStatus(`Signaling error: ${message.message}`);
          pushLog(`Server error: ${message.message}`);
          return;
        }
      }
    });

    signalingRef.current = signaling;
    setConnectionStatus('Connecting to signaling server...');
    void signaling.connect();

    return () => {
      signaling.close();
      signalingRef.current = null;
      cleanupPeerConnection();
    };
  }, [cleanupPeerConnection, ensurePeerConnection, pushLog, roomId, signalingUrl]);

  useEffect(() => {
    const onWindowKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape' || !controlEnabled) {
        return;
      }

      setControlEnabled(false);
      setControlSendStatus('stopped by ESC');
      pushLog('Emergency stop: viewer control disabled by ESC.');
    };

    window.addEventListener('keydown', onWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', onWindowKeyDown);
    };
  }, [controlEnabled, pushLog]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Viewer Mode</h2>
        <button type="button" className="secondary" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="grid-two">
        <div className="status-block">
          <p>
            <strong>Signaling:</strong> {connectionStatus}
          </p>
          <p>
            <strong>DataChannel:</strong> {controlChannelStatus}
          </p>
          <p>
            <strong>Control Send:</strong> {controlSendStatus}
          </p>
          <p>
            <strong>Viewer Control:</strong> {controlEnabled ? 'enabled' : 'disabled'}
          </p>
          <p>
            <strong>Events Sent:</strong> {sentEventCount}
          </p>
          <p>
            <strong>SignalingState:</strong> {pcState?.signalingState ?? '-'}
          </p>
          <p>
            <strong>ICE State:</strong> {pcState?.iceConnectionState ?? '-'}
          </p>
          <p>
            <strong>Connection State:</strong> {pcState?.connectionState ?? '-'}
          </p>
        </div>

        <div className="status-note">
          <p>
            Enable control first, then click the remote video area and start mouse/keyboard actions.
            Press ESC anytime to emergency stop control sending.
          </p>
          <div className="permission-actions">
            <button
              type="button"
              onClick={() => {
                setControlEnabled((prev) => {
                  const next = !prev;
                  setControlSendStatus(next ? 'ready to send' : 'manually disabled');
                  pushLog(next ? 'Viewer control enabled.' : 'Viewer control disabled.');
                  return next;
                });
              }}
            >
              {controlEnabled ? 'Disable Remote Control' : 'Enable Remote Control'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setControlEnabled(false);
                setControlSendStatus('stopped by button');
                pushLog('Emergency stop: viewer control disabled by button.');
              }}
            >
              ESC Stop (Button)
            </button>
          </div>
        </div>
      </div>

      <RemoteVideo
        videoRef={remoteVideoRef}
        hasStream={Boolean(remoteStream)}
        interactive={controlEnabled}
        onControlEvent={handleControlEvent}
      />

      <div className="logs-area single">
        <div>
          <h3>Connection Logs</h3>
          <ul>
            {logs.map((line, index) => (
              <li key={`${line}-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};

export default ViewerPanel;
