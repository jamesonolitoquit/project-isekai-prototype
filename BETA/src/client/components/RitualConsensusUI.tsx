/**
 * Phase 4 Task 2: Ritual Consensus UI Component (UPDATED for M55)
 * 
 * Purpose: Display modal overlay for Grand Ritual voting with >50% consensus requirement
 * Features:
 * - Modal overlay blocking interface until voted
 * - Real-time peer vote display (approve/reject/pending)
 * - Dynamic consensus progress bar
 * - Countdown timer (30 seconds)
 * - Severity-based coloring (minor/major/critical)
 * - Single-vote enforcement per ritual
 * - Initiator tracking
 *
 * Part of: Director Intelligence Initiative (M55)
 */

import React, { useState, useEffect } from 'react';
import type { WorldState } from '../../engine/worldEngine';

// Backward compatibility with M43 interface
export interface PeerVote {
  peerId: string;
  peerName: string;
  voteType: 'agree' | 'disagree' | 'abstain';
  votedAt: number;
}

export interface RitualConsensus {
  ritualId: string;
  ritualName: string;
  description: string;
  proposedBy: string;
  votes: PeerVote[];
  startedAt: number;
  lockedAt?: number;
  requiredThreshold: number;
  directorOverride?: {
    overriddenAt: number;
    directorId: string;
    decision: 'approved' | 'rejected';
  };
}

// Phase 4 Grand Ritual Interface
export interface GrandRitual {
  id: string;
  name: string;
  description: string;
  severity: 'minor' | 'major' | 'critical';
  initiatorId: string;
  initiatorName?: string;
  votes: RitualVote[];
  createdAt: number;
}

export interface RitualVote {
  peerId: string;
  peerName?: string;
  vote: 'pending' | 'approve' | 'reject';
  timestamp?: number;
}

export interface RitualConsensusUIProps {
  // M43 mode (list) - deprecated
  rituals?: RitualConsensus[];
  currentPeerId?: string;
  onVote?: (ritualId: string, voteType: 'agree' | 'disagree' | 'abstain') => void;
  onDirectorOverride?: (ritualId: string, decision: 'approved' | 'rejected') => void;
  isDirector?: boolean;
  theme?: 'light' | 'dark';
  
  // Phase 4 mode (modal overlay)
  state?: WorldState;
  ritual?: GrandRitual | null;
  clientId?: string;
  totalPeers?: number;
  onVoteSubmit?: (vote: 'approve' | 'reject') => void;
  onStatusChange?: (message: string) => void;
}

// ============================================================================
// Phase 4 Helper Functions
// ============================================================================

/**
 * Get consensus required (>50% threshold)
 */
function getConsensusRequired(totalPeers: number): number {
  return Math.floor(totalPeers / 2) + 1;
}

/**
 * Get severity color for Grand Rituals
 */
function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#dc2626'; // Red
    case 'major':
      return '#f97316'; // Orange
    case 'minor':
    default:
      return '#fbbf24'; // Amber
  }
}

// ============================================================================
// Phase 4 Modal Component: Grand Ritual Overlay
// ============================================================================

/**
 * Grand Ritual Modal Overlay for Phase 4
 */
const GrandRitualModal: React.FC<{
  ritual: GrandRitual;
  clientId: string;
  totalPeers: number;
  onVoteSubmit?: (vote: 'approve' | 'reject') => void;
  onStatusChange?: (message: string) => void;
}> = ({ ritual, clientId, totalPeers, onVoteSubmit, onStatusChange }) => {
  const [hasVoted, setHasVoted] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(30);

  // Update countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const consensusRequired = getConsensusRequired(totalPeers);
  const approveCount = ritual.votes.filter(v => v.vote === 'approve').length;
  const rejectCount = ritual.votes.filter(v => v.vote === 'reject').length;
  const pendingCount = ritual.votes.filter(v => v.vote === 'pending').length;
  const isResolved = approveCount >= consensusRequired || rejectCount > (totalPeers - consensusRequired);
  const playerVote = ritual.votes.find(v => v.peerId === clientId);
  const playerApproved = playerVote?.vote === 'approve';

  const calculateConsensusPercentage = (votes: RitualVote[]): number => {
    if (votes.length === 0) return 0;
    const agreeCount = votes.filter(v => v.vote === 'approve').length;
    return (agreeCount / votes.length) * 100;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(13, 13, 26, 0.98)',
          border: `4px solid ${getSeverityColor(ritual.severity)}`,
          borderRadius: '12px',
          padding: '32px',
          maxWidth: '600px',
          width: '90%',
          boxShadow: `0 0 40px ${getSeverityColor(ritual.severity)}60`,
          fontFamily: 'monospace'
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h2
            style={{
              margin: '0 0 8px 0',
              color: getSeverityColor(ritual.severity),
              fontSize: '28px',
              textShadow: `0 0 10px ${getSeverityColor(ritual.severity)}80`
            }}
          >
            🔮 GRAND RITUAL INITIATED
          </h2>
          <div style={{ color: '#a78bfa', fontSize: '14px', fontWeight: 'bold' }}>
            {ritual.name}
          </div>
        </div>

        {/* Ritual Description */}
        <div
          style={{
            marginBottom: '20px',
            padding: '16px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid #374151',
            borderRadius: '8px',
            color: '#e0e0e0',
            fontSize: '13px',
            lineHeight: '1.6'
          }}
        >
          {ritual.description}
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#9ca3af' }}>
            <strong>Initiated by:</strong> {ritual.initiatorName || ritual.initiatorId}
          </div>
        </div>

        {/* Severity & Timer */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #374151',
              borderRadius: '6px',
              textAlign: 'center'
            }}
          >
            <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Ritual Severity</div>
            <div
              style={{
                color: getSeverityColor(ritual.severity),
                fontSize: '16px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}
            >
              {ritual.severity}
            </div>
          </div>

          <div
            style={{
              padding: '12px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #374151',
              borderRadius: '6px',
              textAlign: 'center'
            }}
          >
            <div style={{ color: '#9ca3af', fontSize: '11px', marginBottom: '4px' }}>Vote Timeout</div>
            <div
              style={{
                color: countdownSeconds > 10 ? '#fbbf24' : '#ef4444',
                fontSize: '16px',
                fontWeight: 'bold'
              }}
            >
              {countdownSeconds}s
            </div>
          </div>
        </div>

        {/* Consensus Progress Bar */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
            <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>Consensus Required: {consensusRequired}/{totalPeers}</span>
            <span style={{ color: '#9ca3af' }}>
              {approveCount} approve • {rejectCount} reject • {pendingCount} pending
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: '24px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #374151',
              borderRadius: '4px',
              display: 'flex',
              overflow: 'hidden'
            }}
          >
            {/* Approve Section (Green) */}
            <div
              style={{
                width: `${(approveCount / totalPeers) * 100}%`,
                backgroundColor: approveCount >= consensusRequired ? '#10b981' : '#6b7280',
                height: '100%',
                transition: 'all 0.3s ease'
              }}
            />

            {/* Reject Section (Red) */}
            <div
              style={{
                width: `${(rejectCount / totalPeers) * 100}%`,
                backgroundColor: rejectCount > (totalPeers - consensusRequired) ? '#dc2626' : '#6b7280',
                height: '100%',
                transition: 'all 0.3s ease'
              }}
            />

            {/* Pending Section (Gray) */}
            <div
              style={{
                flex: 1,
                backgroundColor: 'rgba(107, 114, 128, 0.3)',
                height: '100%'
              }}
            />
          </div>
        </div>

        {/* Peer Voting Status */}
        <div style={{ marginBottom: '20px', fontSize: '12px' }}>
          <div style={{ color: '#a78bfa', fontWeight: 'bold', marginBottom: '8px' }}>👥 Peer Votes</div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))',
              gap: '6px',
              maxHeight: '120px',
              overflowY: 'auto',
              padding: '8px',
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px'
            }}
          >
            {ritual.votes.map(vote => (
              <div
                key={vote.peerId}
                style={{
                  padding: '6px',
                  backgroundColor:
                    vote.vote === 'approve'
                      ? 'rgba(16, 185, 129, 0.15)'
                      : vote.vote === 'reject'
                      ? 'rgba(220, 38, 38, 0.15)'
                      : 'rgba(107, 114, 128, 0.15)',
                  border:
                    vote.vote === 'approve'
                      ? '1px solid #10b981'
                      : vote.vote === 'reject'
                      ? '1px solid #dc2626'
                      : '1px solid #6b7280',
                  borderRadius: '3px',
                  textAlign: 'center',
                  fontSize: '10px'
                }}
                title={vote.peerName || vote.peerId}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {vote.peerId === clientId ? '📍 You' : (vote.peerName || vote.peerId).substring(0, 6)}
                </div>
                <div
                  style={{
                    color:
                      vote.vote === 'approve'
                        ? '#10b981'
                        : vote.vote === 'reject'
                        ? '#dc2626'
                        : '#9ca3af',
                    fontSize: '9px'
                  }}
                >
                  {vote.vote === 'pending' ? '⏳' : vote.vote === 'approve' ? '✓' : '✕'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        {!isResolved ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => {
                onVoteSubmit?.('reject');
                setHasVoted(true);
                onStatusChange?.('Your vote against the ritual has been recorded');
              }}
              disabled={hasVoted}
              style={{
                padding: '12px',
                backgroundColor: hasVoted && !playerApproved ? '#7f1d1d' : '#dc2626',
                border: '2px solid #b91c1c',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: hasVoted ? 'not-allowed' : 'pointer',
                opacity: hasVoted && !playerApproved ? 1 : 0.7,
                transition: 'all 0.2s ease'
              }}
            >
              {hasVoted && !playerApproved ? '✓ REJECTED' : '❌ REJECT'}
            </button>

            <button
              onClick={() => {
                onVoteSubmit?.('approve');
                setHasVoted(true);
                onStatusChange?.('Your vote for the ritual has been recorded');
              }}
              disabled={hasVoted}
              style={{
                padding: '12px',
                backgroundColor: hasVoted && playerApproved ? '#15803d' : '#10b981',
                border: '2px solid #059669',
                color: '#fff',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: hasVoted ? 'not-allowed' : 'pointer',
                opacity: hasVoted && playerApproved ? 1 : 0.7,
                transition: 'all 0.2s ease'
              }}
            >
              {hasVoted && playerApproved ? '✓ APPROVED' : '✅ APPROVE'}
            </button>
          </div>
        ) : (
          <div
            style={{
              padding: '16px',
              backgroundColor:
                approveCount >= consensusRequired ? 'rgba(16, 185, 129, 0.15)' : 'rgba(220, 38, 38, 0.15)',
              border: approveCount >= consensusRequired ? '2px solid #10b981' : '2px solid #dc2626',
              borderRadius: '6px',
              textAlign: 'center',
              color: approveCount >= consensusRequired ? '#10b981' : '#dc2626',
              fontSize: '16px',
              fontWeight: 'bold'
            }}
          >
            {approveCount >= consensusRequired ? '🔮 RITUAL APPROVED - Casting...' : '⛔ RITUAL REJECTED'}
          </div>
        )}

        {/* Footer Info */}
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid #374151',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#9ca3af',
            textAlign: 'center'
          }}
        >
          💡 All connected peers must vote. Consensus is final and binding.
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// M43 Mode: Original List-Based Component (PRESERVED)
// ============================================================================

/**
 * Calculate consensus percentage from votes
 */
const calculateConsensusPercentage = (votes: PeerVote[]): number => {
  if (votes.length === 0) return 0;
  const agreeCount = votes.filter(v => v.voteType === 'agree').length;
  return (agreeCount / votes.length) * 100;
};

/**
 * Single Ritual Display
 */
const RitualCard: React.FC<{
  ritual: RitualConsensus;
  currentPeerId: string;
  onVote?: (voteType: 'agree' | 'disagree' | 'abstain') => void;
  onDirectorOverride?: (decision: 'approved' | 'rejected') => void;
  isDirector: boolean;
}> = ({ ritual, currentPeerId, onVote, onDirectorOverride, isDirector }) => {
  const consensusPercentage = calculateConsensusPercentage(ritual.votes);
  const isLocked = !!ritual.lockedAt;
  const hasDirectorOverride = !!ritual.directorOverride;
  const currentVote = ritual.votes.find(v => v.peerId === currentPeerId);

  // Determine if consensus reached
  const consensusReached = consensusPercentage >= ritual.requiredThreshold * 100;

  // Get status color
  const getStatusColor = () => {
    if (hasDirectorOverride) {
      return ritual.directorOverride!.decision === 'approved' ? '#10b981' : '#ef4444';
    }
    if (isLocked && consensusReached) return '#10b981';
    if (isLocked && !consensusReached) return '#ef4444';
    return '#a78bfa';
  };

  // Format duration
  const durationMs = Date.now() - ritual.startedAt;
  const durationS = Math.floor(durationMs / 1000);
  const durationM = Math.floor(durationS / 60);

  return (
    <div
      style={{
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: `2px solid ${getStatusColor()}`,
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '12px',
        backdropFilter: 'blur(8px)',
        transition: 'all 0.3s ease'
      }}
    >
      {/* Ritual Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '12px'
        }}
      >
        <div>
          <h3
            style={{
              margin: '0 0 4px 0',
              color: '#e2e8f0',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            {ritual.ritualName}
          </h3>
          <p
            style={{
              margin: '0',
              color: '#a0aec0',
              fontSize: '0.85rem'
            }}
          >
            {ritual.description}
          </p>
          <p
            style={{
              margin: '4px 0 0 0',
              color: '#64748b',
              fontSize: '0.75rem'
            }}
          >
            Proposed by: <span style={{ color: '#a78bfa' }}>{ritual.proposedBy}</span> • {durationM}m ago
          </p>
        </div>
        <div
          style={{
            padding: '4px 8px',
            backgroundColor: `${getStatusColor()}22`,
            border: `1px solid ${getStatusColor()}`,
            borderRadius: '4px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            color: getStatusColor(),
            textAlign: 'center'
          }}
        >
          {hasDirectorOverride
            ? `🔨 ${ritual.directorOverride!.decision.toUpperCase()}`
            : isLocked
              ? consensusReached
                ? '✓ LOCKED'
                : '✗ FAILED'
              : '⏳ VOTING'}
        </div>
      </div>

      {/* Consensus Progress */}
      <div style={{ marginBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '6px',
            fontSize: '0.75rem'
          }}
        >
          <span style={{ color: '#a0aec0' }}>Consensus</span>
          <span
            style={{
              color: consensusPercentage >= ritual.requiredThreshold * 100 ? '#10b981' : '#f59e0b',
              fontWeight: 'bold'
            }}
          >
            {Math.round(consensusPercentage)}% / {Math.round(ritual.requiredThreshold * 100)}%
          </span>
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: '100%',
            height: '8px',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #333',
            position: 'relative'
          }}
        >
          <div
            style={{
              width: `${consensusPercentage}%`,
              height: '100%',
              backgroundColor:
                consensusPercentage >= ritual.requiredThreshold * 100 ? '#10b981' : '#a78bfa',
              transition: 'width 0.3s ease'
            }}
          />

          {/* Threshold Marker */}
          <div
            style={{
              position: 'absolute',
              left: `${ritual.requiredThreshold * 100}%`,
              top: 0,
              bottom: 0,
              width: '2px',
              backgroundColor: '#f59e0b',
              opacity: 0.8
            }}
          />
        </div>
      </div>

      {/* Vote Summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          marginBottom: '12px',
          fontSize: '0.85rem'
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid #10b981',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#10b981', fontWeight: 'bold' }}>
            {ritual.votes.filter(v => v.voteType === 'agree').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Agree</div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid #ef4444',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#ef4444', fontWeight: 'bold' }}>
            {ritual.votes.filter(v => v.voteType === 'disagree').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Disagree</div>
        </div>

        <div
          style={{
            backgroundColor: 'rgba(107, 114, 128, 0.1)',
            border: '1px solid #6b7280',
            borderRadius: '4px',
            padding: '8px',
            textAlign: 'center'
          }}
        >
          <div style={{ color: '#9ca3af', fontWeight: 'bold' }}>
            {ritual.votes.filter(v => v.voteType === 'abstain').length}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.7rem' }}>Abstain</div>
        </div>
      </div>

      {/* Peer Votes List */}
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '4px',
          padding: '8px',
          marginBottom: '12px',
          maxHeight: '120px',
          overflowY: 'auto',
          fontSize: '0.75rem'
        }}
      >
        {ritual.votes.length === 0 ? (
          <p style={{ margin: '0', color: '#64748b' }}>Waiting for votes...</p>
        ) : (
          ritual.votes.map(vote => (
            <div
              key={vote.peerId}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: '1px solid rgba(100, 116, 139, 0.2)',
                color: vote.peerId === currentPeerId ? '#d4af37' : '#a0aec0'
              }}
            >
              <span>
                {vote.peerName}
                {vote.peerId === currentPeerId ? ' (you)' : ''}
              </span>
              <span
                style={{
                  fontWeight: 'bold',
                  color:
                    vote.voteType === 'agree'
                      ? '#10b981'
                      : vote.voteType === 'disagree'
                        ? '#ef4444'
                        : '#9ca3af'
                }}
              >
                {vote.voteType === 'agree' ? '✓' : vote.voteType === 'disagree' ? '✗' : '◯'}{' '}
                {vote.voteType.toUpperCase()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '8px'
        }}
      >
        {!isLocked && !currentVote && (
          <>
            <button
              onClick={() => onVote?.('agree')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                border: '1px solid #10b981',
                color: '#10b981',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
              }}
            >
              ✓ Agree
            </button>
            <button
              onClick={() => onVote?.('disagree')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'rgba(239, 68, 68, 0.2)',
                border: '1px solid #ef4444',
                color: '#ef4444',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              ✗ Disagree
            </button>
            <button
              onClick={() => onVote?.('abstain')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'rgba(107, 114, 128, 0.2)',
                border: '1px solid #6b7280',
                color: '#9ca3af',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(107, 114, 128, 0.2)';
              }}
            >
              ◯ Abstain
            </button>
          </>
        )}

        {currentVote && !isLocked && (
          <div
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor:
                currentVote.voteType === 'agree'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : currentVote.voteType === 'disagree'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'rgba(107, 114, 128, 0.2)',
              border: `1px solid ${
                currentVote.voteType === 'agree'
                  ? '#10b981'
                  : currentVote.voteType === 'disagree'
                    ? '#ef4444'
                    : '#6b7280'
              }`,
              borderRadius: '4px',
              textAlign: 'center',
              color:
                currentVote.voteType === 'agree'
                  ? '#10b981'
                  : currentVote.voteType === 'disagree'
                    ? '#ef4444'
                    : '#9ca3af',
              fontWeight: 'bold',
              fontSize: '0.85rem'
            }}
          >
            Your vote: {currentVote.voteType.toUpperCase()}
          </div>
        )}

        {isDirector && !hasDirectorOverride && (
          <>
            <button
              onClick={() => onDirectorOverride?.('approved')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                border: '2px solid #d4af37',
                color: '#d4af37',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              title="Director override: Force approval"
            >
              🔨 Approve
            </button>
            <button
              onClick={() => onDirectorOverride?.('rejected')}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: 'rgba(212, 175, 55, 0.2)',
                border: '2px solid #d4af37',
                color: '#d4af37',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '0.85rem',
                transition: 'all 0.2s ease'
              }}
              title="Director override: Force rejection"
            >
              🔨 Reject
            </button>
          </>
        )}
      </div>

      {/* Locked Notice */}
      {isLocked && (
        <div
          style={{
            marginTop: '12px',
            padding: '8px',
            backgroundColor: 'rgba(212, 175, 55, 0.1)',
            border: '1px dashed #d4af37',
            borderRadius: '4px',
            color: '#d4af37',
            fontSize: '0.75rem',
            textAlign: 'center'
          }}
        >
          🔒 Consensus locked - Immutable
        </div>
      )}
    </div>
  );
};

/**
 * Ritual Consensus UI Component (Dual Mode)
 * 
 * Automatically selects between:
 * - Phase 4 Mode: Modal overlay for Grand Rituals (requires ritual, clientId, totalPeers)
 * - M43 Mode: List view for ritual tracking (requires rituals array)
 */
export const RitualConsensusUI: React.FC<RitualConsensusUIProps> = ({
  // Phase 4 props
  ritual,
  clientId,
  totalPeers,
  onVoteSubmit,
  onStatusChange,
  
  // M43 props (deprecated but maintained for backward compatibility)
  rituals = [],
  currentPeerId = '',
  onVote,
  onDirectorOverride,
  isDirector = false,
  theme = 'dark'
}) => {
  // Phase 4 Mode: Show modal overlay if ritual is active
  if (ritual && clientId && totalPeers) {
    return (
      <GrandRitualModal
        ritual={ritual}
        clientId={clientId}
        totalPeers={totalPeers}
        onVoteSubmit={onVoteSubmit}
        onStatusChange={onStatusChange}
      />
    );
  }

  // M43 Mode: Show list view
  if (rituals.length === 0) {
    return (
      <div
        style={{
          padding: '32px',
          textAlign: 'center',
          color: '#64748b',
          backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.5)' : '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }}
      >
        <p>No active rituals requiring consensus.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '16px' }}>
      <h2
        style={{
          margin: '0 0 16px 0',
          color: '#e2e8f0',
          fontSize: '1.3rem',
          fontWeight: '600'
        }}
      >
        Active Rituals
      </h2>

      {rituals.map(ritual => (
        <RitualCard
          key={ritual.ritualId}
          ritual={ritual}
          currentPeerId={currentPeerId}
          onVote={(voteType) => onVote?.(ritual.ritualId, voteType)}
          onDirectorOverride={(decision) => onDirectorOverride?.(ritual.ritualId, decision)}
          isDirector={isDirector}
        />
      ))}
    </div>
  );
};

export default RitualConsensusUI;
