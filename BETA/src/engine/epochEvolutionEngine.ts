/**
 * Phase 20: Epoch Evolution Engine
 * 
 * Purpose: Handle complex world mutations during epoch transitions
 * - Material Ascension: Evolve player inventory items into higher forms
 * - Bloodline Divergence: Mutate NPC traits and faction influence based on paradox
 * - Environmental Transformation: Biome shifts and location changes
 * 
 * This engine is called by chronicleEngine.advanceToNextEpoch() to ensure
 * thousands of years of history don't collapse into generic states.
 */

import type { WorldState, NPC, InventoryItem } from './worldEngine';
import { getWorldTemplate } from './worldEngine';
import { SeededRng } from './prng';

/**
 * Material Ascension Definition from world template
 */
export interface EvolutionPath {
  originalItemId: string;
  resultItemId: string;
  description?: string;
  preserveProperties?: string[]; // Properties like 'sentience', 'xp' to preserve
}

/**
 * Bloodline Divergence Definition
 */
export interface BloodlineDivergence {
  lineageId: string;
  divergentPaths: DivergentPath[];
  description?: string;
}

export interface DivergentPath {
  npcTraitChanges: Record<string, any>; // Map of trait names to new values
  probabilityThreshold: number; // Paradox level threshold for this path (0-100)
  factionInfluenceShift?: Record<string, number>; // Faction influence deltas
}

/**
 * Material Ascension: Evolve player inventory items
 * Transforms items based on evolution paths defined in world template
 * Preserves key properties like sentience and XP
 */
export function applyMaterialEvolution(
  state: WorldState,
  rng: SeededRng,
  generationalParadox: number
): WorldState {
  if (!state.player?.inventory || state.player.inventory.length === 0) {
    return state;
  }

  const template = getWorldTemplate();
  
  // Phase 20 Enhancement: Prefer top-level evolutionPaths if epoch-specific ones aren't found
  const currentEpoch = state.epochId;
  const templateEpoch = template?.epochs?.[currentEpoch || 'epoch_i_fracture'];
  
  // Find ALL applicable evolution paths
  const allEvolutionPaths: EvolutionPath[] = [];
  
  // 1. Check Epoch-specific rules (Highest priority)
  if (templateEpoch?.transitionRules) {
    for (const rule of templateEpoch.transitionRules) {
      if (rule.evolutionPaths) {
        allEvolutionPaths.push(...rule.evolutionPaths);
      }
    }
  }

  // 2. Check Global template paths (Fallback)
  if (allEvolutionPaths.length === 0 && template?.evolutionPaths) {
    allEvolutionPaths.push(...template.evolutionPaths);
  }
  
  if (allEvolutionPaths.length === 0) {
    return state;
  }

  // Apply material evolution to inventory
  const evolvedInventory: InventoryItem[] = state.player.inventory.map((item: any) => {
    // Find matching evolution path
    const evolutionPath = allEvolutionPaths.find(p => p.originalItemId === item.itemId);

    if (!evolutionPath) {
      return item; // No evolution for this item
    }

    // Create evolved item, preserving critical properties
    const evolvedItem = {
      ...item,
      itemId: evolutionPath.resultItemId,
      evolvedFromItemId: item.itemId,
      evolvedAtGenerationalParadox: generationalParadox,
      evolvedAtTick: state.tick || 0
    };

    // Preserve specified properties if they exist
    if (evolutionPath.preserveProperties) {
      for (const prop of evolutionPath.preserveProperties) {
        if (prop in item) {
          (evolvedItem as any)[prop] = (item as any)[prop];
        }
      }
    }

    console.log(
      `[epochEvolutionEngine] Material Ascension: ${item.itemId} (qty: ${item.quantity}) ` +
      `→ ${evolutionPath.resultItemId} | Paradox: ${generationalParadox}`
    );

    return evolvedItem;
  });

  return {
    ...state,
    player: {
      ...state.player,
      inventory: evolvedInventory
    }
  };
}

/**
 * Bloodline Divergence: Mutate NPC traits and faction influence
 * Changes NPC attributes based on accumulated generational paradox
 * Represents how species/lineages adapt or degrade over epochs
 */
export function applyBloodlineDivergence(
  state: WorldState,
  rng: SeededRng,
  generationalParadox: number
): WorldState {
  const template = getWorldTemplate();
  const stabilityThresholds = template?.stabilityThresholds || {
    WHISPER: 30,
    STRAIN: 60,
    FRACTURE: 90
  };

  // Determine divergence intensity based on paradox level
  let divergenceIntensity = 0;
  if (generationalParadox >= stabilityThresholds.FRACTURE) {
    divergenceIntensity = 0.9; // Severe mutations
  } else if (generationalParadox >= stabilityThresholds.STRAIN) {
    divergenceIntensity = 0.5; // Moderate mutations
  } else if (generationalParadox >= stabilityThresholds.WHISPER) {
    divergenceIntensity = 0.2; // Subtle mutations
  }

  // Apply bloodline divergence to factions
  const evolvedFactions = (state.factions || []).map((faction: any) => {
    const mutatedFaction = { ...faction };

    // Power score oscillation based on paradox
    const paradoxShift = rng.nextInt(-20, 20) * divergenceIntensity;
    mutatedFaction.powerScore = Math.max(
      5,
      Math.min(95, faction.powerScore + paradoxShift)
    );

    // Trait mutation: Change faction characteristics
    if (divergenceIntensity > 0) {
      // Factions can become more aggressive, defensive, or xenophobic
      if (!mutatedFaction.traits) {
        mutatedFaction.traits = [];
      }

      const possibleTraitShifts = [
        { from: 'peaceful', to: 'aggressive', probability: divergenceIntensity },
        { from: 'exploratory', to: 'territorial', probability: divergenceIntensity },
        { from: 'trusting', to: 'paranoid', probability: divergenceIntensity * 0.7 }
      ];

      for (const shift of possibleTraitShifts) {
        if (mutatedFaction.traits.includes(shift.from)) {
          if (rng.next() < shift.probability) {
            mutatedFaction.traits = mutatedFaction.traits.filter((t: string) => t !== shift.from);
            mutatedFaction.traits.push(shift.to);
            console.log(
              `[epochEvolutionEngine] Faction trait mutation: ${faction.id} ${shift.from} → ${shift.to}`
            );
          }
        }
      }
    }

    // Relationship mutation: Factions grow closer or drift apart
    if (mutatedFaction.relationships && divergenceIntensity > 0) {
      mutatedFaction.relationships = { ...mutatedFaction.relationships };
      for (const [otherFactionId, relationship] of Object.entries(mutatedFaction.relationships)) {
        const relationShift = rng.nextInt(-15, 15) * divergenceIntensity;
        const newRelation = Math.max(-100, Math.min(100, (relationship as number) + relationShift));
        mutatedFaction.relationships[otherFactionId] = newRelation;
      }
    }

    // Territory control: Factions may gain or lose controlled locations
    if (divergenceIntensity > 0.5 && mutatedFaction.controlledLocationIds) {
      // 20% chance to lose a location if heavily burdened
      if (mutatedFaction.controlledLocationIds.length > 3 && rng.next() < 0.2) {
        const lossIdx = rng.nextInt(0, mutatedFaction.controlledLocationIds.length - 1);
        const lostLocation = mutatedFaction.controlledLocationIds[lossIdx];
        mutatedFaction.controlledLocationIds = mutatedFaction.controlledLocationIds.filter(
          (_: string, idx: number) => idx !== lossIdx
        );
        console.log(
          `[epochEvolutionEngine] Faction ${faction.id} lost territory: ${lostLocation}`
        );
      }
    }

    return mutatedFaction;
  });

  // Apply NPC bloodline changes
  const evolvedNpcs = (state.npcs || []).map((npc: NPC) => {
    const mutatedNpc = { ...npc };

    // Phase 20: Template-driven bloodline divergence
    if (template?.bloodlineDivergence && npc.lineageId) {
      const divergenceRule = template.bloodlineDivergence.find((r: any) => r.lineageId.toLowerCase() === npc.lineageId?.toLowerCase());
      if (divergenceRule) {
        // Evaluate condition (e.g., player_alignment >= 50)
        for (const path of divergenceRule.divergentPaths) {
          const context = {
            player_alignment: (state as any).playerAlignment ?? 50,
            paradox_level: generationalParadox,
            myth_status: (state as any).mythStatus ?? 0
          };

          // Simple condition evaluator
          try {
            const conditionMet = evaluateSimpleCondition(path.condition, context);
            if (conditionMet) {
              if (!mutatedNpc.traits) mutatedNpc.traits = [];
              if (!mutatedNpc.traits.includes(path.resultTrait)) {
                mutatedNpc.traits.push(path.resultTrait);
              }
              // Phase 21: Also update NPC name if variantName provided
              if (path.variantName) {
                mutatedNpc.name = path.variantName;
              }
              console.log(`[epochEvolutionEngine] Bloodline Shift: ${npc.name} (${npc.lineageId}) → ${path.resultTrait} (Condition: ${path.condition})`);
              break; // Take first matching path
            }
          } catch (e) {
            console.error(`[epochEvolutionEngine] Error evaluating condition: ${path.condition}`, e);
          }
        }
      }
    }

    if (divergenceIntensity > 0) {
      // Skill evolution or degradation
      if (mutatedNpc.level !== undefined) {
        const levelShift = Math.sign(rng.next() - 0.5) * Math.ceil(divergenceIntensity * 2);
        mutatedNpc.level = Math.max(1, Math.min(20, npc.level + levelShift));

        if (levelShift !== 0) {
          console.log(
            `[epochEvolutionEngine] NPC ${npc.id} level shift: ${npc.level} → ${mutatedNpc.level}`
          );
        }
      }

      // Personality drift (if tracked)
      if ((mutatedNpc as any).personality) {
        const personalityShift = rng.next() - 0.5; // -0.5 to +0.5
        (mutatedNpc as any).personality += personalityShift * divergenceIntensity;
      }

      // Relationship reputation changes
      if (mutatedNpc.reputation !== undefined) {
        const repShift = rng.nextInt(-10, 10) * divergenceIntensity;
        mutatedNpc.reputation = Math.max(-100, Math.min(100, npc.reputation + repShift));
      }
    }

    return mutatedNpc;
  });

  return {
    ...state,
    factions: evolvedFactions,
    npcs: evolvedNpcs
  };
}

/**
 * Environmental Transformation: Biome shifts and location decay
 * High paradox levels cause locations to mutate or become uninhabitable
 */
export function applyEnvironmentalTransformation(
  state: WorldState,
  rng: SeededRng,
  generationalParadox: number
): WorldState {
  if (!state.locations || state.locations.length === 0) {
    return state;
  }

  const template = getWorldTemplate();
  const stabilityThresholds = template?.stabilityThresholds || {
    WHISPER: 30,
    STRAIN: 60,
    FRACTURE: 90
  };

  // Determine mutation intensity
  let mutationIntensity = 0;
  if (generationalParadox >= stabilityThresholds.FRACTURE) {
    mutationIntensity = 0.9; // Severe mutations
  } else if (generationalParadox >= stabilityThresholds.STRAIN) {
    mutationIntensity = 0.5; // Moderate mutations
  } else if (generationalParadox >= stabilityThresholds.WHISPER) {
    mutationIntensity = 0.2; // Subtle mutations
  }

  const evolvedLocations = state.locations.map((location: any) => {
    const mutatedLocation = { ...location };

    if (mutationIntensity > 0 && location.spiritDensity !== undefined) {
      // Spirit density erosion
      const erosion = Math.floor(mutationIntensity * 20);
      mutatedLocation.spiritDensity = Math.max(0, location.spiritDensity - erosion);

      // Biome transformation at critical thresholds
      if (mutatedLocation.spiritDensity === 0 && rng.next() < mutationIntensity * 0.5) {
        const biomeDecay: Record<string, string> = {
          'forest': 'corrupted_forest',
          'mountain': 'barren_mountain',
          'coast': 'blighted_coast',
          'cave': 'void_cave',
          'plains': 'withered_plains',
          'shrine': 'profaned_shrine',
          'village': 'abandoned_ruins'
        };

        const oldBiome = location.biome || 'plains';
        mutatedLocation.biome = biomeDecay[oldBiome] || 'corrupted';

        console.log(
          `[epochEvolutionEngine] Location mutation: ${location.id} ` +
          `biome changed ${oldBiome} → ${mutatedLocation.biome}`
        );
      }
    }

    return mutatedLocation;
  });

  return {
    ...state,
    locations: evolvedLocations
  };
}

/**
 * Simple evaluator for template conditions (e.g., 'player_alignment >= 50')
 */
function evaluateSimpleCondition(condition: string, context: Record<string, number>): boolean {
  // Supports >=, <=, >, <, ===
  const match = condition.match(/([a-z_]+)\s*([><=]+)\s*(\d+)/);
  if (!match) {
    console.warn(`[epochEvolutionEngine] Invalid condition format: ${condition}`);
    return false;
  }

  const [, key, op, valStr] = match;
  const val = parseInt(valStr, 10);
  const contextVal = context[key];

  if (contextVal === undefined) {
    console.warn(`[epochEvolutionEngine] Condition key missing in context: ${key}`);
    return false;
  }

  const result = (() => {
    switch (op) {
      case '>=': return contextVal >= val;
      case '<=': return contextVal <= val;
      case '>': return contextVal > val;
      case '<': return contextVal < val;
      case '===': return contextVal === val;
      default: return false;
    }
  })();

  return result;
}

/**
 * Main orchestrator: Apply all evolution systems during epoch transition
 */
export function applyEpochEvolution(state: WorldState, generationalParadox: number): WorldState {
  const rng = new SeededRng(state.seed + (state.tick || 0) + generationalParadox);

  console.log(`\n[epochEvolutionEngine] Applying epoch evolution (Paradox: ${generationalParadox})`);

  // Apply material ascension
  let evolvedState = applyMaterialEvolution(state, rng, generationalParadox);

  // Apply bloodline divergence
  evolvedState = applyBloodlineDivergence(evolvedState, rng, generationalParadox);

  // Apply environmental transformation
  evolvedState = applyEnvironmentalTransformation(evolvedState, rng, generationalParadox);

  console.log(`[epochEvolutionEngine] Epoch evolution complete`);

  return evolvedState;
}
