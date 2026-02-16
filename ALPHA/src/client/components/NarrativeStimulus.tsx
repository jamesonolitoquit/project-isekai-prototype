import React, { useState, useEffect } from 'react';
import type { AudioState } from '../../engine/audioEngine';
import { useAudioSynchronization } from '../hooks/useAudioSynchronization';
import { NarrativeSpeechService } from '../services/NarrativeSpeechService';

interface Stimulus {
  id: string;
  type: 'RELIC_WHISPER' | 'TEMPORAL_ANOMALY' | 'NARRATIVE_STIMULUS' | 'CORRUPTION_FLARE' | 'WORLD_EVENT' | 'FACTION_EVENT' | 'AMBIENT_WHISPER';
  message: string;
  relicName?: string;
  factionName?: string;
  createdAt: number;
  displayDuration?: number; // M7: Custom duration for ambient whispers
}

interface NarrativeStimulusProps {
  readonly events?: readonly any[];
  readonly maxVisible?: number;
  readonly displayDuration?: number;
  readonly audioState?: AudioState;  // M8 Phase 3: For narration coordination
}

/**
 * ALPHA_M2: Narrative Stimulus Toast Display
 * Displays floating notifications for Director events (whispers, anomalies, corruption flares)
 * M7: Added support for AMBIENT_WHISPER events (atmospheric sensory feedback)
 * M8 Phase 3: Integrates text-to-speech narration with audio ducking
 * Events fade out after a configurable duration
 */
export default function NarrativeStimulus({ 
  events = [], 
  maxVisible = 3,
  displayDuration = 5000,
  audioState
}: NarrativeStimulusProps) {
  const [stimuli, setStimuli] = useState<Stimulus[]>([]);
  
  // M8 Phase 3: Initialize Web Audio API and get topology for narration coordination
  const { topology } = useAudioSynchronization(audioState || null, {
    enabled: !!audioState,
    debug: false,
    autoSuspend: true
  });

  useEffect(() => {
    // Filter only SYSTEM events that are narrative-related or world-shifting
    const narrativeEvents = (events as any[]).filter((e: any) => 
      e.mutationClass === 'SYSTEM' && 
      ['RELIC_WHISPER', 'TEMPORAL_ANOMALY', 'NARRATIVE_STIMULUS', 'CORRUPTION_FLARE', 'RELIC_REBELLION', 'WORLD_EVENT', 'FACTION_CONFLICT_STARTED', 'FACTION_CONFLICT_RESOLVED', 'FACTION_POWER_SHIFT', 'AMBIENT_WHISPER'].includes(e.type)
    );

    if (narrativeEvents.length === 0) return;

    // Get the most recent event that hasn't been added yet
    const latestEvent = narrativeEvents.at(-1);
    const eventId = `${latestEvent.type}-${latestEvent.timestamp}`;

    // Check if this event is already displayed
    const alreadyShown = stimuli.some(s => s.id === eventId);
    if (alreadyShown) return;

    // Create new stimulus
    let stimulus: Stimulus | null = null;
    
    switch (latestEvent.type) {
      case 'RELIC_WHISPER':
        stimulus = {
          id: eventId,
          type: 'RELIC_WHISPER',
          message: latestEvent.payload.dialogue || 'The relic stirs...',
          relicName: latestEvent.payload.relicName,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'TEMPORAL_ANOMALY':
        stimulus = {
          id: eventId,
          type: 'TEMPORAL_ANOMALY',
          message: latestEvent.payload.message || 'Reality fractures...',
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'NARRATIVE_STIMULUS':
        stimulus = {
          id: eventId,
          type: 'NARRATIVE_STIMULUS',
          message: latestEvent.payload.message || 'The world stirs...',
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'CORRUPTION_FLARE':
        stimulus = {
          id: eventId,
          type: 'CORRUPTION_FLARE',
          message: latestEvent.payload.message || 'Corruption erupts!',
          relicName: latestEvent.payload.relicName,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'RELIC_REBELLION':
        stimulus = {
          id: eventId,
          type: 'TEMPORAL_ANOMALY',
          message: latestEvent.payload.message || 'A relic rebels!',
          relicName: latestEvent.payload.relicName,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'WORLD_EVENT':
        stimulus = {
          id: eventId,
          type: 'WORLD_EVENT',
          message: `🌍 BREAKING NEWS: ${latestEvent.payload.message}`,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'FACTION_CONFLICT_STARTED':
        stimulus = {
          id: eventId,
          type: 'FACTION_EVENT',
          message: `⚔️ WAR DECLARED: ${latestEvent.payload.factionA} vs ${latestEvent.payload.factionB}!`,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'FACTION_CONFLICT_RESOLVED':
        stimulus = {
          id: eventId,
          type: 'FACTION_EVENT',
          message: `✓ ${latestEvent.payload.winner} defeats ${latestEvent.payload.loser}`,
          createdAt: Date.now(),
          displayDuration
        };
        break;
      case 'FACTION_POWER_SHIFT': {
        if (latestEvent.payload.delta > 0) {
          stimulus = {
            id: eventId,
            type: 'FACTION_EVENT',
            message: `📈 ${latestEvent.payload.factionName} gains influence (+${latestEvent.payload.delta})`,
            factionName: latestEvent.payload.factionName,
            createdAt: Date.now(),
            displayDuration
          };
        }
        break;
      }
      case 'AMBIENT_WHISPER':
        // M7: Ambient whispers from Director when narrativeTension > 70
        // M8 Phase 3: Also trigger text-to-speech narration
        stimulus = {
          id: eventId,
          type: 'AMBIENT_WHISPER',
          message: latestEvent.payload.sensoryText || 'The air stirs...',
          createdAt: Date.now(),
          displayDuration: 2500 // Faster fade for ambient whispers
        };
        
        // M8 Phase 3: Trigger narration with ducking coordination
        if (topology && stimulus.message) {
          const tension = latestEvent.payload.tension || 75; // Default high tension for whispers
          NarrativeSpeechService.speak(
            stimulus.message,
            tension,
            2500,  // Expected duration (2.5 seconds)
            topology  // Pass topology for ducking coordination
          ).catch(err => {
            console.warn('[NarrativeStimulus] Error speaking ambient whisper:', err);
          });
        }
        break;
    }

    if (stimulus) {
      setStimuli(prev => {
        const newStimuli = [stimulus, ...prev].slice(0, maxVisible);
        return newStimuli;
      });

      // Auto-remove after displayDuration
      const timer = setTimeout(() => {
        setStimuli(prev => prev.filter(s => s.id !== stimulus!.id));
      }, stimulus.displayDuration || displayDuration);

      return () => clearTimeout(timer);
    }
  }, [events, maxVisible, displayDuration]);

  if (stimuli.length === 0) return null;

  // Separate ambient whispers from main stimuli
  const ambientWhispers = stimuli.filter(s => s.type === 'AMBIENT_WHISPER');
  const mainStimuli = stimuli.filter(s => s.type !== 'AMBIENT_WHISPER');

  const getStyleForType = (type: Stimulus['type']) => {
    switch (type) {
      case 'RELIC_WHISPER':
        return {
          bgColor: 'rgba(147, 112, 219, 0.15)',
          borderColor: '#9370db',
          textColor: '#d8b4fe',
          icon: '✨'
        };
      case 'TEMPORAL_ANOMALY':
        return {
          bgColor: 'rgba(236, 72, 153, 0.15)',
          borderColor: '#ec4899',
          textColor: '#fbcfe8',
          icon: '⚡'
        };
      case 'CORRUPTION_FLARE':
        return {
          bgColor: 'rgba(239, 68, 68, 0.15)',
          borderColor: '#ef4444',
          textColor: '#fecaca',
          icon: '🔥'
        };
      case 'WORLD_EVENT':
        return {
          bgColor: 'rgba(251, 146, 60, 0.2)',
          borderColor: '#fb923c',
          textColor: '#fed7aa',
          icon: '🌍'
        };
      case 'FACTION_EVENT':
        return {
          bgColor: 'rgba(217, 119, 6, 0.15)',
          borderColor: '#d97706',
          textColor: '#fcd34d',
          icon: '⚔️'
        };
      case 'AMBIENT_WHISPER':
        // M7: Ambient whispers have lower opacity, italic styling
        return {
          bgColor: 'rgba(100, 150, 180, 0.08)',
          borderColor: 'rgba(100, 150, 180, 0.3)',
          textColor: 'rgba(200, 220, 240, 0.8)',
          icon: '✧'
        };
      case 'NARRATIVE_STIMULUS':
      default:
        return {
          bgColor: 'rgba(59, 130, 246, 0.15)',
          borderColor: '#3b82f6',
          textColor: '#bfdbfe',
          icon: '📖'
        };
    }
  };

  // Render main stimuli (top-right)
  const mainStimuliJsx = (
    <div style={{
      position: 'fixed',
      top: 80,
      right: 20,
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      maxWidth: '300px',
      pointerEvents: 'none'
    }}>
      {mainStimuli.map((stimulus, idx) => {
        const style = getStyleForType(stimulus.type);
        const age = Date.now() - stimulus.createdAt;
        const duration = stimulus.displayDuration || displayDuration;
        const opacity = Math.max(0, 1 - (age / (duration - 300)));

        return (
          <div
            key={stimulus.id}
            style={{
              background: style.bgColor,
              border: `2px solid ${style.borderColor}`,
              borderRadius: '8px',
              padding: '12px 16px',
              color: style.textColor,
              fontSize: '13px',
              fontWeight: '500',
              fontFamily: 'monospace',
              backdropFilter: 'blur(8px)',
              opacity: opacity,
              transform: `translateX(${-20 * (1 - opacity)}px)`,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              boxShadow: `0 0 20px ${style.borderColor}40`,
              animation: `slideIn 0.3s ease`,
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
            onClick={() => setStimuli(prev => prev.filter(s => s.id !== stimulus.id))}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{style.icon}</span>
              <div>
                {stimulus.relicName && (
                  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '2px' }}>
                    {stimulus.relicName}
                  </div>
                )}
                <div>{stimulus.message}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render ambient whispers (bottom-left, separate area)
  const ambientWhispersJsx = ambientWhispers.length > 0 && (
    <div style={{
      position: 'fixed',
      bottom: 180,
      left: 20,
      zIndex: 998,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '250px',
      pointerEvents: 'none'
    }}>
      {ambientWhispers.map((stimulus) => {
        const style = getStyleForType(stimulus.type);
        const age = Date.now() - stimulus.createdAt;
        const duration = stimulus.displayDuration || 2500;
        const opacity = Math.max(0, 1 - (age / (duration - 300)));

        return (
          <div
            key={stimulus.id}
            style={{
              background: style.bgColor,
              border: `1px solid ${style.borderColor}`,
              borderRadius: '4px',
              padding: '8px 12px',
              color: style.textColor,
              fontSize: '12px',
              fontWeight: '400',
              fontFamily: 'serif',
              fontStyle: 'italic',
              backdropFilter: 'blur(6px)',
              opacity: opacity * 0.8,
              transform: `translateY(${20 * (1 - opacity)}px)`,
              transition: 'opacity 0.3s ease, transform 0.3s ease',
              boxShadow: `0 0 10px ${style.borderColor}20`,
              pointerEvents: 'auto',
              cursor: 'pointer'
            }}
            onClick={() => setStimuli(prev => prev.filter(s => s.id !== stimulus.id))}
          >
            <div style={{ textAlign: 'center', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {stimulus.message}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {mainStimuliJsx}
      {ambientWhispersJsx}

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(320px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
