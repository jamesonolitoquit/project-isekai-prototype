/**
 * legacyEngine.ts - M45-C1 + M32: Bloodline & Soul Echo System
 * Manages ancestral legacy, soul echoes, bloodline profiles, and cross-epoch transmission.
 */

import { SeededRng } from './prng';
import type { WorldState, NPC, PlayerState } from './worldEngine';
import type { Event } from '../events/mutationLog';
import { extractGrandDeeds } from './eventCompactionEngine';

// Strict type interfaces to replace `any`
export interface WorldTemplate {
  name: string;
  soulEchoes: TemplateEcho[];
  seed?: number;
  [key: string]: unknown;
}

export interface TemplateEcho {
  id?: string;
  echoType?: 'faint' | 'clear' | 'resonant' | 'overwhelming';
  powerLevel?: number;
  originalNpcName?: string;
  emotionalResonance?: number;
  name?: string;
  description?: string;
  ancestorName?: string;
  deedTriggered?: string;
  rarity?: string;
  mechanicalEffect?: string;
  narrativeEffect?: string;
  ancestralAdvice?: string;
  [key: string]: unknown;
}

export interface DeedPayload {
  divergenceRating?: number;
  powerShift?: number;
  bonusesApplied?: Record<string, number>;
  causalities?: number;
  winnerFactionId?: string;
  [key: string]: unknown;
}

export interface PlayerLegacyState extends PlayerState {
  lastSoulResonanceTick?: number;
  soulResonanceLevel?: number;
  deeds?: string[];
  [key: string]: unknown;
}

export interface WorldLegacyState extends WorldState {
  worldTemplate?: WorldTemplate;
  playerReputation?: number;
  playerDeeds?: string[];
  factionStandings?: Record<string, number>;
  epochCount?: number;
  [key: string]: unknown;
}

// PlaystyleProfile for analysis support
export interface CharacterProfile {
  combatFrequency: number;
  socialFrequency: number;
  explorationFrequency: number;
  ritualFrequency: number;
  craftingFrequency: number;
}

export interface PlaystyleProfile {
  characterProfile: CharacterProfile;
  dominantPlaystyle: 'combatant' | 'socialite' | 'explorer' | 'ritualist' | 'crafter' | 'balanced';
  [key: string]: unknown;
}

// Phase 13: Ancestral Blessings & Curses
export interface AncestralBoon {
  id: string;
  name: string;  // e.g., "Resonant Soul", "Blessed Bloodline", "Warrior's Strength"
  description: string;
  bonusType: 'stat' | 'ability' | 'resistance' | 'skill' | 'special';
  targetStat?: string;  // e.g., 'str', 'int', 'cha', 'merit'
  magnitude: number;  // Bonus amount (+5 STR, +0.1 merit multiplier, etc.)
  duration?: 'permanent' | 'epoch' | 'temporary';
  deedSource?: string;  // ID of deed that granted this boon
}

export interface AncestralBlight {
  id: string;
  name: string;  // e.g., "Tainted Bloodline", "Curse of Paradox", "Marked by Fate"
  description: string;
  penaltyType: 'stat' | 'vulnerability' | 'curse' | 'restriction';
  targetStat?: string;  // Stat affected by curse
  magnitude: number;  // Penalty amount
  duration?: 'permanent' | 'epoch' | 'temporary';
  paradoxSource?: number;  // Paradox level that triggered this curse
}

export interface LegacyImpact {
  id: string;
  chronicleId: string;
  canonicalName: string;
  bloodlineOrigin: string;
  mythStatus: number;
  deeds: string[];
  factionInfluence: Record<string, number>;
  inheritedPerks: string[];
  ancestralCurses: string[];
  epochsLived: number;
  totalGenerations: number;
  soulEchoCount: number;
  finalWorldState: 'improved' | 'declined' | 'neutral';
  paradoxDebt: number;
  timestamp: number;
  inheritedItems?: Array<{ itemId: string; instanceId?: string; ancestorName?: string; rarity?: string }>;
  // Phase 13: Ancestral mechanics
  ancestralBooms?: AncestralBoon[];  // Bonuses inherited by next generation
  ancestralBlights?: AncestralBlight[];  // Curses/penalties carried forward
  canonicalDeeds?: string[];  // Player-selected favorite deeds (canonized)
  heirlooms?: Array<{ itemId: string; instanceId?: string }>;  // 1 unique item max per ascension
}

export interface BloodlineProfile {
  id: string;
  originNpcId: string;
  canonicalName: string;
  primaryFaction: string;
  deeds: string[];
  mythStatus: number;
  bloodlineTraits: Record<string, number>;
  inheritedAbilities: string[];
  curses: string[];
  generationCount: number;
  isExtinct: boolean;
  soulEchoRegistry: SoulEchoRegistry;
}

export interface SoulEcho {
  id: string;
  echoType: 'faint' | 'clear' | 'resonant' | 'overwhelming';
  originalNpcName: string;
  originalNpcId: string;
  echoContent: Record<string, unknown>;
  emotionalResonance: number;
  temporalStability: number;
  canBeCommunicatedWith: boolean;
  inheritedPerksList: string[];
  ancestralAdvice?: string;
  apparitionTrigger?: string;
}

export interface SoulEchoRegistry {
  id: string;
  bloodlineId: string;
  echoes: SoulEcho[];
  totalResonance: number;
  echoCapacity: number;
}

export interface WorldEndProphecy {
  id: string;
  prophecyType: 'dark' | 'neutral' | 'hopeful' | 'transcendent';
  content: string;
  ancestorName: string;
  ancestorGeneration: number;
  fulfillmentProgress: number;
  isFulfilled: boolean;
  worldOutcome?: string;
}

export interface ReincarnationMetadata {
  previousChronicleSeed: number;
  inheritedAbilities: string[];
  inheritedCurses: string[];
  bloodlineReputation: Record<string, number>;
  startingModifiers: Record<string, number>;
  predestinedMoments: string[];
  karmaCarryover: number;
}

export class LegacyEngine {
  private bloodlines: Map<string, BloodlineProfile> = new Map();
  private legacies: Map<string, LegacyImpact> = new Map();
  private soulEchoRegistries: Map<string, SoulEchoRegistry> = new Map();
  private worldEndProphecies: Map<string, WorldEndProphecy> = new Map();
  private reincarnationMetadata: Map<string, ReincarnationMetadata> = new Map();
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
  }

  /**
   * M49-A4: Initialize Legacy Engine from World Template
   * Populates soul echoes and bloodlines with pre-seeded data.
   */
  initFromTemplate(template: WorldTemplate): void {
    if (!template || !template.soulEchoes) return;

    // Create a default ancestral bloodline for template-based echoes
    const defaultBloodline: BloodlineProfile = {
      id: "bloodline_ancestral_origins",
      originNpcId: "template",
      canonicalName: "The Ancestors",
      primaryFaction: "legacy",
      deeds: ["Founding the World"],
      mythStatus: 100,
      bloodlineTraits: { resilience: 10, charisma: 10, cunning: 10, honor: 10 },
      inheritedAbilities: [],
      curses: [],
      generationCount: 10,
      isExtinct: false,
      soulEchoRegistry: {
        id: "registry_template",
        bloodlineId: "bloodline_ancestral_origins",
        echoes: template.soulEchoes.map((echo: TemplateEcho | Record<string, unknown>): SoulEcho => {
          const e = echo as any;
          const echoType = e.echoType === 'faint' || e.echoType === 'clear' || e.echoType === 'resonant' || e.echoType === 'overwhelming'
            ? e.echoType
            : 'resonant';
          const emotionalRes = typeof e.emotionalResonance === 'number' ? e.emotionalResonance : (e.powerLevel || 50);
          return {
            id: e.id || `echo_${Date.now()}_${Math.random()}`,
            echoType,
            originalNpcName: e.originalNpcName || 'AncestralVoice',
            originalNpcId: `npc_template_${e.id || 'unknown'}`,
            echoContent: { powerLevel: e.powerLevel || 50, ...e },
            emotionalResonance: emotionalRes,
            temporalStability: 100,
            canBeCommunicatedWith: true,
            inheritedPerksList: []
          };
        }),
        totalResonance: template.soulEchoes.reduce((sum: number, e: TemplateEcho | Record<string, unknown>) => sum + ((e as any).powerLevel || 50), 0),
        echoCapacity: 100
      }
    };

    this.bloodlines.set(defaultBloodline.id, defaultBloodline);
    this.soulEchoRegistries.set(defaultBloodline.soulEchoRegistry.id, defaultBloodline.soulEchoRegistry);
  }

  createBloodline(originNpc: NPC, primaryFaction: string): BloodlineProfile {
    const bloodline: BloodlineProfile = {
      id: `bloodline_${originNpc.id}_${Date.now()}`,
      originNpcId: originNpc.id,
      canonicalName: originNpc.name,
      primaryFaction,
      deeds: [],
      mythStatus: 0,
      bloodlineTraits: {
        resilience: this.rng.nextInt(1, 10),
        charisma: this.rng.nextInt(1, 10),
        cunning: this.rng.nextInt(1, 10),
        honor: this.rng.nextInt(0, 10)
      },
      inheritedAbilities: [],
      curses: [],
      generationCount: 1,
      isExtinct: false,
      soulEchoRegistry: {
        id: `registry_${originNpc.id}`,
        bloodlineId: '',
        echoes: [],
        totalResonance: 0,
        echoCapacity: 10
      }
    };

    bloodline.soulEchoRegistry.bloodlineId = bloodline.id;
    this.bloodlines.set(bloodline.id, bloodline);
    this.soulEchoRegistries.set(bloodline.soulEchoRegistry.id, bloodline.soulEchoRegistry);

    return bloodline;
  }

  createSoulEcho(
    originalNpc: NPC,
    bloodlineId: string,
    echoContent: Record<string, unknown>
  ): SoulEcho | null {
    const bloodline = this.bloodlines.get(bloodlineId);
    if (!bloodline) return null;

    const registry = this.soulEchoRegistries.get(bloodline.soulEchoRegistry.id);
    if (!registry || registry.echoes.length >= registry.echoCapacity) return null;

    const echo: SoulEcho = {
      id: `echo_${originalNpc.id}_${Date.now()}`,
      echoType: this.determineEchoType(originalNpc),
      originalNpcName: originalNpc.name,
      originalNpcId: originalNpc.id,
      echoContent,
      emotionalResonance: this.rng.nextInt(10, 100),
      temporalStability: this.rng.nextInt(50, 100),
      canBeCommunicatedWith: this.rng.nextInt(0, 50) > 30,
      inheritedPerksList: this.generateInheritedPerks(originalNpc),
      apparitionTrigger: this.generateApparitionTrigger()
    };

    registry.echoes.push(echo);
    registry.totalResonance += echo.emotionalResonance;
    const bloodlineWithCount = bloodline as BloodlineProfile & { soulEchoCount?: number };
    bloodlineWithCount.soulEchoCount = registry.echoes.length;

    return echo;
  }

  private determineEchoType(npc: NPC & Partial<{ reputation: number }>): SoulEcho['echoType'] {
    const mythStatus = (npc.reputation || 0);

    if (mythStatus > 80) return 'overwhelming';
    if (mythStatus > 50) return 'resonant';
    if (mythStatus > 25) return 'clear';
    return 'faint';
  }

  private generateInheritedPerks(npc: NPC & Partial<{ reputation: number }>): string[] {
    const perks: string[] = [];

    if (((npc.reputation) || 0) > 50) {
      perks.push('Legendary Aura');
      perks.push('Historical Knowledge');
    }

    if ((npc.stats?.strength || 0) > 15) {
      perks.push('Ancestral Might');
    }

    if ((npc.stats?.intellect || 0) > 15) {
      perks.push('Ancient Wisdom');
    }

    return perks.length > 0 ? perks : ['Minor Legacy'];
  }

  private generateApparitionTrigger(): string {
    const triggers = [
      'During moments of great peril',
      'When facing moral crossroads',
      'In ancestral locations',
      'During the anniversary of death',
      'When wielding ancestral artifacts'
    ];

    return triggers[this.rng.nextInt(0, triggers.length - 1)];
  }

  /**
   * M50-A3: Record legacy with cross-epoch narrative generation
   * @param state - Current world state
   * @param playerName - Name to record for this legacy
   * @param eventLog - Optional mutation log for extracting Grand Deeds
   */
  recordLegacy(state: WorldLegacyState, playerName: string, eventLog?: Event[]): LegacyImpact {
    const legacy: LegacyImpact = {
      id: `legacy_${state.chronicleId}_${Date.now()}`,
      chronicleId: state.chronicleId,
      canonicalName: playerName,
      bloodlineOrigin: (state.worldTemplate?.name) || 'Unknown',
      mythStatus: (state.playerReputation) || 0,
      deeds: (state.playerDeeds) || [],
      factionInfluence: (state.factionStandings) || {},
      inheritedPerks: [],
      ancestralCurses: [],
      epochsLived: (state.epochCount) || 1,
      totalGenerations: 1,
      soulEchoCount: 0,
      finalWorldState: this.calculateWorldState(state),
      paradoxDebt: state.paradoxDebt || 0,
      timestamp: Date.now()
    };

    // M50-A3: Extract Grand Deeds and generate soul echoes for next world
    if (eventLog && eventLog.length > 0) {
      const grandDeeds = extractGrandDeeds(eventLog);
      const generatedEchoes = this.generateEchoesFromDeeds(grandDeeds, playerName, legacy.id);
      
      // Store echoes in a registry for next-world access
      if (generatedEchoes.length > 0) {
        const echoRegistry: SoulEchoRegistry = {
          id: `registry_${legacy.id}`,
          bloodlineId: legacy.id,
          echoes: generatedEchoes,
          totalResonance: generatedEchoes.reduce((sum, e) => sum + e.emotionalResonance, 0),
          echoCapacity: 10  // Max 10 echoes per generation
        };
        this.soulEchoRegistries.set(echoRegistry.id, echoRegistry);
        legacy.soulEchoCount = generatedEchoes.length;
        
        if (process.env.NODE_ENV === 'development') {
          console.log(`[LegacyEngine] Generated ${generatedEchoes.length} soul echoes from ${grandDeeds.length} Grand Deeds for ${playerName}`);
        }
      }
    }

    this.legacies.set(legacy.id, legacy);
    return legacy;
  }

  /**
   * M50-A3: Generate soul echoes from historical deeds
   */
  private generateEchoesFromDeeds(deeds: Event[], npcName: string, legacyId: string): SoulEcho[] {
    const echoes: SoulEcho[] = [];
    
    for (const deed of deeds) {
      if (echoes.length >= 10) break;  // Cap at 10 echoes per generation
      
      const echoType = this.determineEchoIntensity(deed);
      const emotionalResonance = this.calculateEmotionalResonance(deed);
      const advice = this.generateAncestralAdvice(deed);
      
      const echoActorId = ((deed.payload as unknown) as Record<string, unknown>)?.['actorId'] as string | undefined;
      
      const echo: SoulEcho = {
        id: `echo_${legacyId}_${deed.id}`,
        echoType,
        originalNpcName: npcName,
        originalNpcId: echoActorId || 'player',
        echoContent: {
          deedType: deed.type,
          payload: deed.payload,
          parentEvent: deed.id
        },
        emotionalResonance,
        temporalStability: 0.6 + (this.rng.next() * 0.4),  // 0.6-1.0
        canBeCommunicatedWith: echoType !== 'faint',
        inheritedPerksList: this.extractPerksList(deed),
        ancestralAdvice: advice,
        apparitionTrigger: this.generateTrigger(deed)
      };
      
      echoes.push(echo);
    }
    
    return echoes;
  }

  /**
   * Determine soul echo intensity based on deed significance
   */
  private determineEchoIntensity(deed: Event): 'faint' | 'clear' | 'resonant' | 'overwhelming' {
    const payload = (deed.payload as DeedPayload) || {};
    const divergenceRating = payload.divergenceRating || 0;
    const powerShift = payload.powerShift || 0;
    
    const intensity = divergenceRating + (powerShift * 5);
    
    if (intensity > 100) return 'overwhelming';
    if (intensity > 75) return 'resonant';
    if (intensity > 40) return 'clear';
    return 'faint';
  }

  /**
   * Calculate emotional resonance value for echo
   */
  private calculateEmotionalResonance(deed: Event): number {
    let resonance = 50;  // Base
    
    if (deed.type === 'PLAYER_ACTION' || deed.type === 'FACTION_SKIRMISH') {
      resonance += 20;
    }
    const payload = (deed.payload as DeedPayload);
    if ((payload?.divergenceRating || 0) > 75) {
      resonance += 20;
    }
    if ((payload?.causalities || 0) > 0) {
      resonance += 10;  // Sacrifice increases resonance
    }
    
    return Math.min(100, resonance + this.rng.nextInt(-10, 10));
  }

  /**
   * Generate trigger condition for echo manifestation
   */
  private generateTrigger(deed: Event): string {
    const triggers = [
      'At a shrine beneath moonlight',
      'When facing impossible odds',
      'In a place of great sorrow',
      'When the world needs guidance',
      'At the moment of greatest doubt',
      'In the presence of their descendants'
    ];
    return triggers[this.rng.nextInt(0, triggers.length - 1)];
  }

  /**
   * Generate ancestral advice from a deed
   */
  private generateAncestralAdvice(deed: Event): string {
    const adviceTemplates: Record<string, string[]> = {
      'FACTION_SKIRMISH': [
        'Remember: the cost of victory is measured in blood. Use power wisely.',
        'Territories change hands, but honor endures.',
        'When factions clash, it is innocents who suffer most.'
      ],
      'PLAYER_DEATH': [
        'Death is not an end, but a transformation.',
        'Your sacrifice echoes through the generations.',
        'What is lost in flesh may be gained in spirit.'
      ],
      'LEGENDARY_DEED': [
        'One act of courage can reshape the world.',
        'History remembers not the comfortable, but the audacious.',
        'Your legacy writes itself through deeds, not words.'
      ],
      'PLAYER_ACTION': [
        'Every choice ripples forward through time.',
        'The seemingly small act may birth great consequences.'
      ]
    };
    
    const templates = adviceTemplates[deed.type] || adviceTemplates['PLAYER_ACTION'];
    return templates[this.rng.nextInt(0, templates.length - 1)];
  }

  /**
   * Extract relevant perks that could be inherited from a deed
   */
  private extractPerksList(deed: Event): string[] {
    const perks: string[] = [];
    const payload = (deed.payload as DeedPayload);
    if (payload?.bonusesApplied) {
      if (payload.bonusesApplied['strength'] > 0) perks.push('Ancestral Strength');
      if (payload.bonusesApplied['agility'] > 0) perks.push('Echo Swift');
    }
    
    if (deed.type === 'FACTION_SKIRMISH' && payload?.winnerFactionId) {
      perks.push('Faction Legacy');
    }
    
    if (payload?.divergenceRating > 75) {
      perks.push('Mythic Potential');
    }
    
    return perks;
  }

  private calculateWorldState(state: WorldLegacyState): 'improved' | 'declined' | 'neutral' {
    const reputation = (state.playerReputation) || 0;
    const factionCount = Object.keys((state.factionStandings) || {}).length;
    const standing = Object.values((state.factionStandings) || {}).reduce((a: number, b: unknown) => a + (Number(b) || 0), 0) / Math.max(1, factionCount);

    if (reputation > 70 && standing > 30) return 'improved';
    if (reputation < 30 && standing < -30) return 'declined';
    return 'neutral';
  }

  createWorldEndProphecy(
    prophecyType: 'dark' | 'neutral' | 'hopeful' | 'transcendent',
    ancestorName: string,
    content: string
  ): WorldEndProphecy {
    const prophecy: WorldEndProphecy = {
      id: `prophecy_${Date.now()}`,
      prophecyType,
      content,
      ancestorName,
      ancestorGeneration: 1,
      fulfillmentProgress: 0,
      isFulfilled: false
    };

    this.worldEndProphecies.set(prophecy.id, prophecy);
    return prophecy;
  }

  fulfillProphecy(prophecyId: string, outcome: string): boolean {
    const prophecy = this.worldEndProphecies.get(prophecyId);
    if (!prophecy) return false;

    prophecy.isFulfilled = true;
    prophecy.worldOutcome = outcome;
    prophecy.fulfillmentProgress = 100;

    return true;
  }

  updateProphecyProgress(prophecyId: string, progressAmount: number): boolean {
    const prophecy = this.worldEndProphecies.get(prophecyId);
    if (!prophecy) return false;

    prophecy.fulfillmentProgress = Math.min(100, prophecy.fulfillmentProgress + progressAmount);

    if (prophecy.fulfillmentProgress >= 100) {
      prophecy.isFulfilled = true;
    }

    return true;
  }

  createReincarnationMetadata(
    previousLegacy: LegacyImpact,
    inheritedAbilities: string[],
    inheritedCurses: string[]
  ): ReincarnationMetadata {
    const metadata: ReincarnationMetadata = {
      previousChronicleSeed: this.rng.nextInt(1000000, 9999999),
      inheritedAbilities,
      inheritedCurses,
      bloodlineReputation: previousLegacy.factionInfluence,
      startingModifiers: {
        reputation_boost: Math.floor(previousLegacy.mythStatus / 5),
        starting_resources: previousLegacy.mythStatus > 50 ? 500 : 100
      },
      predestinedMoments: [],
      karmaCarryover: previousLegacy.mythStatus / 100
    };

    this.reincarnationMetadata.set(previousLegacy.id, metadata);

    return metadata;
  }

  getReincarnationMetadata(legacyId: string): ReincarnationMetadata | undefined {
    return this.reincarnationMetadata.get(legacyId);
  }

  getBloodline(bloodlineId: string): BloodlineProfile | undefined {
    return this.bloodlines.get(bloodlineId);
  }

  getLegacy(legacyId: string): LegacyImpact | undefined {
    return this.legacies.get(legacyId);
  }

  getSoulEchoRegistry(registryId: string): SoulEchoRegistry | undefined {
    return this.soulEchoRegistries.get(registryId);
  }

  getSoulEcho(echoId: string): SoulEcho | undefined {
    for (const registry of this.soulEchoRegistries.values()) {
      const echo = registry.echoes.find(e => e.id === echoId);
      if (echo) return echo;
    }
    return undefined;
  }

  getAllBloodlines(): BloodlineProfile[] {
    return Array.from(this.bloodlines.values());
  }

  getAllLegacies(): LegacyImpact[] {
    return Array.from(this.legacies.values());
  }

  getAllProphecies(): WorldEndProphecy[] {
    return Array.from(this.worldEndProphecies.values());
  }

  updateBloodlineGeneration(bloodlineId: string): void {
    const bloodline = this.bloodlines.get(bloodlineId);
    if (bloodline) {
      bloodline.generationCount++;
    }
  }

  markBloodlineExtinct(bloodlineId: string): void {
    const bloodline = this.bloodlines.get(bloodlineId);
    if (bloodline) {
      bloodline.isExtinct = true;
    }
  }

  /**
   * M49-A4: Calculate Soul Resonance for the current player
   * Determines if an ancestral echo should appear or if resonance level changes.
   */
  calculateResonance(state: WorldLegacyState): {
    resonanceDelta: number;
    triggeredEchoId?: string;
    advice?: string;
  } {
    const player = state.player as PlayerLegacyState;
    const currentLoc = player.location;
    const currentTick = state.tick || 0;
    const lastResonanceTick = (player.lastSoulResonanceTick) || 0;
    
    // Cool down for resonance triggers (e.g., once every 50 ticks)
    if (currentTick - lastResonanceTick < 50) {
      return { resonanceDelta: 0 };
    }

    let resonanceDelta = 0;
    let triggeredEchoId: string | undefined;
    let advice: string | undefined;

    // Proximity to "Ancestral" locations (simulated check)
    // In a real world, we'd check against a list of locations where ancestors performed deeds.
    const isAncestralLocation = currentLoc.includes('shrine') || currentLoc.includes('ruin');
    
    if (isAncestralLocation) {
      resonanceDelta += 5;
    }

    // Proximity to NPCs from the same bloodline (simulated)
    const nearbyNpcs = state.npcs.filter(n => n.locationId === currentLoc);
    const hasFamilyNpc = nearbyNpcs.some(n => n.factionRole === 'leader' || n.importance === 'critical');
    
    if (hasFamilyNpc) {
      resonanceDelta += 3;
    }

    // Probability of a "Soul Echo" appearing based on current resonance level
    const currentLevel = (player.soulResonanceLevel) || 0;
    const triggerChance = (currentLevel + resonanceDelta) / 200; // 0-50% chance

    if (this.rng.next() < triggerChance) {
      // Pick a random echo from any bloodline registry
      const allEchoes: SoulEcho[] = [];
      for (const registry of this.soulEchoRegistries.values()) {
        allEchoes.push(...registry.echoes);
      }

      if (allEchoes.length > 0) {
        const selectedEcho = allEchoes[this.rng.nextInt(0, allEchoes.length - 1)];
        triggeredEchoId = selectedEcho.id;
        
        // Use pre-defined advice or generate a situational one
        advice = selectedEcho.ancestralAdvice || this.generateSituationalAdvice(state, selectedEcho);
      }
    }

    return { resonanceDelta, triggeredEchoId, advice };
  }

  private generateSituationalAdvice(state: WorldState, echo: SoulEcho): string {
    const biome = state.player.location;
    const advices = [
      `Beware the shadows in ${biome}`,
      `A great treasure was once lost near here...`,
      `Trust not the silver-tongued merchants.`,
      `Your destiny is not yet written, traveler.`,
      `Remember the name of your bloodline across this threshold.`
    ];
    return advices[this.rng.nextInt(0, advices.length - 1)];
  }

  /**
   * M50-A3: Export soul echoes for next-world seeding
   * Called at world end to prepare echoes for inheritance system
   */
  exportSoulEchoesForNextWorld(): SoulEcho[] {
    const allEchoes: SoulEcho[] = [];
    
    for (const registry of this.soulEchoRegistries.values()) {
      allEchoes.push(...registry.echoes);
    }
    
    // Sort by emotional resonance (strongest echoes first)
    return allEchoes.sort((a, b) => b.emotionalResonance - a.emotionalResonance);
  }

  /**
   * M50-A3: Get all active legacy records for historical reference
   */
  exportLegacyRecords(): LegacyImpact[] {
    return Array.from(this.legacies.values());
  }

  /**
   * M50-A3: Get all bloodline lineages for genealogical display
   */
  exportBloodlineLineages(): BloodlineProfile[] {
    return Array.from(this.bloodlines.values());
  }

  /**
   * Phase 12 Task 2: Transmit Soul Echoes based on session deeds
   * Scans WorldState for "Grand Deeds" (high-impact events) and "Relics of Virtue" (artifact discoveries)
   * Creates a LegacyImpact that bridges this epoch to the next
   */
  transmitSoulEchoes(state: WorldState, playerName: string = 'The Wanderer'): LegacyImpact {
    // Extract Grand Deeds from event log
    const eventLog = (state as any).eventLog || [];
    const grandDeeds = extractGrandDeeds(eventLog);
    
    // Identify Relics of Virtue from player inventory
    const relicsOfVirtue: Array<{ itemId: string; ancestorName?: string; rarity?: string }> = [];
    if (state.player?.inventory) {
      for (const item of state.player.inventory) {
        // Check if item is marked as a relic (relics have enhanced properties)
        if (item && 'kind' in item && item.kind === 'equipment') {
          const eqItem = item as any;
          if (eqItem.enchantments?.some((e: string) => e.includes('ancestral') || e.includes('virtue'))) {
            relicsOfVirtue.push({
              itemId: eqItem.itemId,
              ancestorName: playerName,
              rarity: eqItem.rarity || 'uncommon'
            });
          }
        }
      }
    }
    
    // Calculate world state at end
    const worldTension = (state as any).calculateWorldTension?.() ?? 0;
    const finalWorldState: 'improved' | 'declined' | 'neutral' =
      worldTension > 60 ? 'declined' : worldTension < 30 ? 'improved' : 'neutral';
    
    // Create LegacyImpact with deeds and relics
    const legacy: LegacyImpact = {
      id: `legacy_${state.chronicleId}_${state.tick}`,
      chronicleId: state.chronicleId || `chronicle_${state.id}`,
      canonicalName: playerName,
      bloodlineOrigin: state.metadata?.templateOrigin || 'Unknown',
      mythStatus: Math.min(100, (state.player?.level || 1) * 10), // Power proxy: level * 10, capped at 100
      deeds: grandDeeds.map(d => d.id || d.type),
      factionInfluence: state.player?.factionReputation || {},
      inheritedPerks: state.player?.statusEffects?.slice(0, 5) || [], // Store first 5 active status effects as perks
      ancestralCurses: (state.player as any).ancestralCurses || [],
      epochsLived: ((state as any).epochCount || 0) + 1,
      totalGenerations: ((state as any).totalGenerations || 1),
      soulEchoCount: grandDeeds.length,
      finalWorldState,
      paradoxDebt: (state as any).paradoxDebt || 0,
      timestamp: Date.now(),
      inheritedItems: relicsOfVirtue
    };
    
    // Generate soul echoes from the deeds
    const generatedEchoes = this.generateEchoesFromDeeds(grandDeeds, playerName, legacy.id);
    
    if (generatedEchoes.length > 0) {
      const echoRegistry: SoulEchoRegistry = {
        id: `registry_${legacy.id}`,
        bloodlineId: legacy.id,
        echoes: generatedEchoes,
        totalResonance: generatedEchoes.reduce((sum, e) => sum + e.emotionalResonance, 0),
        echoCapacity: 10
      };
      this.soulEchoRegistries.set(echoRegistry.id, echoRegistry);
    }
    
    // Record the legacy
    this.legacies.set(legacy.id, legacy);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[LegacyEngine] Transmitted Soul Echoes: ${grandDeeds.length} deeds, ${relicsOfVirtue.length} relics for ${playerName}`);
    }
    
    return legacy;
  }

  clearLegacyData(): void {
    this.bloodlines.clear();
    this.legacies.clear();
    this.soulEchoRegistries.clear();
    this.worldEndProphecies.clear();
    this.reincarnationMetadata.clear();
  }

  reset(): void {
    this.bloodlines.clear();
    this.legacies.clear();
    this.soulEchoRegistries.clear();
    this.worldEndProphecies.clear();
    this.reincarnationMetadata.clear();
  }
}

let legacyEngineInstance: LegacyEngine | null = null;

export function getLegacyEngine(seed: number = 12345): LegacyEngine {
  if (!legacyEngineInstance) {
    legacyEngineInstance = new LegacyEngine(seed);
  }
  return legacyEngineInstance;
}

export function resetLegacyEngine(): void {
  if (legacyEngineInstance) {
    legacyEngineInstance.reset();
    legacyEngineInstance = null;
  }
}

/**
 * Phase 13 Task 2: Apply Ancestral Legacy to New Character
 * Hydrates the new character's statusEffects, stats, and inventory based on previous generation's LegacyImpact
 * @param state - WorldState with player to be enhanced with ancestry
 * @param legacy - LegacyImpact from previous generation
 * @returns Updated WorldState with ancestry bonuses applied
 */
export function applyAncestralLegacy(state: WorldState, legacy: LegacyImpact): WorldState {
  if (!state.player) {
    return state;
  }

  const updatedState = { ...state };
  const player = { ...updatedState.player };
  
  // Initialize stats if missing
  if (!player.stats) {
    player.stats = { str: 10, agi: 10, int: 10, cha: 10, end: 10, luk: 10 };
  }

  // Initialize statusEffects array if missing
  if (!player.statusEffects) {
    player.statusEffects = [];
  }

  // Phase 13: Apply Ancestral Booms/Blessings
  if (legacy.ancestralBooms && legacy.ancestralBooms.length > 0) {
    for (const boon of legacy.ancestralBooms) {
      // Add boon as status effect
      player.statusEffects.push(`ancestral_${boon.id}`);

      // Apply stat modifiers for stat boons
      if (boon.bonusType === 'stat' && boon.targetStat && player.stats) {
        const statKey = boon.targetStat as keyof typeof player.stats;
        if (statKey in player.stats) {
          player.stats[statKey] = (player.stats[statKey] || 10) + Math.floor(boon.magnitude);
        }
      }

      // Apply merit bonus for merit-type boons
      if (boon.targetStat === 'merit' && boon.magnitude > 0) {
        player.merit = (player.merit || 0) + Math.floor(boon.magnitude);
      }

      // Record in logging
      if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[applyAncestralLegacy] Applied boon: ${boon.name} (+${boon.magnitude} ${boon.targetStat})`);
      }
    }
  }

  // Phase 13: Apply Ancestral Blights/Curses
  if (legacy.ancestralBlights && legacy.ancestralBlights.length > 0) {
    for (const blight of legacy.ancestralBlights) {
      // Add blight as status effect
      player.statusEffects.push(`cursed_${blight.id}`);

      // Apply stat penalties for stat curses
      if (blight.penaltyType === 'stat' && blight.targetStat && player.stats) {
        const statKey = blight.targetStat as keyof typeof player.stats;
        if (statKey in player.stats) {
          player.stats[statKey] = Math.max(1, (player.stats[statKey] || 10) - Math.floor(blight.magnitude));
        }
      }

      // Record in logging
      if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[applyAncestralLegacy] Applied blight: ${blight.name} (-${blight.magnitude} ${blight.targetStat})`);
      }
    }
  }

  // Phase 13: Add inherited perks from previous generation
  if (legacy.inheritedPerks && legacy.inheritedPerks.length > 0) {
    player.statusEffects = [...new Set([...player.statusEffects, ...legacy.inheritedPerks])];
  }

  // Phase 13: Add Heirloom Item to Inventory
  if (legacy.heirlooms && legacy.heirlooms.length > 0) {
    const heirloom = legacy.heirlooms[0];  // Only first heirloom (limit 1 per ascension)
    if (!player.inventory) {
      player.inventory = [];
    }

    // Add as unique item
    player.inventory.push({
      kind: 'unique',
      itemId: heirloom.itemId,
      instanceId: heirloom.instanceId || `heirloom-${Date.now()}`,
      metadata: {
        experience: 0,
        sentience: 0,
        runes: [],
        corruption: 0,
        infusions: []
      }
    });

    if (typeof window === 'undefined' || process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log(`[applyAncestralLegacy] Added heirloom item: ${heirloom.itemId}`);
    }
  }

  // Phase 13: Apply inherited faction reputation bonuses
  if (legacy.factionInfluence) {
    if (!player.factionReputation) {
      player.factionReputation = {};
    }

    for (const [factionId, influence] of Object.entries(legacy.factionInfluence)) {
      // Grant 25% of ancestor's reputation as starting bonus
      const inheritedRep = Math.floor(influence * 0.25);
      player.factionReputation[factionId] = (player.factionReputation[factionId] || 0) + inheritedRep;
    }
  }

  // Phase 13: Set bloodline data for UI display
  if (!player.bloodlineData) {
    player.bloodlineData = {
      canonicalName: legacy.canonicalName,
      inheritedPerks: legacy.inheritedPerks || [],
      mythStatus: legacy.mythStatus,
      epochsLived: legacy.epochsLived,
      deeds: legacy.deeds || []
    };
  }

  // Phase 13: Track current generation index
  if (!updatedState.epochGenerationIndex) {
    updatedState.epochGenerationIndex = 1;
  } else {
    updatedState.epochGenerationIndex += 1;
  }

  updatedState.player = player;
  return updatedState;
}

// EXPORTED STANDALONE FUNCTIONS FOR EPOCH TRANSITION TEST SUPPORT

/**
 * Calculate myth status from player achievements
 */
export function calculateMythStatus(
  player: PlayerState,
  state: WorldState,
  playstyle?: PlaystyleProfile,
  deeds?: string[]
): number {
  let mythStatus = 0;

  // Base from level
  const level = player?.level || 1;
  mythStatus += Math.min(40, level * 2);

  // Faction reputation bonus
  if (player?.factionReputation) {
    const reputationBonus = (Object.values(player.factionReputation) as any[]).reduce((sum: number, rep: any): number => {
      if (rep > 0) sum += Math.min(10, rep / 10);
      return sum;
    }, 0) as number;
    mythStatus += Math.min(20, reputationBonus);
  }

  // Playstyle bonus
  if (playstyle) {
    const explorerBonus = playstyle.characterProfile.explorationFrequency * 10;
    const ritualistBonus = playstyle.characterProfile.ritualFrequency * 8;
    mythStatus += explorerBonus + ritualistBonus;
  }

  // Deed bonus - grand deeds are significant contributors
  if (deeds && deeds.length > 0) {
    mythStatus += Math.min(25, deeds.length * 7);
  }

  return Math.min(100, mythStatus);
}

/**
 * Calculate inherited perks based on myth status
 */
export function calculateInheritedPerks(player: PlayerState, mythStatus: number): string[] {
  const perks: string[] = [];

  if (mythStatus >= 30) {
    perks.push('bloodline_resilience');
  }
  if (mythStatus >= 50) {
    perks.push('ancestral_wisdom');
  }
  if (mythStatus >= 70) {
    perks.push('legendary_bearing');
  }
  if (mythStatus >= 90) {
    perks.push('myth_transcendence');
  }

  if (player?.unlockedAbilities && player.unlockedAbilities.length > 0) {
    player.unlockedAbilities.forEach((abilityId: string) => {
      if (abilityId.includes('legendary') || abilityId.includes('ancient')) {
        perks.push(`inherited_ability_${abilityId}`);
      }
    });
  }

  return perks;
}

/**
 * Calculate inherited items as heirlooms
 */
export function calculateInheritedItems(
  player: PlayerState,
  state: WorldState
): Array<{ itemId: string; rarity?: string }> {
  const items: Array<{ itemId: string; rarity?: string }> = [];

  if (!player?.inventory) return items;

  player.inventory.forEach((item: any) => {
    if (item.kind === 'unique') {
      // Check if item is marked as heirloom or has legendary/artifact rarity
      const template = (state as any).ITEM_TEMPLATES?.[item.itemId];
      if (item.isHeirloom || template?.rarity === 'legendary' || template?.rarity === 'artifact') {
        items.push({
          itemId: item.itemId,
          rarity: template?.rarity || item.rarity || 'legendary'
        });
      }
    }
  });

  return items;
}

/**
 * Canonize a character into legacy impact
 */
export function canonizeCharacter(
  player: PlayerState,
  state: WorldState,
  playstyle?: PlaystyleProfile,
  deeds?: string[]
): LegacyImpact {
  const rng = new SeededRng(state.seed);
  const pseudoTimestamp = rng.nextInt(1000000, 9999999);
  
  const mythStatus = calculateMythStatus(player, state, playstyle, deeds);
  const inheritedPerks = calculateInheritedPerks(player, mythStatus);
  const inheritedItems = calculateInheritedItems(player, state);

  const impact: LegacyImpact = {
    id: `legacy_${state.seed}_${pseudoTimestamp}`,
    chronicleId: state.chronicleId,
    canonicalName: player.name || 'Unknown Hero',
    bloodlineOrigin: ((state as any).worldTemplate?.name) || 'Unknown',
    mythStatus,
    deeds: deeds || [],
    factionInfluence: (player as any).factionReputation ? { ...(player as any).factionReputation } : {},
    inheritedPerks,
    ancestralCurses: [],
    epochsLived: ((state as any).epochMetadata?.sequenceNumber) || 1,
    totalGenerations: 1,
    soulEchoCount: 0,
    finalWorldState: 'neutral',
    paradoxDebt: 0,
    timestamp: pseudoTimestamp,
    inheritedItems: inheritedItems.map(item => ({
      itemId: item.itemId,
      rarity: item.rarity,
      ancestorName: player.name
    }))
  };

  return impact;
}

/**
 * Apply legacy perks to a new character
 */
export function applyLegacyPerks(player: PlayerState, legacy: LegacyImpact): PlayerState {
  (player as any).bloodlineData ??= {
    canonicalName: legacy.canonicalName,
    inheritedPerks: legacy.inheritedPerks,
    mythStatus: legacy.mythStatus,
    epochsLived: legacy.epochsLived,
    deeds: legacy.deeds
  };

  // Apply stat bonuses
  if (legacy.inheritedPerks.includes('bloodline_resilience')) {
    if (player?.maxHp) {
      player.maxHp = Math.floor(player.maxHp * 1.05);
    }
    if (player?.hp) {
      player.hp = Math.min(player.hp, player.maxHp || player.hp);
    }
  }

  if (legacy.inheritedPerks.includes('legendary_bearing')) {
    player.factionReputation ??= {};
    if (player.factionReputation) {
      Object.keys(legacy.factionInfluence).forEach(factionId => {
        player.factionReputation![factionId] = (player.factionReputation![factionId] || 0) + 20;
      });
    }
  }

  return player;
}

export const LegacyEngineExports = {
  getLegacyEngine,
  resetLegacyEngine,
  calculateMythStatus,
  canonizeCharacter,
  applyLegacyPerks
};
