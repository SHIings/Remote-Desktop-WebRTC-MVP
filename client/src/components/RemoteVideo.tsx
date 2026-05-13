import { useRef } from 'react';
import type { ControlEvent, ControlEventType } from '../types/control';

interface RemoteVideoProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  hasStream: boolean;
  interactive?: boolean;
  onControlEvent?: (event: ControlEvent) => void;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const RemoteVideo = ({
  videoRef,
  hasStream,
  interactive = false,
  onControlEvent
}: RemoteVideoProps): JSX.Element => {
  const lastPointerRef = useRef({ x: 0, y: 0 });

  const emitMouseEvent = (
    type: Extract<ControlEventType, 'mousemove' | 'mousedown' | 'mouseup' | 'click'>,
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    if (!interactive || !onControlEvent) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.width === 0 ? 0 : clamp01((event.clientX - rect.left) / rect.width);
    const y = rect.height === 0 ? 0 : clamp01((event.clientY - rect.top) / rect.height);

    lastPointerRef.current = { x, y };

    onControlEvent({
      type,
      x,
      y,
      button: event.button,
      timestamp: Date.now()
    });
  };

  const emitKeyboardEvent = (
    type: Extract<ControlEventType, 'keydown' | 'keyup'>,
    event: React.KeyboardEvent<HTMLDivElement>
  ): void => {
    if (!interactive || !onControlEvent) {
      return;
    }

    const { x, y } = lastPointerRef.current;

    onControlEvent({
      type,
      x,
      y,
      key: event.key,
      code: event.code,
      timestamp: Date.now()
    });
  };

  return (
    <div
      className={`remote-video ${interactive ? 'interactive' : ''}`}
      tabIndex={interactive ? 0 : -1}
      onClick={(event) => {
        event.currentTarget.focus();
        emitMouseEvent('click', event);
      }}
      onMouseMove={(event) => emitMouseEvent('mousemove', event)}
      onMouseDown={(event) => emitMouseEvent('mousedown', event)}
      onMouseUp={(event) => emitMouseEvent('mouseup', event)}
      onKeyDown={(event) => emitKeyboardEvent('keydown', event)}
      onKeyUp={(event) => emitKeyboardEvent('keyup', event)}
    >
      <video ref={videoRef} autoPlay playsInline muted={!interactive} />
      {!hasStream && <div className="video-empty">Waiting for video stream...</div>}
    </div>
  );
};

export default RemoteVideo;
