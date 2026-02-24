/**
 * Canon Journal: Records meaningful mutations as "Lore Fragments"
 * Creates a narrative history of player impact on the world
 * 
 * M7 Enhancement: Historical Summarization
 * - Converts raw fragments into "Weekly Chronicles" entries
 * - Identifies Pivot Points (high-impact narrative moments)
 * - Anchors NPCs to historical context for dynamic dialogue
 */

export interface LoreFragment {
  tick: number;
  timestamp: Date;
  title: string; // Short lore summary
  description: string; // Full narrative
  actionType: string; // Action type that caused this
  eventTypes: string[]; // Events emitted
  priority: 'mundane' | 'significant' | 'historic'; // How important to player story
  tags: string[]; // Searchable tags (e.g., 'quest-complete', 'faction-conflict')
  divergenceScore?: number; // M5 Oracle impact score (0-1.0)
}

/**
 * M7: Pivot point - a major narrative turning point
 */
export interface NarrativePivot {
  tick: number;
  timestamp: Date;
  title: string;
  description: string;
  divergenceScore: number; // 0-1.0: how much this changed the world
  affectedFactions: string[];
  affectedLocations: string[];
  thematicCategory: 'conflict' | 'revelation' | 'transformation' | 'sacrifice' | 'triumph' | 'paradox';
  narrative: string; // NPC-friendly narrative hook
}

/**
 * M7: Weekly Chronicle - summarized historical entry
 */
export interface WeeklyChronicle {
  weekNumber: number;
  startTick: number;
  endTick: number;
  title: string;
  summary: string;
  majorEvents: LoreFragment[];
  pivotPoints: NarrativePivot[];
  worldStateSnapshot: {
    playerLevel: number;
    majorLocations: string[];
    activeConflicts: string[];
    discoveredArtifacts: string[];
  };
}

export class CJ {
  private fragments: LoreFragment[] = [];
  private lastSummarizedTick = 0;
  private chronicles: WeeklyChronicle[] = []; // M7: Historical summaries
  private pivotPoints: NarrativePivot[] = []; // M7: Major turning points
  private narrativeAnchors: Map<string, NarrativePivot[]> = new Map(); // M7: Anchors for NPC dialogue

  constructor(public worldId: string) {}

  /**
   * Record a mutation as a lore fragment
   */
  recordMutation(
    tickBefore: number,
    tickAfter: number,
    action: any,
    preSummary: any,
    events: any[],
    postSummary: any,
    divergenceScore?: number // M7: Optional impact score from Oracle
  ): void {
    if (events.length === 0) return; // No meaningful events

    // Determine if this is a significant moment
    const significantEventTypes = [
      'QUEST_COMPLETED',
      'LEVEL_UP',
      'ENCOUNTER_TRIGGERED',
      'RELIC_BOUND',
      'LOCATION_DISCOVERED',
      'CHARACTER_MORPHED',
      'FACTION_CONFLICT_START',
      'PARADOX_SURGE'
    ];

    const hasSignificantEvent = events.some((e) => significantEventTypes.includes(e.type));
    const priority = hasSignificantEvent ? 'significant' : 'mundane';

    // Generate lore-style title and description
    const { title, description, tags } = this.generateLoreText(
      action,
      events,
      preSummary,
      postSummary,
      priority
    );

    const fragment: LoreFragment = {
      tick: tickAfter,
      timestamp: new Date(),
      title,
      description,
      actionType: action.type,
      eventTypes: events.map((e) => e.type),
      priority,
      tags,
      divergenceScore: divergenceScore ?? 0 // M7: Store Oracle score
    };

    this.fragments.push(fragment);
    this.lastSummarizedTick = tickAfter;

    // M7: Detect if this is a narrative pivot point
    if (divergenceScore && divergenceScore > 0.6) {
      this.recordPivotPoint(fragment, events, preSummary, postSummary, divergenceScore);
    }
  }

  /**
   * M7: Record a significant turning point in the narrative
   */
  private recordPivotPoint(
    fragment: LoreFragment,
    events: any[],
    preSummary: any,
    postSummary: any,
    divergenceScore: number
  ): void {
    const thematicCategory = this.determineThematicCategory(events);
    
    // Extract affected factions and locations from events
    const affectedFactions = this.extractAffectedFactions(events, postSummary);
    const affectedLocations = this.extractAffectedLocations(events, postSummary);

    // Build NPC-friendly narrative hook
    const narrativeHook = this.buildNarrativeHook(fragment, thematicCategory, affectedFactions);

    const pivot: NarrativePivot = {
      tick: fragment.tick,
      timestamp: fragment.timestamp,
      title: fragment.title,
      description: fragment.description,
      divergenceScore,
      affectedFactions,
      affectedLocations,
      thematicCategory,
      narrative: narrativeHook
    };

    this.pivotPoints.push(pivot);

    // M7: Register narrative anchors for affected factions/locations
    for (const faction of affectedFactions) {
      if (!this.narrativeAnchors.has(faction)) {
        this.narrativeAnchors.set(faction, []);
      }
      this.narrativeAnchors.get(faction)!.push(pivot);
    }
  }

  /**
   * M7: Categorize event as thematic type
   */
  private determineThematicCategory(
    events: any[]
  ): 'conflict' | 'revelation' | 'transformation' | 'sacrifice' | 'triumph' | 'paradox' {
    if (events.some(e => e.type === 'PARADOX_SURGE')) return 'paradox';
    if (events.some(e => e.type === 'FACTION_CONFLICT_START')) return 'conflict';
    if (events.some(e => e.type === 'RELIC_BOUND')) return 'transformation';
    if (events.some(e => e.type === 'QUEST_COMPLETED')) return 'triumph';
    if (events.some(e => e.type === 'LOCATION_DISCOVERED')) return 'revelation';
    return 'triumph';
  }

  /**
   * M7: Extract affected factions from events
   */
  private extractAffectedFactions(events: any[], state: any): string[] {
    const factions = new Set<string>();
    
    events.forEach(e => {
      if (e.payload?.factionId) factions.add(e.payload.factionId);
      if (e.payload?.faction1Id) factions.add(e.payload.faction1Id);
      if (e.payload?.faction2Id) factions.add(e.payload.faction2Id);
    });

    // Add player's current faction
    if (state?.player?.primaryFaction) {
      factions.add(state.player.primaryFaction);
    }

    return Array.from(factions);
  }

  /**
   * M7: Extract affected locations from events
   */
  private extractAffectedLocations(events: any[], state: any): string[] {
    const locations = new Set<string>();

    events.forEach(e => {
      if (e.payload?.location) locations.add(e.payload.location);
      if (e.payload?.areaName) locations.add(e.payload.areaName);
    });

    // Add player's current location
    if (state?.player?.location) {
      locations.add(state.player.location);
    }

    return Array.from(locations);
  }

  /**
   * M7: Build NPC-friendly narrative hook from pivot point
   */
  private buildNarrativeHook(
    fragment: LoreFragment,
    category: string,
    factions: string[]
  ): string {
    const hooks: Record<string, string> = {
      conflict: `Dark times fell upon the ${factions[0] || 'realm'} when ${fragment.title.toLowerCase()}. The consequences ripple through all factions.`,
      revelation: `A great discovery shook the foundations of knowledge: ${fragment.title.toLowerCase()}. None who heard of it remained unchanged.`,
      transformation: `Reality itself shifted when ${fragment.title.toLowerCase()}. What was cannot be again.`,
      sacrifice: `One gave much so that others might live. When ${fragment.title.toLowerCase()}, balance was forever altered.`,
      triumph: `Against great odds, ${fragment.title.toLowerCase()}. Hope was rekindled, and legends were written.`,
      paradox: `The threads of fate tangled impossibly when ${fragment.title.toLowerCase()}. Reality groans under the strain.`
    };

    return hooks[category] || fragment.description;
  }

  /**
   * M7: Summarize fragments into a Weekly Chronicle
   */
  summarizeAsChronicle(
    startTick: number,
    endTick: number,
    worldState: any,
    weekNumber: number = this.chronicles.length + 1
  ): WeeklyChronicle {
    // Find fragments in range
    const weekFragments = this.fragments.filter(
      f => f.tick >= startTick && f.tick <= endTick
    );

    // Find pivot points in range
    const weekPivots = this.pivotPoints.filter(
      p => p.tick >= startTick && p.tick <= endTick
    );

    // Get major events (significant and historic)
    const majorEvents = weekFragments.filter(
      f => f.priority !== 'mundane'
    ).sort((a, b) => b.divergenceScore! - a.divergenceScore!);

    // Build chronicle title based on major events
    const title = this.buildChronicleTitle(majorEvents, weekPivots);

    // Build summary
    const summary = this.buildChronicleSummary(majorEvents, weekPivots);

    const chronicle: WeeklyChronicle = {
      weekNumber,
      startTick,
      endTick,
      title,
      summary,
      majorEvents: majorEvents.slice(0, 5), // Top 5 events
      pivotPoints: weekPivots,
      worldStateSnapshot: {
        playerLevel: worldState?.player?.level ?? 1,
        majorLocations: worldState?.locations?.map((l: any) => l.name).slice(0, 5) ?? [],
        activeConflicts: worldState?.activeConflicts ?? [],
        discoveredArtifacts: worldState?.player?.relicBindings ?? []
      }
    };

    this.chronicles.push(chronicle);
    return chronicle;
  }

  /**
   * M7: Build title for chronicle based on events
   */
  private buildChronicleTitle(
    events: LoreFragment[],
    pivots: NarrativePivot[]
  ): string {
    if (pivots.length === 0) {
      return `Week of Quiet Times`;
    }

    const pivot = pivots[0];
    const pivotTitle: Record<string, string> = {
      conflict: `The Week of Conflict`,
      revelation: `The Week of Revelation`,
      transformation: `The Week of Change`,
      sacrifice: `The Week of Sacrifice`,
      triumph: `The Week of Victory`,
      paradox: `The Week of Fracture`
    };

    return pivotTitle[pivot.thematicCategory] || `Week of ${events[0]?.title || 'Importance'}`;
  }

  /**
   * M7: Build narrative summary for chronicle
   */
  private buildChronicleSummary(
    events: LoreFragment[],
    pivots: NarrativePivot[]
  ): string {
    if (events.length === 0) {
      return `A quiet period fell upon the land. The world held its breath, waiting for the next turn of fate's wheel.`;
    }

    const eventSummaries = events
      .slice(0, 3)
      .map(e => e.title)
      .join('. ');

    if (pivots.length === 0) {
      return `In this period, notable events occurred: ${eventSummaries}. Life moved forward, one moment at a time.`;
    }

    const pivotNarrative = pivots[0].narrative;
    return `${pivotNarrative} Additionally, ${eventSummaries.toLowerCase()} shaped the unfolding story.`;
  }

  /**
   * M7: Get narrative anchors for a faction/NPC group
   */
  getNarrativeAnchorsFor(factionId: string): NarrativePivot[] {
    return this.narrativeAnchors.get(factionId) ?? [];
  }

  /**
   * M7 Phase 3: Get dialogue anchors for a specific NPC
   * Returns the most relevant historical strings for a specific character interaction
   * filtered by faction, location, and recency
   */
  getDialogueAnchors(
    npcId: string,
    factionId?: string,
    locationId?: string
  ): { anchors: NarrativePivot[]; rumor?: string; locationHistory?: boolean } {
    // Get faction-based anchors if faction provided
    const factionAnchors = factionId
      ? this.getNarrativeAnchorsFor(factionId)
      : [];

    // Filter anchors by location if provided
    const locationAnchors = locationId
      ? factionAnchors.filter(a => a.affectedLocations.includes(locationId))
      : factionAnchors;

    // Sort by recency (most recent first)
    const sortedAnchors = locationAnchors
      .sort((a, b) => b.tick - a.tick)
      .slice(0, 5); // Top 5 most recent

    // Generate optional rumor hook for "Rumor Mill" fallback
    let rumor: string | undefined;
    if (sortedAnchors.length > 0) {
      const recentChronicle = this.chronicles[this.chronicles.length - 1];
      if (recentChronicle) {
        rumor = `I've heard tales of ${recentChronicle.title.toLowerCase()}. They say ${recentChronicle.summary.substring(0, 80)}...`;
      }
    }

    // Check if location has been affected by any pivots
    const locationAffected = locationId
      ? this.wasLocationAffected(locationId)
      : false;

    return {
      anchors: sortedAnchors,
      rumor,
      locationHistory: locationAffected
    };
  }

  /**
   * M7: Get most recent pivot points (high-impact moments NPCs might reference)
   */
  getRecentPivotPoints(count: number = 5): NarrativePivot[] {
    return this.pivotPoints.slice(-count).reverse();
  }

  /**
   * M7: Check if a location was involved in recent pivots
   */
  wasLocationAffected(locationId: string, recentTickWindow: number = 1000): boolean {
    const recentPivots = this.pivotPoints.filter(p => p.tick > (this.lastSummarizedTick - recentTickWindow));
    return recentPivots.some(p => p.affectedLocations.includes(locationId));
  }

  /**
   * M7: Get chronicles within a range
   */
  getChronicles(startWeek: number = 0, endWeek?: number): WeeklyChronicle[] {
    const end = endWeek ?? this.chronicles.length;
    return this.chronicles.slice(startWeek, end);
  }

  /**
   * Retrieve recent fragments
   */
  getRecent(n: number = 10): LoreFragment[] {
    return this.fragments.slice(-n).reverse();
  }

  /**
   * Get all fragments
   */
  getAllFragments(): LoreFragment[] {
    return [...this.fragments];
  }

  /**
   * Generate narrative lore text from action and events
   */
  private generateLoreText(
    action: any,
    events: any[],
    preSummary: any,
    postSummary: any,
    priority: string
  ): { title: string; description: string; tags: string[] } {
    const tags: string[] = [];
    let title = '';
    let description = '';

    // Map action types to lore narratives
    if (events.some((e) => e.type === 'QUEST_COMPLETED')) {
      const questEvent = events.find((e) => e.type === 'QUEST_COMPLETED');
      title = `Quest Complete: ${questEvent.payload.questTitle || 'Unknown'}`;
      description = `The Hero completed an important task. ${questEvent.payload.questTitle || 'A quest of significance'} has been fulfilled, bringing the player one step closer to their destiny.`;
      tags.push('quest-complete');
    } else if (events.some((e) => e.type === 'LEVEL_UP')) {
      const levelEvent = events.find((e) => e.type === 'LEVEL_UP');
      title = `Level Up! Reached Level ${levelEvent.payload.newLevel}`;
      description = `The Hero grows stronger. Through trials and perseverance, the player has ascended to a new level of power, unlocking greater potential.`;
      tags.push('player-growth');
    } else if (events.some((e) => e.type === 'ENCOUNTER_TRIGGERED')) {
      const encounterEvent = events.find((e) => e.type === 'ENCOUNTER_TRIGGERED');
      title = `Encounter: ${encounterEvent.payload.encounterType || 'Unknown Foe'}`;
      description = `The Hero faced a challenge on the road. An unexpected encounter tested their skill and resolve.`;
      tags.push('combat', 'adventure');
    } else if (events.some((e) => e.type === 'RELIC_BOUND')) {
      const relicEvent = events.find((e) => e.type === 'RELIC_BOUND');
      title = `Bound to ${relicEvent.payload.relicName}`;
      description = `The Hero's soul became intertwined with an artifact of power. A permanent bond was forged, granting immense power at great cost.`;
      tags.push('artifact', 'binding');
    } else if (events.some((e) => e.type === 'LOCATION_DISCOVERED')) {
      const locEvent = events.find((e) => e.type === 'LOCATION_DISCOVERED');
      title = `Discovered: ${locEvent.payload.areaName}`;
      description = `The Hero uncovered a hidden place. ${locEvent.payload.areaDescription || 'A secret yet untold.'} has been added to the chronicles.`;
      tags.push('exploration', 'discovery');
    } else if (events.some((e) => e.type === 'CHARACTER_MORPHED')) {
      const morphEvent = events.find((e) => e.type === 'CHARACTER_MORPHED');
      title = `Transformed: The Hero became ${morphEvent.payload.newRace}`;
      description = `The Hero's form changed. Through mysterious magic, the player transformed into a new shape, experiencing the world anew.`;
      tags.push('transformation', 'magic');
    } else if (events.some((e) => e.type === 'FACTION_CONFLICT_START')) {
      const conflictEvent = events.find((e) => e.type === 'FACTION_CONFLICT_START');
      title = `Faction Conflict: ${conflictEvent.payload.faction1Id} vs ${conflictEvent.payload.faction2Id}`;
      description = `Deep tensions between rival factions erupted into open conflict. The world's political landscape shifted, and the Hero's choices will shape the outcome.`;
      tags.push('politics', 'conflict');
    } else if (events.some((e) => e.type === 'PARADOX_SURGE')) {
      title = `Reality Fractured: Paradox Surge`;
      description = `The barriers between worlds grew thin. Reality itself groaned under the weight of paradox, and strange events began to unfold.`;
      tags.push('paradox', 'danger');
    } else if (action.type === 'MOVE') {
      title = `Traveled to ${action.payload?.to || 'Unknown Location'}`;
      description = `The Hero ventured to a new place. The journey was ${events.some((e) => e.type.includes('ENCOUNTER')) ? 'eventful' : 'uneventful'}.`;
      tags.push('travel');
    } else if (action.type === 'INTERACT_NPC') {
      title = `Met with an NPC`;
      description = `The Hero engaged in conversation. New information and opportunities emerged from the encounter.`;
      tags.push('interaction');
    } else if (action.type === 'ATTACK') {
      title = `Combat: The Hero struck in battle`;
      description = `Swords clashed and spells flew. The Hero fought valiantly against their opponent.`;
      tags.push('combat');
    } else if (action.type === 'CRAFT_ITEM') {
      title = `Crafted an item`;
      description = `The Hero's hands worked steadily. A new item was carefully crafted from raw materials, imbued with purpose.`;
      tags.push('crafting');
    } else if (action.type === 'CAST_SPELL') {
      title = `Cast a spell`;
      description = `Magical forces bent to the Hero's will. A spell was woven into reality, affecting the world around them.`;
      tags.push('magic');
    } else {
      // Generic action
      title = `Action: ${action.type}`;
      description = `The Hero performed an action of note: ${action.type}. The world responded to their choices.`;
      tags.push('action');
    }

    return { title, description, tags };
  }
}

export function summarizeStateMinimal(state: any) {
  return {
    playerLevel: state.player?.level,
    playerLocation: state.player?.location,
    playerHp: state.player?.hp,
    questsActive: Object.keys(state.player?.quests || {}).filter(
      (q) => state.player?.quests[q]?.status === 'in_progress'
    ).length,
    temporalDebt: state.player?.temporalDebt,
    soulStrain: state.player?.soulStrain,
    factionRep: state.player?.factionReputation || {},
    tick: state.tick
  };
}

export default CJ;