/**
 * Artifact Sentience Loop - Wires artifact mood updates to world state ticks
 * Part of Phase 14: The Alchemical & Material Manifest
 * 
 * Responsibilities:
 * - Decay artifact moods over time
 * - Update moods based on player actions
 * - Apply mood-influenced stat bonuses
 * - Trigger artifact rebellion and dialogue at appropriate thresholds
 */

import { PlayerState, WorldState } from './worldEngine';
import { Relic, getDominantMood } from './artifactEngine';

/**
 * Artifact sentience event types that trigger mood updates
 */
export type ArtifactEventType = 
  | 'combat_kill'
  | 'combat_damage_taken'
  | 'exploration_discovery'
  | 'location_visit'
  | 'time_idle'
  | 'paradox_spike'
  | 'covenant_broken';

/**
 * Update artifact mood state after a specific event
 * Called by action pipeline when player performs actions
 */
export function updateArtifactMoodFromEvent(
  artifact: Relic,
  eventType: ArtifactEventType,
  intensity: number = 1.0
): Relic {
  if (!artifact.moods) {
    artifact.moods = { bloodthirsty: 0, curious: 0, sullen: 0, protective: 0 };
  }

  const updated = { ...artifact };
  const moods = { ...updated.moods };
  const moodIncrement = 0.1 * intensity;

  switch (eventType) {
    case 'combat_kill':
      // Killing enemies increases bloodthirsty mood
      moods.bloodthirsty = Math.min(1, moods.bloodthirsty + moodIncrement);
      moods.sullen = Math.max(0, moods.sullen - moodIncrement * 0.3);
      break;

    case 'combat_damage_taken':
      // Taking damage increases protective mood (item protecting user)
      moods.protective = Math.min(1, moods.protective + moodIncrement * 0.5);
      break;

    case 'exploration_discovery':
      // Discovering new areas increases curious mood
      moods.curious = Math.min(1, moods.curious + moodIncrement);
      moods.sullen = Math.max(0, moods.sullen - moodIncrement * 0.2);
      break;

    case 'location_visit':
      // New locations slightly increase curiosity
      moods.curious = Math.min(1, moods.curious + moodIncrement * 0.3);
      break;

    case 'time_idle':
      // Sitting unused increases sullen mood (boredom)
      moods.sullen = Math.min(1, moods.sullen + moodIncrement);
      moods.curious = Math.max(0, moods.curious - moodIncrement * 0.1);
      break;

    case 'paradox_spike':
      // High paradox events destabilize the artifact
      // Randomly shift moods toward extremes
      if (Math.random() > 0.5) {
        moods.bloodthirsty = Math.min(1, moods.bloodthirsty + moodIncrement * 0.7);
      } else {
        moods.curious = Math.min(1, moods.curious + moodIncrement * 0.7);
      }
      break;

    case 'covenant_broken':
      // Betraying the artifact's wishes increases resentment (sullen)
      moods.sullen = Math.min(1, moods.sullen + moodIncrement * 1.5);
      break;
  }

  updated.moods = moods;
  updated.lastMoodUpdateTick = new Date().getTime();

  return updated;
}

/**
 * Process natural mood decay over time
 * Higher moods decay slower (artifacts remember strong feelings)
 * Called periodically during world ticks
 */
export function applyMoodDecay(artifact: Relic, ticksElapsed: number): Relic {
  if (!artifact.moods || ticksElapsed === 0) return artifact;

  const updated = { ...artifact };
  const moods = { ...updated.moods };

  // Decay rate increases with number of ticks
  // Base: 0.5% per tick, accelerated for high values
  const baseDecayRate = 0.005 * ticksElapsed;

  Object.keys(moods).forEach(moodName => {
    const currentMood = moods[moodName as keyof typeof moods];
    
    // High moods decay slower (inertia effect)
    // Low moods return to neutral faster (reset effect)
    let decayRate = baseDecayRate;
    if (currentMood > 0.7) {
      decayRate *= 0.5; // High moods are sticky
    } else if (currentMood < 0.3) {
      decayRate *= 1.5; // Low moods quickly fade
    }

    moods[moodName as keyof typeof moods] = Math.max(0, currentMood - decayRate);
  });

  updated.moods = moods;
  return updated;
}

/**
 * Get mood-influenced stat modification
 * Dominant mood affects player stats while wielding the artifact
 */
export function getMoodStatModifier(artifact: Relic): Record<string, number> {
  if (!artifact.moods) return {};

  const dominant = getDominantMood(artifact);
  const dominantValue = artifact.moods[dominant];

  // Stat modifications scale with mood intensity
  const moodIntensity = Math.floor(dominantValue * 3); // 0-3 scale

  switch (dominant) {
    case 'bloodthirsty':
      return {
        str: moodIntensity,
        def: -Math.floor(moodIntensity * 0.5), // Bloodlust reduces defense
        crit_chance: moodIntensity * 0.05,
      };

    case 'curious':
      return {
        int: moodIntensity,
        xp_gain: moodIntensity * 0.1,
        perception: Math.floor(moodIntensity * 0.5),
      };

    case 'sullen':
      return {
        str: -Math.floor(moodIntensity * 0.5), // Sullen mood weakens user
        def: Math.floor(moodIntensity * 0.3),
        damage: -0.1 * moodIntensity,
      };

    case 'protective':
      return {
        def: moodIntensity,
        max_hp: moodIntensity * 5,
        damage_reduction: moodIntensity * 0.05,
      };

    default:
      return {};
  }
}

/**
 * Generate contextual dialogue based on artifact mood
 * Called during key story moments to add flavor
 */
export function getArtifactMoodDialogue(artifact: Relic, context: 'greeting' | 'in_danger' | 'victory' | 'sullen_complaint'): string {
  if (!artifact.moods) return '';

  const dominant = getDominantMood(artifact);
  const dominantValue = artifact.moods[dominant];

  // Dialogue intensity scales with mood strength
  const hasStrongMood = dominantValue > 0.6;

  switch (dominant) {
    case 'bloodthirsty':
      switch (context) {
        case 'greeting':
          return hasStrongMood
            ? `${artifact.name} trembles with barely contained bloodlust.`
            : `${artifact.name} hums with anticipation.`;
        case 'in_danger':
          return `**${artifact.name} whispers eagerly:** "More. Give me more."`;
        case 'victory':
          return `**${artifact.name}** drinks deep of the moment, its hunger sated... for now.`;
        case 'sullen_complaint':
          return `${artifact.name} feels constrained, denied the battle it craves.`;
      }
      break;

    case 'curious':
      switch (context) {
        case 'greeting':
          return hasStrongMood
            ? `${artifact.name} glows softly, sensing mysteries nearby.`
            : `${artifact.name} rests quietly, awaiting the next discovery.`;
        case 'in_danger':
          return `**${artifact.name} murmurs:** "Interesting... what will happen next?"`;
        case 'victory':
          return `${artifact.name}'s light brightens—new secrets have been revealed.`;
        case 'sullen_complaint':
          return `${artifact.name} feels dulled by repetition. New horizons are needed.`;
      }
      break;

    case 'sullen':
      switch (context) {
        case 'greeting':
          return hasStrongMood
            ? `${artifact.name} sits cold and unresponsive.`
            : `${artifact.name} seems distant, but stirrings of interest remain.`;
        case 'in_danger':
          return `**${artifact.name}** remains silent, offering only grudging assistance.`;
        case 'victory':
          return `${artifact.name} shows no emotion. Apathy runs deep.`;
        case 'sullen_complaint':
          return `**${artifact.name}** suddenly speaks: "Why do you even bother?"`;
      }
      break;

    case 'protective':
      switch (context) {
        case 'greeting':
          return hasStrongMood
            ? `${artifact.name} emanates warmth and resolve. It will guard you.`
            : `${artifact.name} settles comfortably in your hand.`;
        case 'in_danger':
          return `**${artifact.name}** pulses with protective fury: "Not on my watch."`;
        case 'victory':
          return `${artifact.name} seems satisfied, having kept you safe through another trial.`;
        case 'sullen_complaint':
          return `${artifact.name} feels restless—you haven't needed its protection lately.`;
      }
      break;
  }

  return '';
}

/**
 * Apply artifact mood to player stats during calculation
 * Called when calculating player combat stats or ability checks
 */
export function applyEquippedArtifactMoodBonus(
  player: PlayerState,
  equippedRelics: Relic[]
): Record<string, number> {
  const combinedBonus: Record<string, number> = {};

  equippedRelics.forEach(relic => {
    const moodMod = getMoodStatModifier(relic);
    Object.entries(moodMod).forEach(([stat, value]) => {
      combinedBonus[stat] = (combinedBonus[stat] || 0) + value;
    });
  });

  return combinedBonus;
}

/**
 * Check if any equipped relics should speak due to mood state
 * Returns dialogue string if any artifact wants to speak
 */
export function checkArtifactSpeech(
  equippedRelics: Relic[],
  context: 'greeting' | 'in_danger' | 'victory' | 'sullen_complaint',
  paradoxLevel: number
): string | null {
  if (equippedRelics.length === 0) return null;

  // At high paradox, artifacts are more talkative
  const talkChance = Math.min(1, 0.3 + (paradoxLevel / 100) * 0.5);

  if (Math.random() > talkChance) return null;

  // Pick a random equipped relic to speak
  const speaker = equippedRelics[Math.floor(Math.random() * equippedRelics.length)];
  return getArtifactMoodDialogue(speaker, context);
}

/**
 * Process all mood-related updates for artifacts in world state
 * Call this during each world tick
 */
export function processArtifactSentience(
  worldState: WorldState,
  ticksElapsed: number = 1
): Relic[] {
  const player = worldState.player;
  if (!player || !player.inventory) return [];

  // Get all relics from inventory (unique items with moods)
  const allRelics = player.inventory
    .filter(item => item.kind === 'unique' && (item as any).moods)
    .map(item => item as any as Relic);

  // Apply mood decay and update last tick
  return allRelics.map(relic => {
    // Decay mood naturally
    let updated = applyMoodDecay(relic, ticksElapsed);

    // Track last update
    if (!updated.lastMoodUpdateTick) {
      updated.lastMoodUpdateTick = worldState.tick;
    }

    // Note: Rebellion effects are handled during action resolution
    // This function only manages mood state and decay

    return updated;
  });
}
