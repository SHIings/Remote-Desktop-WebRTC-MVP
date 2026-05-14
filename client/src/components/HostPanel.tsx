import { useCallback, useEffect, useRef, useState } from 'react';
import type { ControlEvent } from '../types/control';
import type { ControlPermissionStatus } from '../types/electron';
import type { PeerConnectionStateSnapshot, PeerConnectionHandlers } from '../webrtc/peerConnection';
import { createPeerConnection } from '../webrtc/peerConnection';
import { SignalingClient } from '../webrtc/signalingClient';
import { capturePrimaryScreen } from '../webrtc/screenCapture';
import { createControlChannel } from '../webrtc/controlChannel';
import { executeControlEvent } from '../input/inputController';
import RemoteVideo from './RemoteVideo';

interface HostPanelProps {
  signalingUrl: string;
  roomId: string;
  onBack: () => void;
}

const MAX_LOG_LINES = 80;
const MAX_CONTROL_EVENTS = 120;

const timestamp = (): string => new Date().toLocaleTimeString();

const HostPanel = ({ signalingUrl, roomId, onBack }: HostPanelProps): JSX.Element => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const signalingRef = useRef<SignalingClient | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const hasSentOfferRef = useRef(false);
  const peerJoinedRef = useRef(false);
  const allowRemoteControlRef = useRef(false);
  const accessWarnLoggedRef = useRef(false);
  const lastExecutionModeRef = useRef<'unknown' | 'native' | 'mock'>('unknown');

  const [connectionStatus, setConnectionStatus] = useState('Initializing...');
  const [controlChannelStatus, setControlChannelStatus] = useState('idle');
  const [allowRemoteControl, setAllowRemoteControl] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [controlLogs, setControlLogs] = useState<ControlEvent[]>([]);
  const [pcState, setPcState] = useState<PeerConnectionStateSnapshot | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<ControlPermissionStatus | null>(null);
  const [isPermissionChecking, setIsPermissionChecking] = useState(false);
  const [controlExecutionMode, setControlExecutionMode] = useState<'unknown' | 'native' | 'mock'>(
    'unknown'
  );
  const [controlExecutionReason, setControlExecutionReason] = useState<string>('');

  const pushLog = useCallback((line: string) => {
    setLogs((prev) => [`[${timestamp()}] ${line}`, ...prev].slice(0, MAX_LOG_LINES));
  }, []);

  const refreshPermissionStatus = useCallback(async () => {
    try {
      const status = await window.electronAPI.getControlPermissionStatus();
      setPermissionStatus(status);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown permission status error';
      pushLog(`Failed to read permission status: ${message}`);
    }
  }, [pushLog]);

  const requestAccessibilityPermission = useCallback(async () => {
    setIsPermissionChecking(true);

    try {
      const granted = await window.electronAPI.requestAccessibilityPermission();

      if (granted) {
        pushLog('Accessibility permission granted.');
      } else {
        pushLog('Accessibility permission is still not granted.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown permission request error';
      pushLog(`Failed to request accessibility permission: ${message}`);
    } finally {
      await refreshPermissionStatus();
      setIsPermissionChecking(false);
    }
  }, [pushLog, refreshPermissionStatus]);

  const openPermissionSettings = useCallback(async () => {
    try {
      await window.electronAPI.openControlPermissionSettings();
      pushLog('Opened macOS Accessibility settings.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown settings open error';
      pushLog(`Failed to open settings: ${message}`);
    }
  }, [pushLog]);

  const stopLocalStream = useCallback(() => {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
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

    hasSentOfferRef.current = false;
    setControlChannelStatus('idle');
    setPcState(null);
  }, []);

  const addControlLogs = useCallback((event: ControlEvent) => {
    setControlLogs((prev) => [event, ...prev].slice(0, MAX_CONTROL_EVENTS));
  }, []);

  const handleControlEvent = useCallback(
    (event: ControlEvent) => {
      addControlLogs(event);

      if (!allowRemoteControlRef.current) {
        console.log('control event received (allow disabled)', event);
        return;
      }

      void executeControlEvent(event).then((result) => {
        setControlExecutionMode(result.mode);
        setControlExecutionReason(result.reason ?? '');

        if (lastExecutionModeRef.current !== result.mode) {
          lastExecutionModeRef.current = result.mode;
          pushLog(
            result.mode === 'native'
              ? 'Control execution mode: real (nut.js).'
              : `Control execution mode: mock (${result.reason ?? 'unknown reason'}).`
          );
        }

        if (
          result.mode === 'mock' &&
          result.reason?.includes('Accessibility') &&
          !accessWarnLoggedRef.current
        ) {
          accessWarnLoggedRef.current = true;
          pushLog('Real control blocked: grant macOS Accessibility permission in Host window.');
          void refreshPermissionStatus();
        }
      });
    },
    [addControlLogs, pushLog, refreshPermissionStatus]
  );

  const attachStreamTracks = useCallback((pc: RTCPeerConnection, stream: MediaStream) => {
    const existingTrackIds = new Set(
      pc
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((id): id is string => Boolean(id))
    );

    stream.getTracks().forEach((track) => {
      if (existingTrackIds.has(track.id)) {
        return;
      }

      pc.addTrack(track, stream);
    });
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
      onStateChange: (state) => {
        setPcState(state);
      }
    };

    const pc = createPeerConnection(handlers);

    const channel = createControlChannel(pc, {
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
      },
      onEvent: handleControlEvent
    });

    setControlChannelStatus('connecting');
    controlChannelRef.current = channel;
    pcRef.current = pc;

    if (localStreamRef.current) {
      attachStreamTracks(pc, localStreamRef.current);
    }

    return pc;
  }, [attachStreamTracks, handleControlEvent, pushLog, roomId]);

  const trySendOffer = useCallback(async () => {
    if (hasSentOfferRef.current || !peerJoinedRef.current || !localStreamRef.current) {
      return;
    }

    const pc = ensurePeerConnection();
    const signaling = signalingRef.current;

    if (!signaling) {
      return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    if (!offer.sdp) {
      throw new Error('Failed to generate offer SDP.');
    }

    const sent = signaling.sendOffer(roomId, {
      type: 'offer',
      sdp: offer.sdp
    });

    if (!sent) {
      throw new Error('Signaling channel is not ready.');
    }

    hasSentOfferRef.current = true;
    pushLog('Offer sent to viewer.');
  }, [ensurePeerConnection, pushLog, roomId]);

  const startScreenShare = useCallback(async () => {
    try {
      const { stream, source } = await capturePrimaryScreen();
      localStreamRef.current = stream;
      setLocalStream(stream);
      pushLog(`Screen capture started from source: ${source.name}.`);

      const pc = ensurePeerConnection();
      attachStreamTracks(pc, stream);

      await trySendOffer();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown screen capture error.';
      pushLog(`Failed to start screen share: ${message}`);
    }
  }, [attachStreamTracks, ensurePeerConnection, pushLog, trySendOffer]);

  useEffect(() => {
    allowRemoteControlRef.current = allowRemoteControl;
  }, [allowRemoteControl]);

  useEffect(() => {
    void refreshPermissionStatus();
  }, [refreshPermissionStatus]);

  useEffect(() => {
    if (!allowRemoteControl) {
      return;
    }

    if (permissionStatus?.accessibilityTrusted) {
      return;
    }

    void requestAccessibilityPermission();
  }, [allowRemoteControl, permissionStatus?.accessibilityTrusted, requestAccessibilityPermission]);

  useEffect(() => {
    if (!localVideoRef.current) {
      return;
    }

    localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    if (permissionStatus?.accessibilityTrusted) {
      accessWarnLoggedRef.current = false;
    }
  }, [permissionStatus?.accessibilityTrusted]);

  useEffect(() => {
    const signaling = new SignalingClient(signalingUrl, {
      onOpen: () => {
        setConnectionStatus('Signaling connected');
        pushLog('Connected to signaling server.');
        signaling.joinRoom(roomId, 'host');
        pushLog(`Joined room "${roomId}" as host.`);
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
          peerJoinedRef.current = true;
          setConnectionStatus('Viewer joined');
          pushLog('Viewer joined the room.');

          void trySendOffer();
          return;
        }

        if (message.type === 'answer') {
          const pc = pcRef.current;

          if (!pc) {
            pushLog('Received answer but peer connection is not ready.');
            return;
          }

          void pc.setRemoteDescription(message.sdp).then(() => {
            pushLog('Remote answer applied.');
          });

          return;
        }

        if (message.type === 'ice-candidate') {
          const pc = pcRef.current;

          if (!pc) {
            return;
          }

          void pc.addIceCandidate(message.candidate).catch((error) => {
            pushLog(`Failed to add ICE candidate: ${String(error)}`);
          });

          return;
        }

        if (message.type === 'peer-left') {
          peerJoinedRef.current = false;
          setConnectionStatus('Viewer left');
          pushLog('Viewer left the room.');
          cleanupPeerConnection();
          return;
        }

        if (message.type === 'error') {
          setConnectionStatus(`Signaling error: ${message.message}`);
          pushLog(
            `Server error${message.code ? ` [${message.code}]` : ''}: ${message.message}`
          );
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
      stopLocalStream();
    };
  }, [cleanupPeerConnection, pushLog, roomId, signalingUrl, stopLocalStream, trySendOffer]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>Host Mode</h2>
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
            <strong>SignalingState:</strong> {pcState?.signalingState ?? '-'}
          </p>
          <p>
            <strong>ICE State:</strong> {pcState?.iceConnectionState ?? '-'}
          </p>
          <p>
            <strong>Connection State:</strong> {pcState?.connectionState ?? '-'}
          </p>
          <p>
            <strong>Control Mode:</strong>{' '}
            {controlExecutionMode === 'native'
              ? 'real'
              : controlExecutionMode === 'mock'
                ? `mock${controlExecutionReason ? ` (${controlExecutionReason})` : ''}`
                : '-'}
          </p>
        </div>

        <div className="controls">
          <button type="button" onClick={() => void startScreenShare()}>
            Start Screen Share
          </button>

          <label className="toggle-row">
            <input
              type="checkbox"
              checked={allowRemoteControl}
              onChange={(event) => setAllowRemoteControl(event.target.checked)}
            />
            <span>Allow Remote Control</span>
          </label>

          <div className={`permission-card ${permissionStatus?.accessibilityTrusted ? 'ok' : 'warn'}`}>
            <p>
              <strong>Accessibility:</strong>{' '}
              {isPermissionChecking
                ? 'Checking...'
                : permissionStatus?.accessibilityTrusted
                  ? 'Granted'
                  : 'Not granted'}
            </p>
            <p>
              <strong>Screen Recording:</strong> {permissionStatus?.screenRecordingStatus ?? 'unknown'}
            </p>
            <div className="permission-actions">
              <button type="button" className="secondary" onClick={() => void requestAccessibilityPermission()}>
                Request Permission
              </button>
              <button type="button" className="secondary" onClick={() => void openPermissionSettings()}>
                Open Settings
              </button>
              <button type="button" className="secondary" onClick={() => void refreshPermissionStatus()}>
                Refresh Status
              </button>
            </div>
          </div>
        </div>
      </div>

      <RemoteVideo videoRef={localVideoRef} hasStream={Boolean(localStream)} />

      <div className="logs-area">
        <div>
          <h3>Control Event Logs</h3>
          <ul>
            {controlLogs.map((event, index) => (
              <li key={`${event.timestamp}-${event.type}-${index}`}>
                {new Date(event.timestamp).toLocaleTimeString()} | {event.type} | x:{' '}
                {event.x.toFixed(3)} y: {event.y.toFixed(3)} {event.key ? `key:${event.key}` : ''}
              </li>
            ))}
          </ul>
        </div>

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

export default HostPanel;
