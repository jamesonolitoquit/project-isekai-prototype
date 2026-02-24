/**
 * M43 Task 3: Ritual Consensus UI Component
 * 
 * Purpose: Display peer consensus voting for multiplayer ritual events
 * Features:
 * - Active ritual tracking
 * - Peer vote indicators (agree/disagree/abstain)
 * - Consensus progress visualization
 * - Threshold markers (75% for rituals)
 * - Locked consensus status (immutable post-vote)
 * - Director override capabilities
 *
 * Part of: Distributed Narrative System (M43)
 */

import React, { useState, useEffect } from 'react';

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
  lockedAt?: number; // Undefined if not locked
  requiredThreshold: number; // e.g., 0.75 for 75%
  directorOverride?: {
    overriddenAt: number;
    directorId: string;
    decision: 'approved' | 'rejected';
  };
}

export interface RitualConsensusUIProps {
  rituals: RitualConsensus[];
  currentPeerId: string;
  onVote?: (ritualId: string, voteType: 'agree' | 'disagree' | 'abstain') => void;
  onDirectorOverride?: (ritualId: string, decision: 'approved' | 'rejected') => void;
  isDirector?: boolean;
  theme?: 'light' | 'dark';
}

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
 * Ritual Consensus UI Component
 */
export const RitualConsensusUI: React.FC<RitualConsensusUIProps> = ({
  rituals,
  currentPeerId,
  onVote,
  onDirectorOverride,
  isDirector = false,
  theme = 'dark'
}) => {
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
