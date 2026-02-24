/**
 * M65: Political Favor System
 * 
 * Graveyard currency for NPC voting power with:
 * - SocialScar integration (political weight, public visibility)
 * - Faction power reduction from reputation damage
 * - Political hardening (loyalty can override charm)
 * - Integration with m63BConflictResolution voting
 * 
 * Central currency for NPC influence in political decisions.
 */

import { randomUUID } from 'node:crypto';
import { appendEvent } from '../events/mutationLog';

const uuid = () => randomUUID();

// ============================================================================
// TYPES: Political Favor & Social Scars
// ============================================================================

/**
 * Social scar: negative reputation event with political weight
 * Persists and affects future voting power
 */
export interface SocialScar {
  readonly scarId: string;
  readonly npcId: string;
  readonly incident: string;
  readonly severity: number; // 0-100
  readonly politicalWeight: number; // How much it affects voting power (0-100)
  readonly isPublic: boolean; // Visible to community?
  readonly createdAt: number;
  readonly resolvedAt?: number;
  readonly relatedFactionIds: string[]; // Which factions it damaged
}

/**
 * Political favor: currency for voting influence
 */
export interface PoliticalFavor {
  readonly favorId: string;
  readonly npcId: string;
  readonly amount: number; // 0-1000
  readonly source: 'trade' | 'alliance' | 'debt' | 'dominance' | 'loyalty';
  readonly expirable: boolean;
  readonly expiresAt?: number;
  readonly borrowedFrom?: string; // NPC who lent it
}

/**
 * Voting power calculation result
 */
export interface VotingPowerProfile {
  readonly npcId: string;
  readonly baseFavor: number;
  readonly scarReduction: number;
  readonly factionBonus: number;
  readonly hardenerBonus: number; // Loyalty override
  readonly finalVotingPower: number;
  readonly canCastVote: boolean;
  readonly canVetoVote: boolean;
}

/**
 * Political faction power summary
 */
export interface FactionPowerState {
  readonly factionId: string;
  readonly baseMembers: number;
  readonly totalVotingPower: number;
  readonly scarDamage: number; // Total reduction from scars
  readonly loyaltyHardener: number; // Loyalty override bonus
  readonly effectiveVotingPower: number;
}

// ============================================================================
// POLITICAL FAVOR ENGINE: Core Operations
// ============================================================================

let activeFavors = new Map<string, PoliticalFavor[]>(); // npcId -> favors
let activeSocialScars = new Map<string, SocialScar[]>(); // npcId -> scars
let factionLoyaltyHardeners = new Map<string, number>(); // npcId -> hardener score

/**
 * Award political favor to an NPC
 * 
 * @param npcId NPC to award
 * @param amount Favor amount (1-500)
 * @param source How it was earned
 * @param borrowedFrom Optional: NPC who gifted it as debt
 * @returns Created favor object
 */
export function awardPoliticalFavor(
  npcId: string,
  amount: number,
  source: 'trade' | 'alliance' | 'debt' | 'dominance' | 'loyalty' = 'alliance',
  borrowedFrom?: string
): PoliticalFavor {
  const favor: PoliticalFavor = {
    favorId: `favor_${uuid()}`,
    npcId,
    amount: Math.max(1, Math.min(500, amount)),
    source,
    expirable: source === 'debt' || source === 'loyalty',
    expiresAt: source === 'debt' ? Date.now() + 30 * 24 * 60 * 60 * 1000 : undefined, // 30 days for debt
    borrowedFrom
  };

  if (!activeFavors.has(npcId)) {
    activeFavors.set(npcId, []);
  }
  const favors = activeFavors.get(npcId);
  if (favors) {
    favors.push(favor);
  }

  return favor;
}

/**
 * Spend political favor
 * 
 * @param npcId NPC spending favor
 * @param amount Amount to spend
 * @param purpose What it's used for
 * @returns Success and remaining favor
 */
export function spendPoliticalFavor(
  npcId: string,
  amount: number,
  purpose: string
): { success: boolean; remaining: number } {
  const favors = activeFavors.get(npcId) || [];
  let total = 0;

  for (const favor of favors) {
    if (!favor.expirable || (favor.expiresAt && favor.expiresAt > Date.now())) {
      total += favor.amount;
    }
  }

  if (total < amount) {
    return { success: false, remaining: total };
  }

  // Spend in order (oldest first)
  let toSpend = amount;
  const updatedFavors = favors.map((favor) => {
    if (toSpend === 0) return favor;
    if (!favor.expirable || (favor.expiresAt && favor.expiresAt > Date.now())) {
      const spent = Math.min(favor.amount, toSpend);
      toSpend -= spent;
      if (spent > 0) {
        return {
          favorId: favor.favorId,
          npcId: favor.npcId,
          amount: favor.amount - spent,
          source: favor.source,
          expirable: favor.expirable,
          expiresAt: favor.expiresAt,
          borrowedFrom: favor.borrowedFrom
        };
      }
    }
    return favor;
  });

  // Clean up empty favors and update
  activeFavors.set(npcId, updatedFavors.filter((f) => f.amount > 0));

  return { success: true, remaining: total - amount };
}

/**
 * Register a social scar for an NPC
 * Damages political reputation
 * 
 * @param npcId Affected NPC
 * @param incident Description
 * @param severity Incident severity (0-100)
 * @param politicalWeight How much it reduces voting (0-100)
 * @param isPublic Is it known?
 * @param relatedFactions Factions damaged by this
 * @returns Created social scar
 */
export function registerSocialScar(
  npcId: string,
  incident: string,
  severity: number,
  politicalWeight: number,
  isPublic: boolean,
  relatedFactions: string[] = []
): SocialScar {
  const scar: SocialScar = {
    scarId: `scar_${uuid()}`,
    npcId,
    incident,
    severity: Math.max(0, Math.min(100, severity)),
    politicalWeight: Math.max(0, Math.min(100, politicalWeight)),
    isPublic,
    createdAt: Date.now(),
    relatedFactionIds: relatedFactions
  };

  if (!activeSocialScars.has(npcId)) {
    activeSocialScars.set(npcId, []);
  }
  const scars = activeSocialScars.get(npcId);
  if (scars) {
    scars.push(scar);
  }

  return scar;
}

/**
 * Resolve a social scar (forgive it with time/apology)
 * 
 * @param scarId Scar to resolve
 * @param resolutionMethod How it was resolved
 */
export function resolveSocialScar(scarId: string, resolutionMethod: string): void {
  for (const [npcId, scars] of activeSocialScars.entries()) {
    const scarIndex = scars.findIndex((s) => s.scarId === scarId);
    if (scarIndex !== -1) {
      const scar = scars[scarIndex];
      const resolved: SocialScar = {
        scarId: scar.scarId,
        npcId: scar.npcId,
        incident: scar.incident,
        severity: scar.severity,
        politicalWeight: scar.politicalWeight,
        isPublic: scar.isPublic,
        createdAt: scar.createdAt,
        resolvedAt: Date.now(),
        relatedFactionIds: scar.relatedFactionIds
      };
      const updated = scars.map((s, idx) => idx === scarIndex ? resolved : s);
      activeSocialScars.set(npcId, updated);
      break;
    }
  }
}

/**
 * Calculate total political favor available
 * 
 * @param npcId NPC to check
 * @returns Total favor (expired ones removed)
 */
export function getTotalPoliticalFavor(npcId: string): number {
  const favors = activeFavors.get(npcId) || [];
  let total = 0;

  for (const favor of favors) {
    // Check expiration
    if (favor.expirable && favor.expiresAt && favor.expiresAt <= Date.now()) {
      // Favor expired, remove it
      continue;
    }
    total += favor.amount;
  }

  // Clean up expired
  activeFavors.set(npcId, favors.filter((f) => !f.expirable || !f.expiresAt || f.expiresAt > Date.now()));

  return total;
}

/**
 * Calculate active unresolved social scars
 * 
 * @param npcId NPC to check
 * @returns Total scar political damage
 */
export function getActiveScarDamage(npcId: string): number {
  const scars = activeSocialScars.get(npcId) || [];
  let damage = 0;

  for (const scar of scars) {
    if (!scar.resolvedAt) {
      damage += scar.politicalWeight;
    }
  }

  return Math.min(damage, 100); // Cap at -100
}

/**
 * Get loyalty hardener score
 * Loyalty can override charm/negative reputation
 * 
 * @param npcId NPC to check
 * @returns Hardener score (0-50, adds to voting power)
 */
export function getLoyaltyHardener(npcId: string): number {
  return factionLoyaltyHardeners.get(npcId) || 0;
}

/**
 * Apply loyalty hardening
 * Increases voting power based on faction loyalty
 * 
 * @param npcId NPC to harden
 * @param loyaltyLevel Faction loyalty (0-100)
 * @returns New hardener score
 */
export function applyLoyaltyHardening(npcId: string, loyaltyLevel: number): number {
  // Loyalty over 80 grants hardening bonus (converts to +10 to +50)
  const hardener = loyaltyLevel > 80 ? Math.max(10, (loyaltyLevel - 80) * 2.5) : 0;
  factionLoyaltyHardeners.set(npcId, hardener);
  return hardener;
}

/**
 * Calculate complete voting power profile for an NPC
 * 
 * @param npcId NPC to profile
 * @param influenceBonus Optional: influence score to add (0-100)
 * @returns Complete voting power calculation
 */
export function calculateVotingPower(npcId: string, influenceBonus: number = 0): VotingPowerProfile {
  const baseFavor = getTotalPoliticalFavor(npcId);
  const scarReduction = getActiveScarDamage(npcId) * -1; // Negative
  const hardenerBonus = getLoyaltyHardener(npcId);

  // Faction bonus is embedded in baseFavor
  const factionBonus = Math.round(influenceBonus);

  // Final calculation: base + scar reduction + hardener + faction
  const finalVotingPower = Math.max(0, baseFavor + scarReduction + hardenerBonus + factionBonus);

  // Can cast veto if voting power > 200 (high influence)
  const canVetoVote = finalVotingPower > 200;

  return {
    npcId,
    baseFavor,
    scarReduction,
    factionBonus,
    hardenerBonus,
    finalVotingPower,
    canCastVote: finalVotingPower > 0,
    canVetoVote
  };
}

/**
 * Calculate faction-wide power state
 * 
 * @param factionId Faction to analyze
 * @param memberNpcIds Array of member NPC IDs
 * @returns Faction power summary
 */
export function calculateFactionPowerState(
  factionId: string,
  memberNpcIds: string[]
): FactionPowerState {
  let totalVoting = 0;
  let totalScarDamage = 0;
  let totalLoyaltyHardener = 0;

  for (const npcId of memberNpcIds) {
    totalVoting += getTotalPoliticalFavor(npcId);
    totalScarDamage += getActiveScarDamage(npcId);
    totalLoyaltyHardener += getLoyaltyHardener(npcId);
  }

  const effectiveVotingPower = Math.max(0, totalVoting - totalScarDamage + totalLoyaltyHardener);

  return {
    factionId,
    baseMembers: memberNpcIds.length,
    totalVotingPower: totalVoting,
    scarDamage: totalScarDamage,
    loyaltyHardener: totalLoyaltyHardener,
    effectiveVotingPower
  };
}

/**
 * Get all social scars for an NPC
 * 
 * @param npcId NPC to check
 * @returns Array of scars (active and resolved)
 */
export function getNPCSocialScars(npcId: string): SocialScar[] {
  return activeSocialScars.get(npcId) || [];
}

/**
 * Get all political favor for an NPC
 * 
 * @param npcId NPC to check
 * @returns Array of favor objects
 */
export function getNPCPoliticalFavors(npcId: string): PoliticalFavor[] {
  const favors = activeFavors.get(npcId) || [];
  // Filter out expired
  return favors.filter((f) => !f.expirable || !f.expiresAt || f.expiresAt > Date.now());
}

/**
 * Transfer political favor between NPCs
 * Models favor trading/gifting
 * 
 * @param fromNpcId Giver
 * @param toNpcId Recipient
 * @param amount Favor amount
 * @returns Success and reason
 */
export function transferPoliticalFavor(
  fromNpcId: string,
  toNpcId: string,
  amount: number
): { success: boolean; reason: string } {
  const currentFavor = getTotalPoliticalFavor(fromNpcId);

  if (currentFavor < amount) {
    return { success: false, reason: `Insufficient favor: ${currentFavor} < ${amount}` };
  }

  // Spend from giver
  const spendResult = spendPoliticalFavor(fromNpcId, amount, `Transfer to ${toNpcId}`);
  if (!spendResult.success) {
    return { success: false, reason: 'Failed to spend favor' };
  }

  // Award to recipient as debt (favor they owe)
  awardPoliticalFavor(toNpcId, amount, 'debt', fromNpcId);

  return { success: true, reason: 'Transfer complete' };
}

/**
 * Get summary of all active political states
 * 
 * @returns High-level statistics
 */
export function getPoliticalSummary(): {
  totalActiveNPCs: number;
  totalFavorInCirculation: number;
  totalActiveScarDamage: number;
  averageVotingPower: number;
} {
  let totalFavor = 0;
  let totalDamage = 0;
  let npcCount = 0;

  for (const favors of activeFavors.values()) {
    for (const favor of favors) {
      if (!favor.expirable || !favor.expiresAt || favor.expiresAt > Date.now()) {
        totalFavor += favor.amount;
      }
    }
  }

  for (const scars of activeSocialScars.values()) {
    for (const scar of scars) {
      if (!scar.resolvedAt) {
        totalDamage += scar.politicalWeight;
      }
    }
  }

  npcCount = Math.max(activeFavors.size, activeSocialScars.size);
  const averageVoting = npcCount > 0 ? totalFavor / npcCount : 0;

  return {
    totalActiveNPCs: npcCount,
    totalFavorInCirculation: totalFavor,
    totalActiveScarDamage: totalDamage,
    averageVotingPower: averageVoting
  };
}

/**
 * Clear all political state (for testing/session reset)
 */
export function clearPoliticalState(): void {
  activeFavors.clear();
  activeSocialScars.clear();
  factionLoyaltyHardeners.clear();
}
