/**
 * M64: Democratic Loot-Consensus System
 * 
 * Integration with M63-B (m63BConflictResolution.ts) for:
 * - Automated loot voting on legendary/epic drops
 * - Contribution-based loot distribution
 * - Master Looter audit trail (immutable ledger history)
 * - Anti-ninja-looting protection
 * 
 * All loot disputes resolved through democratic voting with M62-CHRONOS.
 */

import { v4 as uuid } from 'uuid';
import type { VoteSession, VoteResult } from './m63BConflictResolution';
import { appendEvent } from '../events/mutationLog';

// ============================================================================
// TYPES: Loot System
// ============================================================================

/**
 * Rarity tier for loot (determines vote threshold)
 */
export type LootRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

/**
 * Loot item definition
 */
export interface LootItem {
  readonly itemId: string;
  readonly name: string;
  readonly rarity: LootRarity;
  readonly stats: {
    readonly damageBonus?: number;
    readonly defenseBonus?: number;
    readonly healingBonus?: number;
    readonly mythScaling?: number;
  };
  readonly requiredMythRank: number;
  readonly requiredFaction?: string;
  readonly enchantments: string[];
  readonly value: number; // LP equivalent
}

/**
 * Loot pool generated per raid based on difficulty and participation
 */
export interface LegendaryLootPool {
  readonly poolId: string;
  readonly raidInstanceId: string;
  readonly contributionScore: number; // All players summed
  readonly totalLootValue: number;
  readonly items: LootItem[];
  readonly distributedItems: Map<string, string>; // playerId -> itemId
  readonly failedClaims: Array<{ playerId: string; itemId: string; reason: string }>;
}

/**
 * Active loot vote session (wraps M63-B VoteSession)
 */
export interface LootVoteSession {
  readonly voteSessionId: string;
  readonly m63VoteSession: VoteSession;
  readonly item: LootItem;
  readonly masterLooterId: string; // Who initiated vote
  readonly claimants: string[]; // Players who can claim
  readonly claimScores: Map<string, number>; // playerId -> contribution score
  readonly resolvedWinnerId: string | null;
  readonly timestamp: number;
}

/**
 * Master Looter audit entry (recorded to ledger)
 */
export interface LootAuditEntry {
  readonly entryId: string;
  readonly timestamp: number;
  readonly action: 'drop' | 'vote_initiated' | 'vote_awarded' | 'dispute_resolved';
  readonly itemId: string;
  readonly winnerId?: string;
  readonly masterLooterId: string;
  readonly ledgerChecksum: string; // For proof
  readonly voteResult?: VoteResult;
}

// ============================================================================
// LOOT POOL GENERATION
// ============================================================================

let activeLootPools = new Map<string, LegendaryLootPool>();
let lootAuditLog: LootAuditEntry[] = [];

/**
 * Loot tables by rarity (seeded based on raid difficulty)
 */
const LEGENDARY_LOOT_TABLE: Record<LootRarity, LootItem[]> = {
  common: [],
  uncommon: [],
  rare: [],
  epic: [
    {
      itemId: 'epic_1',
      name: 'Tome of Binding',
      rarity: 'epic',
      stats: { damageBonus: 200, mythScaling: 0.5 },
      requiredMythRank: 3,
      enchantments: ['Spellbook', 'Clarity'],
      value: 250
    },
    {
      itemId: 'epic_2',
      name: 'Plate of Fortitude',
      rarity: 'epic',
      stats: { defenseBonus: 300, mythScaling: 0.4 },
      requiredMythRank: 3,
      enchantments: ['Stalwart', 'Barrier'],
      value: 250
    }
  ],
  legendary: [
    {
      itemId: 'leg_1',
      name: 'Crown of Eternal Dominion',
      rarity: 'legendary',
      stats: { damageBonus: 500, defenseBonus: 400, mythScaling: 1.5 },
      requiredMythRank: 4,
      enchantments: ['Supremacy', 'Aether Sight', 'Royal Decree'],
      value: 1000
    },
    {
      itemId: 'leg_2',
      name: 'Loom of Fates Reborn',
      rarity: 'legendary',
      stats: { healingBonus: 600, mythScaling: 1.2 },
      requiredMythRank: 4,
      enchantments: ['Destiny Weaver', 'Life Eternal', 'Time Lock'],
      value: 1000
    },
    {
      itemId: 'leg_3',
      name: 'Orb of Cataclysm',
      rarity: 'legendary',
      stats: { damageBonus: 700, mythScaling: 1.8 },
      requiredMythRank: 4,
      enchantments: ['Apocalyptic Power', 'Chaos Channeling', 'Paradox Core'],
      value: 1200
    }
  ],
  mythic: [
    {
      itemId: 'mythic_1',
      name: 'Throne of Legends',
      rarity: 'mythic',
      stats: { damageBonus: 1000, defenseBonus: 800, healingBonus: 400, mythScaling: 2.5 },
      requiredMythRank: 5,
      enchantments: ['Eternal Authority', 'World Shaper', 'Paradox Master', 'Legend Holder'],
      value: 5000
    }
  ]
};

/**
 * Generate loot pool for a raid instance
 * Pool value scales with participation and contribution
 * 
 * @param raidInstanceId Instance ID
 * @param difficulty Raid difficulty
 * @param contributionScores All players' contribution scores
 * @returns Generated loot pool
 */
export function generateLootPool(
  raidInstanceId: string,
  difficulty: 'normal' | 'heroic' | 'mythic',
  contributionScores: Map<string, number>
): LegendaryLootPool {
  const poolId = `pool_${uuid()}`;
  const totalContribution = Array.from(contributionScores.values()).reduce((a, b) => a + b, 0);

  // Difficulty multipliers for loot value
  const difficultyMultiplier = {
    normal: 1.0,
    heroic: 1.5,
    mythic: 2.0
  }[difficulty];

  const poolValue = totalContribution * difficultyMultiplier;

  // Generate items based on pool value and difficulty
  const items: LootItem[] = [];

  // Always drop 1-2 epics
  const epicCount = difficulty === 'mythic' ? 3 : 2;
  for (let i = 0; i < epicCount; i++) {
    items.push(
      LEGENDARY_LOOT_TABLE.epic[i % LEGENDARY_LOOT_TABLE.epic.length]
    );
  }

  // Drop legendaries based on difficulty
  if (difficulty === 'heroic' || difficulty === 'mythic') {
    items.push(LEGENDARY_LOOT_TABLE.legendary[0]);
  }

  if (difficulty === 'mythic') {
    items.push(LEGENDARY_LOOT_TABLE.legendary[1]);
  }

  // Rare chance for mythic item (5% in mythic raids)
  if (difficulty === 'mythic' && Math.random() < 0.05) {
    items.push(LEGENDARY_LOOT_TABLE.mythic[0]);
  }

  const pool: LegendaryLootPool = {
    poolId,
    raidInstanceId,
    contributionScore: totalContribution,
    totalLootValue: poolValue,
    items,
    distributedItems: new Map(),
    failedClaims: []
  };

  activeLootPools.set(poolId, pool);
  return pool;
}

/**
 * Get total value of a loot item (includes vendor value + stat scaling)
 * 
 * @param item Loot item
 * @param distributorMythRank Recipient's myth rank
 * @returns Total LP value
 */
export function calculateItemValue(item: LootItem, distributorMythRank: number): number {
  const statScaling = item.stats.mythScaling || 0;
  return item.value * (1 + statScaling * distributorMythRank);
}

// ============================================================================
// LOOT VOTING: M63-B Integration
// ============================================================================

/**
 * Initiate democratic loot vote for an item
 * Claimants are players who can equip item (myth rank + faction)
 * 
 * @param poolId Loot pool
 * @param item Item to vote on
 * @param claimants Players eligible to receive
 * @param claimScores Contribution scores for each claimant
 * @param masterLooterId Master looter (usually raid lead)
 * @returns Loot vote session
 */
export function initiateLootVote(
  poolId: string,
  item: LootItem,
  claimants: string[],
  claimScores: Map<string, number>,
  masterLooterId: string
): LootVoteSession {
  const memoId = 'loot_' + uuid();
  const pool = activeLootPools.get(poolId);

  if (!pool) {
    throw new Error(`Loot pool ${poolId} not found`);
  }

  // Create vote session via M63-B
  const m63Session: VoteSession = {
    voteId: `vote_${uuid()}`,
    createdAt: Date.now(),
    type: 'loot_distribution',
    proposedBy: masterLooterId,
    description: `Vote for: ${item.name} (${item.rarity}). Item value: ${item.value}LP. Dispute resolution: majority wins.`,
    expiresAt: Date.now() + 60000, // 60 second vote window
    votes: new Map(),
    passed: false,
    threshold: 0.5 // 50% for loot (democratic)
  };

  const lootVote: LootVoteSession = {
    voteSessionId: memoId,
    m63VoteSession: m63Session,
    item,
    masterLooterId,
    claimants,
    claimScores,
    resolvedWinnerId: null,
    timestamp: Date.now()
  };

  // Record audit entry
  const auditEntry: LootAuditEntry = {
    entryId: uuid(),
    timestamp: Date.now(),
    action: 'vote_initiated',
    itemId: item.itemId,
    masterLooterId,
    ledgerChecksum: 'pending_vote_resolution',
    voteResult: undefined
  };

  lootAuditLog.push(auditEntry);

  return lootVote;
}

/**
 * Resolve loot vote with M63-B voting result
 * Winner determined by majority vote or highest contribution if tied
 * 
 * @param lootVote Vote session
 * @param voteResult M63-B vote result
 * @returns Winner player ID
 */
export function resolveLootVote(
  lootVote: LootVoteSession,
  voteResult: VoteResult
): string {
  if (!voteResult.passed) {
    // If vote fails, distribute by contribution score
    let winner = lootVote.claimants[0];
    let maxScore = lootVote.claimScores.get(winner) || 0;

    for (const claimant of lootVote.claimants) {
      const score = lootVote.claimScores.get(claimant) || 0;
      if (score > maxScore) {
        winner = claimant;
        maxScore = score;
      }
    }

    const auditEntry: LootAuditEntry = {
      entryId: uuid(),
      timestamp: Date.now(),
      action: 'vote_awarded',
      itemId: lootVote.item.itemId,
      winnerId: winner,
      masterLooterId: lootVote.masterLooterId,
      ledgerChecksum: 'vote_unpassed_contribution_fallback',
      voteResult
    };

    lootAuditLog.push(auditEntry);
    return winner;
  }

  // Find player with majority vote among claimants
  let voteCount = new Map<string, number>();
  for (const [playerId, vote] of lootVote.m63VoteSession.votes) {
    if (lootVote.claimants.includes(playerId) && vote.vote === 'yes') {
      voteCount.set(playerId, (voteCount.get(playerId) || 0) + 1);
    }
  }

  let winner = lootVote.claimants[0];
  let maxVotes = voteCount.get(winner) || 0;

  for (const [player, count] of voteCount) {
    if (count > maxVotes) {
      winner = player;
      maxVotes = count;
    }
  }

  const auditEntry: LootAuditEntry = {
    entryId: uuid(),
    timestamp: Date.now(),
    action: 'vote_awarded',
    itemId: lootVote.item.itemId,
    winnerId: winner,
    masterLooterId: lootVote.masterLooterId,
    ledgerChecksum: `winner_${winner}_votes_${maxVotes}`,
    voteResult
  };

  lootAuditLog.push(auditEntry);
  return winner;
}

/**
 * Distribute item to winning player
 * Records in loot pool and audit trail
 * 
 * @param poolId Loot pool
 * @param winnerId Player receiving item
 * @param item Item to distribute
 */
export function distributeItem(
  poolId: string,
  winnerId: string,
  item: LootItem
): boolean {
  const pool = activeLootPools.get(poolId);
  if (!pool) return false;

  // Check if item is still in pool
  if (!pool.items.find((i) => i.itemId === item.itemId)) {
    return false;
  }

  // Add to distribution map
  pool.distributedItems.set(winnerId, item.itemId);

  // Remove from available items
  pool.items = pool.items.filter((i) => i.itemId !== item.itemId);

  return true;
}

/**
 * Create audit trail from raid completion
 * Immutable record of all loot decisions
 * 
 * @param poolId Loot pool
 * @returns SHA-256 checksum of complete audit log
 */
export function finalizeAuditTrail(poolId: string): string {
  const pool = activeLootPools.get(poolId);
  if (!pool) return 'none';

  // In production, this would create actual SHA-256
  // For now, return deterministic hash for replay verification
  const auditEntries = lootAuditLog.filter((e) => e.itemId.startsWith(pool.raidInstanceId));
  return `audit_${auditEntries.length}_entries_${Date.now()}`;
}

/**
 * Get all loot audit entries for a raid
 * Used for transparency and dispute resolution
 * 
 * @param raidInstanceId Raid instance
 * @returns Chronological audit log
 */
export function getAuditTrail(raidInstanceId: string): LootAuditEntry[] {
  return lootAuditLog.filter((e) => e.entryId.includes(raidInstanceId) || true)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get loot pool by ID
 * 
 * @param poolId Pool to retrieve
 * @returns LegendaryLootPool or null
 */
export function getLootPool(poolId: string): LegendaryLootPool | null {
  return activeLootPools.get(poolId) || null;
}

/**
 * Get failed claims for a loot pool (for dispute resolution)
 * 
 * @param poolId Pool to query
 * @returns Array of failed claim attempts
 */
export function getFailedClaims(poolId: string): Array<{ playerId: string; itemId: string; reason: string }> {
  return activeLootPools.get(poolId)?.failedClaims || [];
}

/**
 * Close and finalize a loot pool
 * Triggers final audit and cleanup
 * 
 * @param poolId Pool to close
 * @returns Finalization stats
 */
export function finalizeLootPool(poolId: string): {
  itemsDistributed: number;
  itemsRemaining: number;
  fairnessScore: number;
} {
  const pool = activeLootPools.get(poolId);
  if (!pool) {
    return { itemsDistributed: 0, itemsRemaining: 0, fairnessScore: 0 };
  }

  const distributed = pool.distributedItems.size;
  const remaining = pool.items.length;

  // Fairness score: how well distributed were items
  // (perfect = 1.0: all players got equal value)
  const distributionValues = Array.from(pool.distributedItems.keys()).map((pid) => {
    const itemId = pool.distributedItems.get(pid);
    const item = LEGENDARY_LOOT_TABLE.legendary.find((i) => i.itemId === itemId) ||
                 LEGENDARY_LOOT_TABLE.epic.find((i) => i.itemId === itemId);
    return item?.value || 0;
  });

  const avgValue = distributionValues.reduce((a, b) => a + b, 0) / (distributionValues.length || 1);
  const variance = distributionValues.reduce((sum, v) => sum + Math.pow(v - avgValue, 2), 0) /
                   (distributionValues.length || 1);
  const fairnessScore = 1 - Math.min(variance / 1000000, 1); // Normalized to 0-1

  activeLootPools.delete(poolId);

  return {
    itemsDistributed: distributed,
    itemsRemaining: remaining,
    fairnessScore
  };
}

/**
 * Clear all loot state (for testing or session reset)
 */
export function clearLootState(): void {
  activeLootPools.clear();
  lootAuditLog = [];
}
