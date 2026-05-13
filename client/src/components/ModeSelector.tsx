import type { PeerRole } from '../types/signaling';

interface ModeSelectorProps {
  signalingUrl: string;
  roomId: string;
  onSignalingUrlChange: (value: string) => void;
  onRoomIdChange: (value: string) => void;
  onStart: (mode: PeerRole) => void;
}

const ModeSelector = ({
  signalingUrl,
  roomId,
  onSignalingUrlChange,
  onRoomIdChange,
  onStart
}: ModeSelectorProps): JSX.Element => {
  return (
    <section className="panel mode-selector">
      <h1>Remote Desktop Control MVP</h1>
      <p>Electron + WebRTC + RTCDataChannel</p>

      <label className="field">
        <span>Signaling Server URL</span>
        <input
          value={signalingUrl}
          onChange={(event) => onSignalingUrlChange(event.target.value)}
          placeholder="ws://localhost:8080"
        />
      </label>

      <label className="field">
        <span>Room ID</span>
        <input
          value={roomId}
          onChange={(event) => onRoomIdChange(event.target.value)}
          placeholder="demo-room"
        />
      </label>

      <div className="actions">
        <button type="button" onClick={() => onStart('host')}>
          Start as Host
        </button>
        <button type="button" className="secondary" onClick={() => onStart('viewer')}>
          Start as Viewer
        </button>
      </div>
    </section>
  );
};

export default ModeSelector;
