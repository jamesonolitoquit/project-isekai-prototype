/**
 * M63-B: Conflict Resolution Voting UI
 * 
 * React component for displaying active votes, allowing peers to vote,
 * and showing results. Integrated into BetaApplication HUD.
 */

import React, { useState, useEffect } from 'react';
import type { VoteSession, VoteResult, PeerVote } from '../engine/m63BConflictResolution';
import {
  castVote,
  finalizeVote,
  validateVoteIntegrity
} from '../engine/m63BConflictResolution';

export interface ConflictResolutionUIProps {
  session: VoteSession;
  peerId: string;
  peerName: string;
  totalPeers: number;
  onVote?: (vote: 'yes' | 'no' | 'abstain', reason?: string) => void;
  onFinalize?: (result: VoteResult) => void;
}

/**
 * Main voting UI component
 */
export const ConflictResolutionUI: React.FC<ConflictResolutionUIProps> = ({
  session,
  peerId,
  peerName,
  totalPeers,
  onVote,
  onFinalize
}) => {
  const [selectedVote, setSelectedVote] = useState<'yes' | 'no' | 'abstain' | null>(null);
  const [reason, setReason] = useState('');
  const [hasVoted, setHasVoted] = useState(session.votes.has(peerId));
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [result, setResult] = useState<VoteResult | null>(null);

  // Update time remaining
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, session.deadline - Date.now());
      setTimeRemaining(remaining);

      if (remaining === 0 && !result) {
        // Finalize vote
        const voteResult = finalizeVote(session, totalPeers);
        setResult(voteResult);
        onFinalize?.(voteResult);
      }
    }, 100);

    return () => clearInterval(timer);
  }, [session, totalPeers, result, onFinalize]);

  // Check if current peer has already voted
  useEffect(() => {
    setHasVoted(session.votes.has(peerId));
  }, [session.votes, peerId]);

  const handleVote = (vote: 'yes' | 'no' | 'abstain') => {
    if (hasVoted) return;

    setSelectedVote(vote);
    castVote(session, peerId, peerName, vote, reason);
    setHasVoted(true);
    onVote?.(vote, reason);
  };

  const currentVotes = Array.from(session.votes.values());
  const yesCount = currentVotes.filter(v => v.vote === 'yes').length;
  const noCount = currentVotes.filter(v => v.vote === 'no').length;
  const abstainCount = currentVotes.filter(v => v.vote === 'abstain').length;

  const timeRemainingSeconds = Math.ceil(timeRemaining / 1000);
  const voteIntegrity = validateVoteIntegrity(session);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>⚖️ Democratic Vote</h3>
        <div style={styles.voteType}>{formatVoteType(session.voteType)}</div>
      </div>

      <div style={styles.description}>{session.description}</div>

      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={{ color: '#34d399' }}>✓ Yes: {yesCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={{ color: '#ef4444' }}>✗ No: {noCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={{ color: '#9ca3af' }}>≈ Abstain: {abstainCount}</span>
        </div>
        <div style={styles.stat}>
          <span style={{ color: '#fbbf24' }}>📊 Total: {currentVotes.length}/{totalPeers}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(currentVotes.length / totalPeers) * 100}%`
            }}
          />
        </div>
        <div style={styles.progressLabel}>
          {currentVotes.length} peers voted
        </div>
      </div>

      {/* Time remaining */}
      <div style={{
        ...styles.timeRemaining,
        color: timeRemainingSeconds < 10 ? '#ef4444' : '#9ca3af'
      }}>
        ⏱ {timeRemainingSeconds}s remaining
      </div>

      {/* Vote buttons */}
      {!hasVoted && session.status === 'pending' ? (
        <div style={styles.votingSection}>
          <div style={styles.reasonInput}>
            <label>Your position (optional):</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why am I voting this way?"
              style={styles.textarea}
              maxLength={100}
            />
          </div>

          <div style={styles.buttonGroup}>
            <button
              style={styles.buttonYes}
              onClick={() => handleVote('yes')}
            >
              ✓ Vote Yes
            </button>
            <button
              style={styles.buttonNo}
              onClick={() => handleVote('no')}
            >
              ✗ Vote No
            </button>
            <button
              style={styles.buttonAbstain}
              onClick={() => handleVote('abstain')}
            >
              ≈ Abstain
            </button>
          </div>
        </div>
      ) : result ? (
        <ResultsPanel result={result} session={session} />
      ) : (
        <div style={styles.waitingMessage}>
          ⏳ Waiting for vote to finalize...
        </div>
      )}

      {/* Vote integrity warning */}
      {!voteIntegrity.valid && (
        <div style={styles.warning}>
          ⚠ Integrity issues detected:
          {voteIntegrity.issues.map((issue, idx) => (
            <div key={idx} style={styles.warningItem}>{issue}</div>
          ))}
        </div>
      )}

      {/* Voted peers list */}
      {currentVotes.length > 0 && (
        <VotersPanel votes={currentVotes} />
      )}
    </div>
  );
};

// ============================================================================
// RESULTS PANEL
// ============================================================================

interface ResultsPanelProps {
  result: VoteResult;
  session: VoteSession;
}

const ResultsPanel: React.FC<ResultsPanelProps> = ({ result, session }) => {
  return (
    <div
      style={{
        ...styles.resultsPanel,
        backgroundColor: result.passed
          ? 'rgba(16, 185, 129, 0.1)'
          : 'rgba(239, 68, 68, 0.1)',
        borderColor: result.passed ? '#10b981' : '#ef4444'
      }}
    >
      <div style={styles.resultsTitle}>
        {result.passed ? '✨ VOTE PASSED' : '✗ VOTE FAILED'}
      </div>

      <div style={styles.resultsStats}>
        <div>
          <span style={{ color: '#9ca3af' }}>Final Results:</span>
        </div>
        <div>
          <span style={{ color: '#34d399' }}>Yes: {result.yesCount}</span>
          <span style={{ marginLeft: '12px', color: '#ef4444' }}>No: {result.noCount}</span>
          <span style={{ marginLeft: '12px', color: '#9ca3af' }}>Abstain: {result.abstainCount}</span>
        </div>
        <div>
          <span style={{ color: '#fbbf24' }}>Threshold: {Math.round(session.threshold * 100)}%</span>
          <span style={{ marginLeft: '12px', color: '#a78bfa' }}>
            Result: {result.actualPercentage.toFixed(1)}%
          </span>
        </div>
      </div>

      {result.passed && (
        <div style={styles.passedMessage}>
          Vote has passed! Action will be executed within the next epoch.
        </div>
      )}
    </div>
  );
};

// ============================================================================
// VOTERS PANEL
// ============================================================================

interface VotersPanelProps {
  votes: PeerVote[];
}

const VotersPanel: React.FC<VotersPanelProps> = ({ votes }) => {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        style={styles.expandVotersButton}
        onClick={() => setExpanded(true)}
      >
        Show {votes.length} voter(s)
      </button>
    );
  }

  return (
    <div style={styles.votersPanel}>
      <button
        style={styles.collapseButton}
        onClick={() => setExpanded(false)}
      >
        Hide voters
      </button>
      <div style={styles.votersList}>
        {votes.map((vote) => (
          <div key={vote.peerId} style={styles.voterItem}>
            <span style={styles.voterName}>{vote.peerName}</span>
            <span
              style={{
                ...styles.voterVote,
                color:
                  vote.vote === 'yes'
                    ? '#34d399'
                    : vote.vote === 'no'
                      ? '#ef4444'
                      : '#9ca3af'
              }}
            >
              {vote.vote === 'yes' ? '✓' : vote.vote === 'no' ? '✗' : '≈'} {vote.vote}
            </span>
            {vote.reason && (
              <span style={styles.voterReason}>"{vote.reason}"</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function formatVoteType(voteType: string): string {
  const labels: Record<string, string> = {
    'world_reset': '🌍 World Reset',
    'holiday_event': '🎉 Holiday Event',
    'trade_conflict': '💱 Trade Dispute',
    'faction_war_truce': '🕊 Faction Truce'
  };
  return labels[voteType] || voteType;
}

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '16px',
    backgroundColor: '#1a1a2e',
    border: '2px solid #fbbf24',
    borderRadius: '8px',
    fontFamily: 'monospace',
    color: '#e5e7eb',
    maxWidth: '600px',
    boxShadow: '0 0 20px rgba(251, 191, 36, 0.2)'
  },

  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    borderBottom: '1px solid #fbbf24',
    paddingBottom: '8px'
  },

  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fbbf24'
  },

  voteType: {
    fontSize: '12px',
    color: '#9ca3af',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    padding: '4px 8px',
    borderRadius: '4px'
  },

  description: {
    fontSize: '12px',
    color: '#d1d5db',
    marginBottom: '12px',
    padding: '8px',
    backgroundColor: 'rgba(107, 114, 128, 0.2)',
    borderRadius: '4px',
    borderLeft: '2px solid #a78bfa'
  },

  stats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px'
  },

  stat: {
    padding: '8px',
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold'
  },

  progressContainer: {
    marginBottom: '12px'
  },

  progressBar: {
    height: '6px',
    backgroundColor: '#374151',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px'
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#fbbf24',
    transition: 'width 0.3s ease'
  },

  progressLabel: {
    fontSize: '10px',
    color: '#9ca3af',
    textAlign: 'center'
  },

  timeRemaining: {
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: 'bold',
    marginBottom: '12px'
  },

  votingSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },

  reasonInput: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },

  textarea: {
    backgroundColor: '#374151',
    border: '1px solid #4b5563',
    color: '#e5e7eb',
    padding: '8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '11px',
    resize: 'vertical'
  },

  buttonGroup: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '8px'
  },

  buttonYes: {
    padding: '10px',
    backgroundColor: '#10b981',
    border: 'none',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },

  buttonNo: {
    padding: '10px',
    backgroundColor: '#ef4444',
    border: 'none',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },

  buttonAbstain: {
    padding: '10px',
    backgroundColor: '#6b7280',
    border: 'none',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s'
  },

  waitingMessage: {
    padding: '12px',
    textAlign: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.05)',
    borderRadius: '4px',
    color: '#fbbf24',
    fontWeight: 'bold'
  },

  warning: {
    padding: '12px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px dashed #ef4444',
    borderRadius: '4px',
    color: '#fca5a5',
    fontSize: '11px',
    marginTop: '12px'
  },

  warningItem: {
    marginTop: '4px',
    paddingLeft: '8px'
  },

  resultsPanel: {
    padding: '12px',
    borderRadius: '4px',
    border: '2px solid',
    marginTop: '12px'
  },

  resultsTitle: {
    fontWeight: 'bold',
    fontSize: '14px',
    marginBottom: '8px'
  },

  resultsStats: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '11px',
    marginBottom: '8px'
  },

  passedMessage: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: '8px',
    borderRadius: '4px',
    color: '#86efac',
    fontSize: '11px',
    textAlign: 'center'
  },

  expandVotersButton: {
    marginTop: '12px',
    width: '100%',
    padding: '8px',
    backgroundColor: '#374151',
    border: '1px solid #4b5563',
    color: '#a78bfa',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },

  collapseButton: {
    marginBottom: '8px',
    padding: '6px 12px',
    backgroundColor: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid #a78bfa',
    color: '#a78bfa',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '10px'
  },

  votersPanel: {
    marginTop: '12px',
    padding: '12px',
    backgroundColor: 'rgba(107, 114, 128, 0.1)',
    borderRadius: '4px'
  },

  votersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },

  voterItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px',
    backgroundColor: 'rgba(55, 65, 81, 0.3)',
    borderRadius: '4px',
    fontSize: '11px'
  },

  voterName: {
    fontWeight: 'bold',
    color: '#a78bfa',
    minWidth: '100px'
  },

  voterVote: {
    fontWeight: 'bold',
    minWidth: '60px'
  },

  voterReason: {
    color: '#9ca3af',
    fontStyle: 'italic',
    flex: 1
  }
};

export default ConflictResolutionUI;
