/**
 * M38 Task 3: Visual Trigger Weave System
 * 
 * Integrates assetGenerator with critical moment generation
 * Triggers automatic visual prompts for:
 * - Critical hits (>= 15 difficulty)
 * - Fumbles (natural 1)
 * - Major quest completions
 * - Faction dominance shifts
 * - Macro event activations
 */

import { indexedDbStore } from '../engine/saveLoadEngine';

export interface CriticalMoment {
  id: string;
  type: 'critical-hit' | 'fumble' | 'quest-complete' | 'faction-shift' | 'macro-event';
  description: string;
  diceResult: number;
  difficulty: number;
  location: string;
  contextData: Record<string, unknown>;
  visualPrompts?: Array<{ prompt: string; style: string }>;
  generatedAt: number;
}

export interface VisualTriggerResult {
  triggered: boolean;
  moment: CriticalMoment | null;
  cachedPrompt: boolean;
  promptData?: Record<string, unknown>;
}

/**
 * Generate cache key for visual prompt deduplication
 */
export function generateVisualCacheKey(
  type: string,
  location: string,
  weather: string,
  epoch: string
): string {
  return `visual_${type}_${location}_${weather}_${epoch}`.replaceAll(/\s+/g, '_').toLowerCase();
}

/**
 * Check if a dice roll triggers critical visuals
 * Returns true if roll difficulty >= 15 (critical success or failure)
 */
export function shouldTriggerCriticalVisuals(
  diceResult: number,
  difficulty: number,
  rollType: string
): boolean {
  // Critical success: beating difficulty by 5+
  if (rollType === 'success' && diceResult >= difficulty + 5) return true;

  // Critical failure: failing by 5+
  if (rollType === 'failure' && diceResult <= difficulty - 5) return true;

  // Natural 1 always triggers visuals
  if (diceResult === 1) return true;

  // Natural 20 always triggers visuals (if d20 system)
  if (diceResult === 20) return true;

  return false;
}

/**
 * Create a critical moment from dice roll context
 */
export function createCriticalMoment(
  diceResult: number,
  difficulty: number,
  rollType: string,
  location: string,
  contextData: Record<string, unknown>
): CriticalMoment {
  let type: CriticalMoment['type'];
  let description = '';

  if (diceResult === 1) {
    type = 'fumble';
    description = '💔 Catastrophic Fumble! A moment of destiny gone wrong.';
  } else if (rollType === 'success' && diceResult >= difficulty + 5) {
    type = 'critical-hit';
    description = '✨ Critical Success! A miraculous achievement.';
  } else if (rollType === 'failure' && diceResult <= difficulty - 5) {
    type = 'fumble';
    description = '💥 Devastating Failure! Fortune turns against you.';
  } else {
    type = 'critical-hit';
  }

  return {
    id: `moment_${Date.now()}_${Math.random().toString(16).substring(2, 9)}`,
    type,
    description,
    diceResult,
    difficulty,
    location,
    contextData,
    generatedAt: Date.now()
  };
}

/**
 * Generate visual prompts for a critical moment
 * Integrates with assetGenerator for scene descriptions
 * Caches results in IndexedDB to prevent redundant generation
 */
export async function generateCriticalVisuals(
  moment: CriticalMoment,
  weather: string,
  epoch: string
): Promise<Record<string, unknown> | null> {
  // Check cache first
  const cacheKey = generateVisualCacheKey(moment.type, moment.location, weather, epoch);

  try {
    const cached = await indexedDbStore.getVisualPrompt(cacheKey);
    if (cached) {
      console.log(`[VisualTrigger] Using cached prompt for ${moment.type}`);
      return cached;
    }
  } catch (error) {
    console.warn('Cache lookup failed:', error);
  }

  // Generate new visuals based on moment type
  let prompt: Record<string, unknown> = {};

  switch (moment.type) {
    case 'fumble':
      prompt = {
        mainScene: `A catastrophic moment unfolds at ${moment.location}`,
        atmosphere: `The air crackles with irony as events spiral beyond control`,
        lighting: 'Flash of lightning reveals the consequences',
        detailedDescription: moment.description,
        styleGuide: 'dark-fantasy with comedic undertones',
        colorTone: '#dc2626, #000000',
        fullPrompt: `[CRITICAL FUMBLE] Genre: Dark Fantasy with humor. Location: ${moment.location}. Weather: ${weather}. Epoch: ${epoch}. The protagonist's plan collapses spectacularly.`
      };
      break;

    case 'critical-hit':
      prompt = {
        mainScene: `A moment of triumph crystallizes at ${moment.location}`,
        atmosphere: `Reality bends to the will of destiny`,
        lighting: 'Golden light surrounds the hero',
        detailedDescription: moment.description,
        styleGuide: 'high-fantasy with heroic grandeur',
        colorTone: '#fbbf24, #3b82f6',
        fullPrompt: `[CRITICAL SUCCESS] Genre: Epic High Fantasy. Location: ${moment.location}. Weather: ${weather}. Epoch: ${epoch}. An unlikely hero achieves the impossible.`
      };
      break;

    case 'quest-complete':
      prompt = {
        mainScene: 'A legendary chapter concludes',
        atmosphere: 'The world shifts as prophecy unfolds',
        lighting: 'Celestial rays illuminate the truth',
        detailedDescription: 'A quest reaches its destined conclusion',
        styleGuide: 'mythic-fantasy',
        colorTone: '#c084fc, #fbbf24',
        fullPrompt: `[QUEST COMPLETE] Quest: ${String(moment.contextData.questName ?? 'Unknown')}. Location: ${moment.location}`
      };
      break;

    case 'faction-shift':
      prompt = {
        mainScene: 'Political balance shifts dramatically',
        atmosphere: 'Tension crackles between rival powers',
        lighting: 'Ambiguous twilight',
        detailedDescription: `Faction ${String(moment.contextData.factionId)} gains dominance`,
        styleGuide: 'political-intrigue-fantasy',
        colorTone: '#a855f7, #64748b',
        fullPrompt: `[FACTION SHIFT] Faction: ${String(moment.contextData.factionId)}. New Power: ${String(moment.contextData.newPower)}`
      };
      break;

    case 'macro-event':
      prompt = {
        mainScene: 'Reality itself trembles',
        atmosphere: 'A world-changing phenomenon manifests',
        lighting: 'Unnatural colors fill the sky',
        detailedDescription: `World Event: ${String(moment.contextData.eventType)}`,
        styleGuide: 'cosmic-horror meets epic-fantasy',
        colorTone: '#7c3aed, #dc2626',
        fullPrompt: `[MACRO EVENT] Event Type: ${String(moment.contextData.eventType)}. Severity: ${String(moment.contextData.severity)}`
      };
      break;

    default:
      return null;
  }

  // Cache the generated prompt for 24 hours
  try {
    await indexedDbStore.cacheVisualPrompt(cacheKey, prompt, 86400000);
  } catch (error) {
    console.warn('Failed to cache visual prompt:', error);
  }

  return prompt;
}

/**
 * Process a dice roll for critical visual triggers
 * Called automatically from DiceAltar after resolution
 */
export async function processDiceRollForVisuals(
  diceResult: number,
  difficulty: number,
  rollType: string,
  location: string,
  weather: string,
  epoch: string,
  contextData: Record<string, unknown> = {}
): Promise<VisualTriggerResult> {
  // Check if roll triggers visuals
  if (!shouldTriggerCriticalVisuals(diceResult, difficulty, rollType)) {
    return {
      triggered: false,
      moment: null,
      cachedPrompt: false
    };
  }

  // Create critical moment
  const moment = createCriticalMoment(diceResult, difficulty, rollType, location, contextData);

  // Generate visuals
  const cacheKey = generateVisualCacheKey(moment.type, location, weather, epoch);

  try {
    // Check if already cached
    const cached = await indexedDbStore.getVisualPrompt(cacheKey);
    if (cached) {
      return {
        triggered: true,
        moment,
        cachedPrompt: true,
        promptData: cached
      };
    }

    // Generate new visuals
    const promptData = await generateCriticalVisuals(moment, weather, epoch);

    return {
      triggered: true,
      moment,
      cachedPrompt: false,
      promptData: promptData || undefined
    };
  } catch (error) {
    console.error('Failed to process dice roll for visuals:', error);
    return {
      triggered: true,
      moment,
      cachedPrompt: false
    };
  }
}

/**
 * Cleanup old cached visual prompts (>7 days)
 */
export async function cleanupOldVisualCache(): Promise<void> {
  try {
    await indexedDbStore.clearOldCache(604800000); // 7 days
    console.log('[VisualTrigger] Cleaned up old visual cache');
  } catch (error) {
    console.warn('[VisualTrigger] Cache cleanup failed:', error);
  }
}
