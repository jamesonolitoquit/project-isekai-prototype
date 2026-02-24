/**
 * M42 Task 1: Co-DM Dashboard Component
 * 
 * Purpose: Co-DM narrative metrics dashboard for collaborative storytelling
 * Features:
 * - Narrative stress gauge (paradox/chaos interaction)
 * - Chaos level gauge
 * - Prophecy stability gauge
 * - Seer's Hand control panel (whisper/event sending)
 * - Network telemetry (latency, peer consensus, phantoms)
 * - Authority ledger with multi-GM voting
 *
 * Part of: M42 Co-DM Authority System (Director/Seer authority voting)
 */

import React, { useState, useCallback } from 'react';
import type { WorldState } from '../../engine/worldEngine';

export interface CoDirector {
  id: string;
  name: string;
  authority: number; // 0-100, voting weight
  votedAt?: number;
}

export interface CoDmDashboardProps {
  currentDirectorState?: {
    chaos: number;           // 0-100
    paradox: number;         // 0-100
    prophecyHealth: number;  // 0-100
  };
  networkDiagnostics?: {
    latencyP95: number;
    peerConsensusHealth: number;
    phantomEngineCount: number;
  };
  coDirectors?: CoDirector[];
  seerName?: string;
  onSendWhisper?: (message: string, priority: string) => void;
  onCurateEvent?: (eventDescription: string) => void;
  onInitiateAuthorityVote?: (proposal: string) => void;
}

/**
 * Gauge Component for metrics display
 */
const Gauge: React.FC<{
  label: string;
  value: number;
  max?: number;
  color?: string;
  showWarning?: boolean;
}> = ({ label, value, max = 100, color = '#a78bfa', showWarning = false }) => {
  const percentage = (value / max) * 100;

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}
      >
        <span style={{ color: '#a0aec0', fontSize: '0.95rem', fontWeight: '500' }}>
          {label}
        </span>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span
            style={{
              color,
              fontSize: '1.1rem',
              fontWeight: 'bold',
              minWidth: '50px',
              textAlign: 'right'
            }}
          >
            {Math.round(percentage)}%
          </span>
          {showWarning && percentage > 75 && (
            <span style={{ color: '#f59e0b', fontSize: '1rem' }}>⚠️</span>
          )}
        </div>
      </div>

      <div
        style={{
          width: '100%',
          height: '20px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '10px',
          overflow: 'hidden',
          border: `1px solid ${color}44`,
          position: 'relative'
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease',
            boxShadow: `0 0 10px ${color}`
          }}
        />

        {/* Danger zone at 75% */}
        <div
          style={{
            position: 'absolute',
            right: '25%',
            top: 0,
            bottom: 0,
            width: '1px',
            backgroundColor: '#f59e0b',
            opacity: 0.5
          }}
        />
      </div>
    </div>
  );
};

/**
 * Co-DM Dashboard Component
 */
export const CoDmDashboard: React.FC<CoDmDashboardProps> = ({
  currentDirectorState = { chaos: 45, paradox: 30, prophecyHealth: 72 },
  networkDiagnostics = {
    latencyP95: 145,
    peerConsensusHealth: 88,
    phantomEngineCount: 3
  },
  coDirectors = [],
  seerName = 'Seer',
  onSendWhisper,
  onCurateEvent,
  onInitiateAuthorityVote
}) => {
  // =========================================================================
  // STATE
  // =========================================================================

  const [whisperMessage, setWhisperMessage] = useState('');
  const [whisperPriority, setWhisperPriority] = useState<'normal' | 'urgent' | 'critical'>(
    'normal'
  );
  const [eventDescription, setEventDescription] = useState('');
  const [proposalText, setProposalText] = useState('');
  const [showWhisperPanel, setShowWhisperPanel] = useState(false);
  const [showEventPanel, setShowEventPanel] = useState(false);
  const [showAuthorityPanel, setShowAuthorityPanel] = useState(false);

  // =========================================================================
  // HANDLERS
  // =========================================================================

  const handleSendWhisper = useCallback(() => {
    if (whisperMessage.trim()) {
      onSendWhisper?.(whisperMessage, whisperPriority);
      setWhisperMessage('');
      setShowWhisperPanel(false);
    }
  }, [whisperMessage, whisperPriority, onSendWhisper]);

  const handleCurateEvent = useCallback(() => {
    if (eventDescription.trim()) {
      onCurateEvent?.(eventDescription);
      setEventDescription('');
      setShowEventPanel(false);
    }
  }, [eventDescription, onCurateEvent]);

  const handleInitiateVote = useCallback(() => {
    if (proposalText.trim()) {
      onInitiateAuthorityVote?.(proposalText);
      setProposalText('');
      setShowAuthorityPanel(false);
    }
  }, [proposalText, onInitiateAuthorityVote]);

  // Calculate narrative stress from paradox and chaos
  const narrativeStress = Math.sqrt(
    currentDirectorState.chaos ** 2 + currentDirectorState.paradox ** 2
  ) / Math.sqrt(2); // Normalize to 0-100

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div
      style={{
        padding: '20px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        border: '1px solid #4f2783',
        backdropFilter: 'blur(10px)',
        color: '#e2e8f0'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h2
          style={{
            margin: '0 0 8px 0',
            fontSize: '1.3rem',
            fontWeight: '600',
            color: '#d4af37'
          }}
        >
          📊 Co-DM Dashboard
        </h2>
        <p style={{ margin: '0', fontSize: '0.85rem', color: '#a0aec0' }}>
          Narrative Authority: <span style={{ color: '#a78bfa' }}>{seerName}</span> + Council
        </p>
      </div>

      {/* Three Gauges Row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '8px',
          border: '1px solid #4f2783'
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#d4af37' }}>
            Narrative Stress
          </h3>
          <Gauge
            label="System Health"
            value={100 - Math.min(100, narrativeStress)}
            max={100}
            color={narrativeStress > 70 ? '#ef4444' : '#a78bfa'}
            showWarning={true}
          />
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#d4af37' }}>
            Chaos Level
          </h3>
          <Gauge
            label="Reality Stability"
            value={100 - currentDirectorState.chaos}
            max={100}
            color={currentDirectorState.chaos > 70 ? '#ef4444' : '#f59e0b'}
            showWarning={true}
          />
        </div>

        <div>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#d4af37' }}>
            Prophecy Health
          </h3>
          <Gauge
            label="Narrative Coherence"
            value={currentDirectorState.prophecyHealth}
            max={100}
            color={
              currentDirectorState.prophecyHealth > 70
                ? '#10b981'
                : currentDirectorState.prophecyHealth > 40
                  ? '#f59e0b'
                  : '#ef4444'
            }
            showWarning={true}
          />
        </div>
      </div>

      {/* Seer's Hand Control Panel */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderRadius: '8px',
          border: '1px solid #6d28d9'
        }}
      >
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#c084fc'
          }}
        >
          ✋ The Seer's Hand
        </h3>

        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '0.85rem',
            color: '#a0aec0'
          }}
        >
          Direct interface to narrative intervention systems. Send whispers, curate events, or
          modify world state.
        </p>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <button
            onClick={() => setShowWhisperPanel(!showWhisperPanel)}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'rgba(148, 51, 234, 0.2)',
              border: '1px solid #9333ea',
              color: '#c084fc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(148, 51, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(148, 51, 234, 0.2)';
            }}
          >
            📢 Send Whisper
          </button>
          <button
            onClick={() => setShowEventPanel(!showEventPanel)}
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'rgba(168, 85, 247, 0.2)',
              border: '1px solid #a855f7',
              color: '#c084fc',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
            }}
          >
            🎭 Curate Event
          </button>
        </div>

        {/* Whisper Panel */}
        {showWhisperPanel && (
          <div
            style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              border: '1px solid #6d28d9'
            }}
          >
            <textarea
              placeholder="Enter director whisper message..."
              value={whisperMessage}
              onChange={(e) => setWhisperMessage(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #4f2783',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
            />

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="radio"
                  name="priority"
                  value="normal"
                  checked={whisperPriority === 'normal'}
                  onChange={() => setWhisperPriority('normal')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#a78bfa' }}>Normal</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="radio"
                  name="priority"
                  value="urgent"
                  checked={whisperPriority === 'urgent'}
                  onChange={() => setWhisperPriority('urgent')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#f59e0b' }}>Urgent</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                <input
                  type="radio"
                  name="priority"
                  value="critical"
                  checked={whisperPriority === 'critical'}
                  onChange={() => setWhisperPriority('critical')}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>Critical</span>
              </label>
            </div>

            <button
              onClick={handleSendWhisper}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#9333ea',
                border: 'none',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Send to Players
            </button>
          </div>
        )}

        {/* Event Panel */}
        {showEventPanel && (
          <div
            style={{
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '6px',
              border: '1px solid #6d28d9'
            }}
          >
            <textarea
              placeholder="Enter macro event description..."
              value={eventDescription}
              onChange={(e) => setEventDescription(e.target.value)}
              style={{
                width: '100%',
                height: '80px',
                padding: '8px',
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                border: '1px solid #4f2783',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                marginBottom: '8px',
                boxSizing: 'border-box'
              }}
            />

            <button
              onClick={handleCurateEvent}
              style={{
                width: '100%',
                padding: '8px',
                backgroundColor: '#a855f7',
                border: 'none',
                color: '#fff',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Trigger Event
            </button>
          </div>
        )}
      </div>

      {/* Network Telemetry */}
      <div
        style={{
          marginBottom: '24px',
          padding: '16px',
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          borderRadius: '8px',
          border: '1px solid #1e40af'
        }}
      >
        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '1rem',
            fontWeight: '600',
            color: '#60a5fa'
          }}
        >
          🌐 Network Health
        </h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            fontSize: '0.85rem'
          }}
        >
          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              border: '1px solid #1e40af'
            }}
          >
            <div style={{ color: '#a0aec0', marginBottom: '4px' }}>P95 Latency</div>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 'bold',
                color:
                  networkDiagnostics.latencyP95 < 100
                    ? '#10b981'
                    : networkDiagnostics.latencyP95 < 300
                      ? '#f59e0b'
                      : '#ef4444'
              }}
            >
              {networkDiagnostics.latencyP95}ms
            </div>
          </div>

          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              border: '1px solid #1e40af'
            }}
          >
            <div style={{ color: '#a0aec0', marginBottom: '4px' }}>Consensus Health</div>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 'bold',
                color:
                  networkDiagnostics.peerConsensusHealth > 75
                    ? '#10b981'
                    : networkDiagnostics.peerConsensusHealth > 50
                      ? '#f59e0b'
                      : '#ef4444'
              }}
            >
              {networkDiagnostics.peerConsensusHealth}%
            </div>
          </div>

          <div
            style={{
              padding: '10px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              border: '1px solid #1e40af'
            }}
          >
            <div style={{ color: '#a0aec0', marginBottom: '4px' }}>Phantom Engines</div>
            <div
              style={{
                fontSize: '1.3rem',
                fontWeight: 'bold',
                color: '#60a5fa'
              }}
            >
              {networkDiagnostics.phantomEngineCount}
            </div>
          </div>
        </div>
      </div>

      {/* Authority Ledger */}
      {coDirectors.length > 0 && (
        <div
          style={{
            marginBottom: '24px',
            padding: '16px',
            backgroundColor: 'rgba(212, 175, 55, 0.05)',
            borderRadius: '8px',
            border: '1px solid #d4af37'
          }}
        >
          <h3
            style={{
              margin: '0 0 12px 0',
              fontSize: '1rem',
              fontWeight: '600',
              color: '#d4af37'
            }}
          >
            ⚔️ Authority Ledger
          </h3>

          <div
            style={{
              marginBottom: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            {coDirectors.map((director) => (
              <div
                key={director.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  border: '1px solid #6d4c1f'
                }}
              >
                <span style={{ color: '#f0e68c' }}>{director.name}</span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <div
                    style={{
                      width: '60px',
                      height: '12px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      border: '1px solid #6d4c1f'
                    }}
                  >
                    <div
                      style={{
                        width: `${director.authority}%`,
                        height: '100%',
                        backgroundColor: '#d4af37'
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#d4af37', minWidth: '30px' }}>
                    {director.authority}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setShowAuthorityPanel(!showAuthorityPanel)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: 'rgba(212, 175, 55, 0.2)',
              border: '1px solid #d4af37',
              color: '#d4af37',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500'
            }}
          >
            📜 Initiate Authority Vote
          </button>

          {showAuthorityPanel && (
            <div
              style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '6px',
                border: '1px solid #6d4c1f'
              }}
            >
              <textarea
                placeholder="Enter proposal for council vote..."
                value={proposalText}
                onChange={(e) => setProposalText(e.target.value)}
                style={{
                  width: '100%',
                  height: '60px',
                  padding: '8px',
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  border: '1px solid #4f2783',
                  borderRadius: '4px',
                  color: '#e2e8f0',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  marginBottom: '8px',
                  boxSizing: 'border-box'
                }}
              />

              <button
                onClick={handleInitiateVote}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#d4af37',
                  border: 'none',
                  color: '#000',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: '600'
                }}
              >
                Submit Proposal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CoDmDashboard;
