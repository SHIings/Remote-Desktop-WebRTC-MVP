import type { ScreenSource } from '../types/electron';

export interface ScreenCaptureResult {
  stream: MediaStream;
  source: ScreenSource;
}

const buildElectronDesktopConstraints = (sourceId: string): MediaStreamConstraints => {
  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: sourceId,
        maxWidth: 3840,
        maxHeight: 2160,
        maxFrameRate: 30
      }
    }
  };

  return constraints as unknown as MediaStreamConstraints;
};

export const capturePrimaryScreen = async (): Promise<ScreenCaptureResult> => {
  const sources = await window.electronAPI.getScreenSources();

  if (sources.length === 0) {
    throw new Error('No screen sources found.');
  }

  const primarySource = sources[0];

  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      buildElectronDesktopConstraints(primarySource.id)
    );

    return {
      stream,
      source: primarySource
    };
  } catch {
    // Fallback for environments where custom desktop constraints are unavailable.
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    return {
      stream,
      source: primarySource
    };
  }
};
