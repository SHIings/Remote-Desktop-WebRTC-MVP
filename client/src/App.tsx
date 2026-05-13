import { useState } from 'react';
import type { PeerRole } from './types/signaling';
import ModeSelector from './components/ModeSelector';
import HostPanel from './components/HostPanel';
import ViewerPanel from './components/ViewerPanel';

type AppMode = PeerRole | null;

const searchParams = new URLSearchParams(window.location.search);
const modeParam = searchParams.get('mode');
const windowLabel = searchParams.get('label')?.trim() ?? '';
const initialMode: AppMode = modeParam === 'host' || modeParam === 'viewer' ? modeParam : null;

const App = (): JSX.Element => {
  const [mode, setMode] = useState<AppMode>(initialMode);
  const [sessionId, setSessionId] = useState(0);
  const [signalingUrl, setSignalingUrl] = useState('ws://localhost:8080');
  const [roomId, setRoomId] = useState('demo-room');

  const startMode = (nextMode: PeerRole): void => {
    setSessionId((prev) => prev + 1);
    setMode(nextMode);
  };

  const goBack = (): void => {
    setSessionId((prev) => prev + 1);
    setMode(null);
  };

  return (
    <main className="app-shell">
      {windowLabel && (
        <div className={`window-badge ${mode === 'host' ? 'host' : mode === 'viewer' ? 'viewer' : ''}`}>
          This Window: {windowLabel}
        </div>
      )}

      {!mode && (
        <ModeSelector
          signalingUrl={signalingUrl}
          roomId={roomId}
          onSignalingUrlChange={setSignalingUrl}
          onRoomIdChange={setRoomId}
          onStart={startMode}
        />
      )}

      {mode === 'host' && (
        <HostPanel
          key={`host-${sessionId}`}
          signalingUrl={signalingUrl}
          roomId={roomId}
          onBack={goBack}
        />
      )}

      {mode === 'viewer' && (
        <ViewerPanel
          key={`viewer-${sessionId}`}
          signalingUrl={signalingUrl}
          roomId={roomId}
          onBack={goBack}
        />
      )}
    </main>
  );
};

export default App;
