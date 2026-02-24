/**
 * Canon Journal: Records meaningful mutations as "Lore Fragments"
 * Creates a narrative history of player impact on the world
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
}

export class CJ {
  private fragments: LoreFragment[] = [];
  private lastSummarizedTick = 0;

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
    postSummary: any
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
      tags
    };

    this.fragments.push(fragment);
    this.lastSummarizedTick = tickAfter;
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