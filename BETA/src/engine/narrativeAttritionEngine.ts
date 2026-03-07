/**
 * Narrative Attrition Engine - Phase 9: Record Narrative Attrition
 * 
 * Implements the "Mental Scarring" system where NPCs accumulate permanent
 * SocialScars (Trauma, Glory, Betrayal) through long-term simulation cycles.
 * 
 * Rules:
 * - Once per epoch (1440 ticks), attempt to generate a new SocialScar for each NPC
 * - SocialScars modify future GOAP behavior and faction genealogy
 * - Scars are permanent and carry over through snapshots
 * - Different scar types have different effects on NPC behavior
 */

import type { WorldState, NPC } from './worldEngine';
import type { SocialScar } from './npcMemoryEngine';
import { SeededRng } from './prng';

export interface ScarGenerationRule {
  scarType: 'trauma' | 'betrayal' | 'shame' | 'regret' | 'guilt';
  successRate: number; // 0-1 probability per epoch
  triggerConditions: (npc: NPC, worldState: WorldState, rng: SeededRng) => boolean;
  scarMessage: (npc: NPC) => string;
}

/**
 * Get all scar generation rules
 */
function getScarGenerationRules(): ScarGenerationRule[] {
  return [
    {
      scarType: 'trauma',
      successRate: 0.05, // 5% chance per epoch
      triggerConditions: (npc, worldState, rng) => {
        // NPCs experiencing recent combat losses may develop trauma
        return (npc.hp ?? npc.maxHp ?? 100) < (npc.maxHp ?? 100) * 0.3;
      },
      scarMessage: (npc) => `${npc.name} has developed a haunting trauma from near-death experiences`
    },
    {
      scarType: 'betrayal',
      successRate: 0.06, // 6% chance per epoch
      triggerConditions: (npc, worldState, rng) => {
        // NPCs with low trust and high emotional resentment are prone to betrayal scars
        const trust = (npc.emotionalState?.trust ?? 50) / 100;
        const resentment = (npc.emotionalState?.resentment ?? 0) / 100;
        return trust < 0.4 && resentment > 0.5;
      },
      scarMessage: (npc) => `${npc.name} harbors deep resentment from past betrayals`
    },
    {
      scarType: 'shame',
      successRate: 0.04, // 4% chance per epoch
      triggerConditions: (npc, worldState, rng) => {
        // NPCs with low honesty and high caution may develop shame
        const honesty = (npc.personality?.honesty ?? 50) / 100;
        const caution = (npc.personality?.caution ?? 50) / 100;
        return honesty < 0.3 && caution > 0.7;
      },
      scarMessage: (npc) => `${npc.name} carries the weight of profound shame`
    },
    {
      scarType: 'regret',
      successRate: 0.05, // 5% chance per epoch
      triggerConditions: (npc, worldState, rng) => {
        // NPCs with negative emotional history may develop regret
        const fear = (npc.emotionalState?.fear ?? 0) / 100;
        const resentment = (npc.emotionalState?.resentment ?? 0) / 100;
        return (fear > 0.3 || resentment > 0.4) && (npc.socialScars?.length ?? 0) > 0;
      },
      scarMessage: (npc) => `${npc.name} carries the weight of lost opportunities and past mistakes`
    },
    {
      scarType: 'guilt',
      successRate: 0.05, // 5% chance per epoch
      triggerConditions: (npc, worldState, rng) => {
        // NPCs with high resentment and low honesty develop guilt
        const honesty = (npc.personality?.honesty ?? 50) / 100;
        const resentment = (npc.emotionalState?.resentment ?? 0) / 100;
        const worldParadox = (worldState.paradoxLevel ?? 0) / 100;
        return honesty < 0.4 && (resentment > 0.6 || worldParadox > 0.7);
      },
      scarMessage: (npc) => `${npc.name} has become consumed by guilt and corrupting influence`
    }
  ];
}

/**
 * Process narrative attrition for a single NPC
 * Attempts to generate a new SocialScar based on their state and conditions
 */
export function processNpcNarrativeAttrition(
  npc: NPC,
  worldState: WorldState,
  rng: SeededRng,
  epochNumber: number
): SocialScar | null {
  // Check if NPC already has a scar from recent epochs (prevent duplicates)
  const recentScar = npc.socialScars?.find(
    s => (worldState.tick ?? 0) - (s.createdAt ?? 0) < 1440
  );
  if (recentScar) {
    return null; // Already has a scar in this epoch
  }

  const rules = getScarGenerationRules();
  
  // Evaluate each scar type
  for (const rule of rules) {
    // Check trigger conditions
    if (!rule.triggerConditions(npc, worldState, rng)) {
      continue;
    }

    // Roll for success
    const roll = rng.next();
    if (roll > rule.successRate) {
      continue;
    }

    // Generate the scar - create a unique ID
    const scarId = `scar_${npc.id}_${worldState.tick ?? 0}`;
    
    const newScar: SocialScar = {
      id: scarId,
      npcId: npc.id,
      scarType: rule.scarType,
      description: rule.scarMessage(npc),
      severity: 50 + rng.next() * 50, // 50-100
      apparitionChance: 0.3,
      activeEffects: [rule.scarType],
      healingProgress: 0,
      createdAt: worldState.tick ?? 0,
      discoveryStatus: 'dormant'
    };

    return newScar;
  }

  return null; // No scar generated this epoch
}

/**
 * Batch process narrative attrition for all NPCs in the world
 * Called once per epoch to potentially create new scars
 */
export function processWorldNarrativeAttrition(
  state: WorldState,
  rng: SeededRng
): { scarsGenerated: number; affectedNpcs: Set<string> } {
  const epochNumber = Math.floor((state.tick ?? 0) / 1440);
  let scarsGenerated = 0;
  const affectedNpcs = new Set<string>();

  if (!state.npcs) return { scarsGenerated, affectedNpcs };

  for (const npc of state.npcs) {
    const newScar = processNpcNarrativeAttrition(npc, state, rng, epochNumber);
    
    if (newScar) {
      // Add scar to NPC
      if (!npc.socialScars) {
        npc.socialScars = [];
      }
      npc.socialScars.push(newScar);
      scarsGenerated++;
      affectedNpcs.add(npc.id);

      // Log the scar generation
      if (process.env.NODE_ENV === 'development') {
        console.log(`[NarrativeAttrition] Epoch ${epochNumber}: ${newScar.description}`);
      }
    }
  }

  return { scarsGenerated, affectedNpcs };
}

/**
 * Get the behavioral impact of a scar on an NPC
 * Used to modify personality and emotional traits
 * Returns modifiers (deltas) to be applied to personality values
 */
export function getScarBehavioralModifier(scar: SocialScar): {
  personalityMods?: Partial<{
    boldness: number;
    caution: number;
    sociability: number;
    ambition: number;
    curiosity: number;
    honesty: number;
  }>;
  emotionalMods?: Partial<{
    trust: number;
    fear: number;
    gratitude: number;
    resentment: number;
  }>;
} {
  const modifiers: {
    personalityMods?: Partial<{
      boldness: number;
      caution: number;
      sociability: number;
      ambition: number;
      curiosity: number;
      honesty: number;
    }>;
    emotionalMods?: Partial<{
      trust: number;
      fear: number;
      gratitude: number;
      resentment: number;
    }>;
  } = {};

  switch (scar.scarType) {
    case 'trauma':
      // Trauma reduces boldness, increases caution
      modifiers.personalityMods = { boldness: -15, caution: 15, ambition: -10 };
      modifiers.emotionalMods = { fear: 20, trust: -10 };
      break;
    case 'betrayal':
      // Betrayal reduces honesty and trust, increases resentment
      modifiers.personalityMods = { honesty: -25, caution: 10 };
      modifiers.emotionalMods = { trust: -25, resentment: 30 };
      break;
    case 'shame':
      // Shame reduces sociability, increases caution
      modifiers.personalityMods = { sociability: -20, caution: 15, honesty: 10 };
      modifiers.emotionalMods = { fear: 10, resentment: 15 };
      break;
    case 'regret':
      // Regret reduces boldness and ambition
      modifiers.personalityMods = { boldness: -15, ambition: -20, curiosity: -10 };
      modifiers.emotionalMods = { resentment: 15 };
      break;
    case 'guilt':
      // Guilt reduces honesty, increases caution and resentment
      modifiers.personalityMods = { honesty: -30, boldness: 20, ambition: 15, caution: -10 };
      modifiers.emotionalMods = { resentment: 20, trust: -20, gratitude: -15 };
      break;
    default:
      // Unknown scar type - apply conservative modifiers
      modifiers.personalityMods = { honesty: -10 };
      modifiers.emotionalMods = { resentment: 10 };
  }

  return modifiers;
}

/**
 * Apply all scars' behavioral modifiers to an NPC
 * Modifies the NPC's personality and emotional state based on accumulated scars
 */
export function applyAllScarModifiers(npc: NPC, scars: SocialScar[]): void {
  if (!scars || scars.length === 0) return;

  // Initialize personality if needed
  if (!npc.personality) {
    npc.personality = {
      boldness: 50,
      caution: 50,
      sociability: 50,
      ambition: 50,
      curiosity: 50,
      honesty: 50
    };
  }

  // Initialize emotional state if needed
  if (!npc.emotionalState) {
    npc.emotionalState = {
      trust: 50,
      fear: 0,
      gratitude: 0,
      resentment: 0
    };
  }

  // Apply modifiers from all scars
  for (const scar of scars) {
    const modifiers = getScarBehavioralModifier(scar);
    
    if (modifiers.personalityMods) {
      if (modifiers.personalityMods.boldness !== undefined) {
        npc.personality.boldness = Math.max(0, Math.min(100, (npc.personality.boldness ?? 50) + modifiers.personalityMods.boldness));
      }
      if (modifiers.personalityMods.caution !== undefined) {
        npc.personality.caution = Math.max(0, Math.min(100, (npc.personality.caution ?? 50) + modifiers.personalityMods.caution));
      }
      if (modifiers.personalityMods.sociability !== undefined) {
        npc.personality.sociability = Math.max(0, Math.min(100, (npc.personality.sociability ?? 50) + modifiers.personalityMods.sociability));
      }
      if (modifiers.personalityMods.ambition !== undefined) {
        npc.personality.ambition = Math.max(0, Math.min(100, (npc.personality.ambition ?? 50) + modifiers.personalityMods.ambition));
      }
      if (modifiers.personalityMods.curiosity !== undefined) {
        npc.personality.curiosity = Math.max(0, Math.min(100, (npc.personality.curiosity ?? 50) + modifiers.personalityMods.curiosity));
      }
      if (modifiers.personalityMods.honesty !== undefined) {
        npc.personality.honesty = Math.max(0, Math.min(100, (npc.personality.honesty ?? 50) + modifiers.personalityMods.honesty));
      }
    }

    if (modifiers.emotionalMods) {
      if (modifiers.emotionalMods.trust !== undefined) {
        npc.emotionalState.trust = Math.max(0, Math.min(100, (npc.emotionalState.trust ?? 50) + modifiers.emotionalMods.trust));
      }
      if (modifiers.emotionalMods.fear !== undefined) {
        npc.emotionalState.fear = Math.max(0, Math.min(100, (npc.emotionalState.fear ?? 0) + modifiers.emotionalMods.fear));
      }
      if (modifiers.emotionalMods.gratitude !== undefined) {
        npc.emotionalState.gratitude = Math.max(0, Math.min(100, (npc.emotionalState.gratitude ?? 0) + modifiers.emotionalMods.gratitude));
      }
      if (modifiers.emotionalMods.resentment !== undefined) {
        npc.emotionalState.resentment = Math.max(0, Math.min(100, (npc.emotionalState.resentment ?? 0) + modifiers.emotionalMods.resentment));
      }
    }
  }
}
