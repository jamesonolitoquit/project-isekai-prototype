/**
 * ALPHA_M8 Phase 1 & 2: AudioVisualizer Component
 * 
 * Enhanced audio visualizer that displays real-time audio state information
 * from the deterministic audio engine. Integrates with useAudioSynchronization
 * to synchronize with Web Audio API.
 * 
 * Features (M8 Phase 2):
 * - Volume smoothing: All volume bars animate with ease-out transitions (150ms)
 * - BGM track display with sample loading status
 * - Real-time ambient layer monitoring
 * - Tension visualization with color coding
 * - Heartbeat pulse indicator
 * - Dynamic low-pass filter monitoring
 * - Ducking status with countdown
 * - Zero audible "pops": smooth transitions prevent harsh audio artifacts
 * 
 * Features (ALPHA_Audit Hardening):
 * - Audio context suspension detection and recovery button
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { AudioState } from '../../engine/audioEngine';
import { useAudioSynchronization } from '../hooks/useAudioSynchronization';
import { ensureAudioStarted } from '../services/AudioService';

interface AudioVisualizerProps {
  state?: any;  // Full WorldState
  audioState?: AudioState;  // Or explicit AudioState prop
}

export default function AudioVisualizer({ state, audioState: explicitAudioState }: AudioVisualizerProps) {
  // Get audio state from either explicit prop or state.audio
  const audioState = explicitAudioState || state?.audio;

  // Initialize and synchronize Web Audio API
  const { isInitialized, topology } = useAudioSynchronization(audioState, {
    enabled: true,
    debug: false
  });

  // Track audio context state for suspension detection
  const [audioContextState, setAudioContextState] = useState<AudioContextState | null>(null);
  const [isResuming, setIsResuming] = useState(false);

  // Monitor audio context state
  useEffect(() => {
    if (topology?.context) {
      setAudioContextState(topology.context.state);
      
      // Set up interval to check context state periodically
      const checkInterval = setInterval(() => {
        setAudioContextState(topology.context.state);
      }, 500);
      
      return () => clearInterval(checkInterval);
    }
  }, [topology]);

  // Handle audio resume button click
  const handleResumeAudio = async () => {
    if (!topology) return;
    
    setIsResuming(true);
    try {
      const success = await ensureAudioStarted(topology);
      if (success) {
        setAudioContextState(topology.context.state);
      }
    } finally {
      setIsResuming(false);
    }
  };

  // Fallback for missing audio state
  if (!audioState) {
    return (
      <div className="audio-visualizer" style={{ opacity: 0.5 }}>
        <h3>Audio</h3>
        <p style={{ fontSize: '12px', color: '#999' }}>Audio engine not initialized</p>
      </div>
    );
  }

  // Format layer names for display
  const layerDisplay = audioState.layers.length > 0 
    ? audioState.layers.join(', ')
    : '(ambient)';

  // Get tension stage label
  const getTensionStage = (tension: number): string => {
    if (tension < 30) return 'Low';
    if (tension < 60) return 'Moderate';
    if (tension < 80) return 'High';
    return 'Critical';
  };

  // Get color based on tension
  const getTensionColor = (tension: number): string => {
    if (tension < 30) return '#4CAF50';       // Green
    if (tension < 60) return '#FFC107';       // Amber
    if (tension < 80) return '#FF9800';       // Orange
    return '#F44336';                         // Red
  };

  // Normalize heartbeat display (convert BPM to visual representation)
  const heartbeatIntensity = Math.min(100, (audioState.heartbeatBpm - 60) * 0.625); // 60bpm -> 0%, 160bpm -> 62.5%

  const containerStyle: React.CSSProperties = {
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#ccc'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #333'
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: '4px'
  };

  const barStyle: React.CSSProperties = {
    height: '16px',
    backgroundColor: '#333',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '4px'
  };

  const fillStyle = (value: number, color: string): React.CSSProperties => ({
    height: '100%',
    width: `${Math.max(0, Math.min(100, value * 100))}%`,
    backgroundColor: color,
    transition: 'width 0.15s ease-out'
  });

  return (
    <div className="audio-visualizer" style={containerStyle}>
      <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', textTransform: 'uppercase' }}>
        🎵 Audio Engine {isInitialized ? '✓' : '○'}
      </h3>

      {/* Audio Suspension Alert & Recovery Button (ALPHA_Audit Hardening) */}
      {audioContextState === 'suspended' && (
        <div style={{
          ...sectionStyle,
          backgroundColor: '#4a2a2a',
          border: '2px solid #F44336',
          borderRadius: '4px',
          padding: '8px'
        }}>
          <div style={{ fontSize: '12px', color: '#FF6B6B', fontWeight: 'bold', marginBottom: '8px' }}>
            🔇 Audio Paused (Click to Unmute)
          </div>
          <button
            onClick={handleResumeAudio}
            disabled={isResuming}
            style={{
              width: '100%',
              padding: '8px 12px',
              backgroundColor: '#F44336',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: isResuming ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              fontSize: '12px',
              opacity: isResuming ? 0.6 : 1.0,
              transition: 'all 0.2s ease-out'
            }}
          >
            {isResuming ? '⏳ Resuming...' : '▶️ Unmute Audio'}
          </button>
        </div>
      )}

      {/* BGM Track */}
      <div style={sectionStyle}>
        <div style={labelStyle}>BGM: {audioState.bgm}</div>
        <div style={{...labelStyle, fontSize: '11px', fontWeight: 'normal'}}>
          Master Volume: {Math.round(audioState.masterVolume * 100)}%
        </div>
        <div style={barStyle}>
          <div style={fillStyle(audioState.masterVolume, '#4CAF50')} />
        </div>
      </div>

      {/* Ambient Layers */}
      <div style={sectionStyle}>
        <div style={labelStyle}>Layers: {layerDisplay}</div>
        <div style={{fontSize: '11px', color: '#999'}}>
          {audioState.layers.length === 0 ? 'No active ambient layers' : `${audioState.layers.length} active`}
        </div>
      </div>

      {/* Tension & Effects */}
      <div style={sectionStyle}>
        <div style={labelStyle}>
          Tension: {getTensionStage(audioState.tensionHum * 100)} ({Math.round(audioState.tensionHum * 100)}%)
        </div>
        <div style={barStyle}>
          <div style={fillStyle(audioState.tensionHum, getTensionColor(audioState.tensionHum * 100))} />
        </div>

        {/* Heartbeat */}
        <div style={{marginTop: '8px', fontSize: '11px', color: '#aaa'}}>
          Heartbeat: {audioState.heartbeatBpm > 0 ? `${audioState.heartbeatBpm} bpm` : 'silent'}
        </div>
        {audioState.heartbeatBpm > 0 && (
          <div style={barStyle}>
            <div style={fillStyle(heartbeatIntensity / 100, '#E91E63')} />
          </div>
        )}

        {/* Low-Pass Filter */}
        <div style={{marginTop: '8px', fontSize: '11px', color: '#aaa'}}>
          Filter: {Math.round(audioState.lowPassCutoff)} Hz
        </div>
        <div style={barStyle}>
          <div style={fillStyle((audioState.lowPassCutoff - 8000) / 10000, '#2196F3')} />
        </div>
      </div>

      {/* Ducking Status */}
      {audioState.duckingEnabled && (
        <div style={sectionStyle}>
          <div style={labelStyle}>
            Ducking: {Math.round(audioState.duckingAmount * 100)}%
          </div>
          <div style={barStyle}>
            <div style={fillStyle(audioState.duckingAmount, '#FF6B6B')} />
          </div>
          <div style={{fontSize: '11px', color: '#999', marginTop: '4px'}}>
            Duration: {audioState.mutationOverrides?.duckingDuration ?? 'N/A'} frames
          </div>
        </div>
      )}

      {/* Debug Info */}
      <div style={{fontSize: '10px', color: '#666', marginTop: '8px', padding: '4px', backgroundColor: '#222', borderRadius: '2px'}}>
        Tick: {audioState.tick} | Mutations: {audioState.lastMutationTick}
      </div>
    </div>
  );
}
