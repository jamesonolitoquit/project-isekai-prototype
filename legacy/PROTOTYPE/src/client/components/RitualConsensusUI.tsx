/**
 * M42 Phase 4 Task 4.6: Ritual Consensus UI
 *
 * Displays real-time peer consensus on ritual voting for multiplayer events.
 * Shows active ritual consensus state, peer agreement percentages, and voting status.
 *
 * Features:
 * - Current active rituals and their consensus status
 * - Peer vote tracking (agree/disagree/abstain)
 * - Consensus progress bars with threshold markers
 * - Automatic consensus resolution (2/3 quorum)
 * - Visualization of tie-breaking conditions
 */

import React, { useState, useEffect } from 'react';

/**
 * Peer vote status in a ritual consensus
 */
interface PeerVote {
  peerId: string;
  playerName: string;
  vote: 'agree' | 'disagree' | 'abstain';
  votedAt: number;
  weight?: number; // Director votes may carry more weight
}

/**
 * Active ritual consensus tracking
 */
export interface RitualConsensus {
  consensusId: string;
  ritualId: string;
  ritualName: string;
  initiator: string;
  startTime: number;
  timeoutAt: number; // When voting closes
  requiredThreshold: number; // e.g., 0.667 for 2/3 majority
  votes: PeerVote[];
  status: 'voting' | 'resolved' | 'expired' | 'deadlocked' | 'locked';
  resolution?: 'approved' | 'rejected' | 'tie';
  lockedAt?: number;  // M43: When consensus became locked/immutable
  canRollback?: boolean; // M43: If false, can't rewind past this point
}

/**
 * Props for RitualConsensusUI
 */
export interface RitualConsensusUIProps {
  activeConsensuses: RitualConsensus[];
  localPlayerId: string;
  isDirector?: boolean;
  onVote?: (consensusId: string, vote: 'agree' | 'disagree' | 'abstain') => void;
  onConsensusResolved?: (consensus: RitualConsensus) => void;
}

/**
 * Calculate consensus statistics from votes
 */
function calculateConsensusStats(votes: PeerVote[], threshold: number) {
  const totalVotes = votes.length;
  const agreeCount = votes.filter(v => v.vote === 'agree').length;
  const disagreeCount = votes.filter(v => v.vote === 'disagree').length;
  const abstainCount = votes.filter(v => v.vote === 'abstain').length;

  const activeVotes = agreeCount + disagreeCount;
  const agreePercentage = activeVotes > 0 ? agreeCount / activeVotes : 0;
  const thresholdMet = agreePercentage >= threshold;

  return {
    totalVotes,
    agreeCount,
    disagreeCount,
    abstainCount,
    activeVotes,
    agreePercentage,
    thresholdMet
  };
}

/**
 * Format timestamp as relative time (e.g., "in 5s", "3s ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = Math.abs(now - timestamp);
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

/**
 * RitualConsensusUI Component
 */
export const RitualConsensusUI: React.FC<RitualConsensusUIProps> = ({
  activeConsensuses,
  localPlayerId,
  isDirector = false,
  onVote,
  onConsensusResolved
}) => {
  const [expandedConsensus, setExpandedConsensus] = useState<string | null>(null);

  useEffect(() => {
    // Auto-resolve expired consensuses
    if (onConsensusResolved) {
      for (const consensus of activeConsensuses) {
        if (consensus.status === 'voting' && Date.now() >= consensus.timeoutAt) {
          const resolved = { ...consensus, status: 'expired' as const };
          onConsensusResolved(resolved);
        }
      }
    }
  }, [activeConsensuses, onConsensusResolved]);

  if (activeConsensuses.length === 0) {
    return (
      <div style={{
        padding: '12px',
        backgroundColor: '#1f2937',
        borderRadius: '6px',
        fontSize: '12px',
        color: '#9ca3af'
      }}>
        ⚖️ No active ritual consensus votes
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px'
    }}>
      {activeConsensuses.map(consensus => {
        const stats = calculateConsensusStats(consensus.votes, consensus.requiredThreshold);
        const timeRemaining = Math.max(0, consensus.timeoutAt - Date.now());
        const timePercentage = (timeRemaining / (10000)) * 100; // Assume 10s timeout
        const expanded = expandedConsensus === consensus.consensusId;
        
        // Determine status color
        let statusColor = '#6b7280';
        let statusIcon = '⏳';
        if (consensus.status === 'locked') {
          statusColor = '#fbbf24';
          statusIcon = '🔒';
        } else if (consensus.status === 'voting') {
          if (stats.thresholdMet) {
            statusColor = '#10b981';
            statusIcon = '✓';
          } else if (stats.disagreeCount > stats.agreeCount) {
            statusColor = '#ef4444';
            statusIcon = '✗';
          }
        } else if (consensus.status === 'resolved') {
          statusIcon = consensus.resolution === 'approved' ? '✓' : '✗';
          statusColor = consensus.resolution === 'approved' ? '#10b981' : '#ef4444';
        } else if (consensus.status === 'expired') {
          statusIcon = '⏰';
          statusColor = '#f59e0b';
        } else if (consensus.status === 'deadlocked') {
          statusIcon = '⚔️';
          statusColor = '#8b5cf6';
        }

        return (
          <div
            key={consensus.consensusId}
            style={{
              padding: '12px',
              backgroundColor: '#111827',
              borderRadius: '6px',
              border: `1px solid ${statusColor}`,
              cursor: 'pointer',
              transition: 'all 200ms ease'
            }}
            onClick={() => setExpandedConsensus(expanded ? null : consensus.consensusId)}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: expanded ? '10px' : '0'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px' }}>{statusIcon}</span>
                <div>
                  <div style={{
                    fontWeight: 600,
                    color: '#e5e7eb',
                    fontSize: '12px'
                  }}>
                    {consensus.ritualName}
                    {consensus.status === 'locked' && (
                      <span style={{
                        marginLeft: '8px',
                        padding: '2px 6px',
                        backgroundColor: '#fbbf24',
                        color: '#111827',
                        fontSize: '10px',
                        borderRadius: '3px',
                        fontWeight: 700
                      }}>
                        🔒 LOCKED
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: '#9ca3af'
                  }}>
                    by {consensus.initiator}
                    {consensus.lockedAt && (
                      <span style={{ marginLeft: '8px' }}>
                        • Locked {formatRelativeTime(consensus.lockedAt)} ago
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: '#9ca3af'
              }}>
                <div style={{ fontWeight: 600, color: statusColor }}>
                  {stats.agreeCount}/{stats.activeVotes}
                </div>
                <div>{expanded ? '▼' : '▶'}</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: expanded ? '10px' : '0' }}>
              <div style={{
                display: 'flex',
                position: 'relative',
                height: '16px',
                backgroundColor: '#0f172a',
                borderRadius: '2px',
                overflow: 'hidden',
                gap: '1px'
              }}>
                {/* Agreement percentage bar */}
                <div
                  style={{
                    width: `${stats.agreePercentage * 100}%`,
                    backgroundColor: stats.thresholdMet ? '#10b981' : '#f59e0b',
                    transition: 'width 200ms ease'
                  }}
                />
                
                {/* Threshold marker */}
                <div
                  style={{
                    position: 'absolute',
                    left: `${consensus.requiredThreshold * 100}%`,
                    width: '2px',
                    height: '100%',
                    backgroundColor: '#60a5fa',
                    opacity: 0.7
                  }}
                  title={`Consensus threshold: ${Math.round(consensus.requiredThreshold * 100)}%`}
                />

                {/* Time remaining indicator */}
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: `${100 - timePercentage}%`,
                  backgroundColor: 'rgba(0,0,0,0.1)',
                  transition: 'width 100ms linear'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '2px',
                fontSize: '9px',
                color: '#6b7280'
              }}>
                <span>Agree: {stats.agreeCount}</span>
                <span>Disagree: {stats.disagreeCount}</span>
                <span>Abstain: {stats.abstainCount}</span>
                <span>{formatRelativeTime(consensus.timeoutAt)} left</span>
              </div>
            </div>

            {/* Expanded details */}
            {expanded && (
              <div style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px solid #374151'
              }}>
                {/* Vote list */}
                <div style={{ marginBottom: '10px' }}>
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: '#a0aec0',
                    marginBottom: '6px'
                  }}>
                    Peer Votes
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                    {consensus.votes.map(vote => (
                      <div
                        key={vote.peerId}
                        style={{
                          padding: '6px',
                          backgroundColor: '#0f172a',
                          borderLeft: `3px solid ${
                            vote.vote === 'agree' ? '#10b981' :
                            vote.vote === 'disagree' ? '#ef4444' :
                            '#6b7280'
                          }`,
                          fontSize: '9px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ color: '#e5e7eb' }}>
                          {vote.playerName.slice(0, 10)}...
                        </span>
                        <span style={{
                          color: vote.vote === 'agree' ? '#10b981' :
                                 vote.vote === 'disagree' ? '#ef4444' :
                                 '#9ca3af',
                          fontWeight: 500
                        }}>
                          {vote.vote.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Local player voting (if not yet voted and consensus still active) */}
                {consensus.status === 'voting' && 
                 !consensus.votes.find(v => v.peerId === localPlayerId) &&
                 onVote && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '6px',
                    marginTop: '8px'
                  }}>
                    {['agree', 'disagree', 'abstain'].map(vote => (
                      <button
                        key={vote}
                        onClick={() => onVote(consensus.consensusId, vote as any)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#374151',
                          border: '1px solid #4b5563',
                          color: '#e5e7eb',
                          fontSize: '9px',
                          fontWeight: 600,
                          borderRadius: '3px',
                          cursor: 'pointer',
                          transition: 'all 150ms ease'
                        }}
                        onMouseEnter={(e) => {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.backgroundColor = '#4b5563';
                        }}
                        onMouseLeave={(e) => {
                          const btn = e.currentTarget as HTMLButtonElement;
                          btn.style.backgroundColor = '#374151';
                        }}
                      >
                        {vote === 'agree' ? '✓ Agree' :
                         vote === 'disagree' ? '✗ Disagree' :
                         '— Abstain'}
                      </button>
                    ))}
                  </div>
                )}

                {/* Locked consensus notice */}
                {consensus.status === 'locked' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: 'rgba(251, 191, 36, 0.1)',
                    borderLeft: '2px solid #fbbf24',
                    fontSize: '10px',
                    color: '#fcd34d',
                    borderRadius: '3px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>🔒 IMMUTABLE CONSENSUS</div>
                    <div>This consensus is locked and cannot be modified. Timeline cannot be rewound past this point without Director override.</div>
                    {consensus.canRollback === false && (
                      <div style={{ marginTop: '4px', fontWeight: 600, color: '#ef4444' }}>
                        ⛔ Rollback blocked for this region
                      </div>
                    )}
                  </div>
                )}

                {/* Director override notice */}
                {isDirector && consensus.status === 'voting' && (
                  <div style={{
                    marginTop: '8px',
                    padding: '6px',
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    borderLeft: '2px solid #a855f7',
                    fontSize: '9px',
                    color: '#d8b4fe'
                  }}>
                    📡 Director: You can override this consensus with /seal_canon
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default RitualConsensusUI;
