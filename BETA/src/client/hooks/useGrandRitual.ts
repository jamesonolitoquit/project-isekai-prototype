/**
 * Phase 4 Task 2: Grand Ritual Hook
 * 
 * Provides utilities for managing Grand Ritual voting lifecycle
 */

import { useCallback } from 'react';
import type { GrandRitual, RitualVote } from '../components/RitualConsensusUI';

/**
 * Hook for managing Grand Ritual state and voting
 */
export function useGrandRitual() {
  /**
   * Create a new Grand Ritual for voting
   */
  const createRitual = useCallback(
    (
      name: string,
      description: string,
      severity: 'minor' | 'major' | 'critical',
      initiatorId: string,
      initiatorName: string,
      peerIds: string[]
    ): GrandRitual => {
      const votes: RitualVote[] = peerIds.map(peerId => ({
        peerId,
        peerName: `Peer-${peerId.substring(0, 6)}`,
        vote: 'pending'
      }));

      return {
        id: `ritual-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name,
        description,
        severity,
        initiatorId,
        initiatorName,
        votes,
        createdAt: Date.now()
      };
    },
    []
  );

  /**
   * Check if ritual has consensus (>50%)
   */
  const hasConsensus = useCallback((ritual: GrandRitual): boolean => {
    const approveCount = ritual.votes.filter(v => v.vote === 'approve').length;
    const required = Math.floor(ritual.votes.length / 2) + 1;
    return approveCount >= required;
  }, []);

  /**
   * Check if voting is resolved (consensus or majority rejection)
   */
  const isVotingComplete = useCallback((ritual: GrandRitual): boolean => {
    const approveCount = ritual.votes.filter(v => v.vote === 'approve').length;
    const rejectCount = ritual.votes.filter(v => v.vote === 'reject').length;
    const required = Math.floor(ritual.votes.length / 2) + 1;
    
    return approveCount >= required || rejectCount > (ritual.votes.length - required);
  }, []);

  /**
   * Submit a vote for the ritual
   */
  const submitVote = useCallback(
    (ritual: GrandRitual, peerId: string, vote: 'approve' | 'reject'): GrandRitual => {
      return {
        ...ritual,
        votes: ritual.votes.map(v =>
          v.peerId === peerId
            ? { ...v, vote, timestamp: Date.now() }
            : v
        )
      };
    },
    []
  );

  /**
   * Get voting statistics
   */
  const getStats = useCallback(
    (ritual: GrandRitual) => {
      const approveCount = ritual.votes.filter(v => v.vote === 'approve').length;
      const rejectCount = ritual.votes.filter(v => v.vote === 'reject').length;
      const pendingCount = ritual.votes.filter(v => v.vote === 'pending').length;
      const required = Math.floor(ritual.votes.length / 2) + 1;

      return {
        approve: approveCount,
        reject: rejectCount,
        pending: pendingCount,
        required,
        total: ritual.votes.length,
        consensusPercentage: (approveCount / ritual.votes.length) * 100
      };
    },
    []
  );

  return {
    createRitual,
    hasConsensus,
    isVotingComplete,
    submitVote,
    getStats
  };
}

export default useGrandRitual;
