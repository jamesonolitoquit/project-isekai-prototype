import React from 'react';

interface AudioVisualizerProps {
  state?: any;
}

export default function AudioVisualizer({ state }: AudioVisualizerProps) {
  const metadata = state?.metadata ?? {};
  const volume = metadata.audioVolume ?? 0.8;

  return (
    <div className="audio-visualizer">
      <h3>Audio</h3>
      <p>Volume: {Math.round(volume * 100)}%</p>
      <div style={{ height: '20px', backgroundColor: '#ddd', borderRadius: '4px', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${volume * 100}%`,
            backgroundColor: '#4CAF50',
            transition: 'width 0.2s'
          }}
        />
      </div>
    </div>
  );
}
