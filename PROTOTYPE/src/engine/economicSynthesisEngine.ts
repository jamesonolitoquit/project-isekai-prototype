/**
 * Phase 27 Task 3: Economic Synthesis Engine
 * 
 * Links the world economy (TelemetryEngine) to tangible NPC behaviors:
 * - BOOM (score > 75): Caravans spawn and travel between trade nodes
 * - STABLE (25-75): Normal NPC activity, no special economic triggers
 * - RECESSION (score < 25): NPCs migrate to higher-economy zones, reduced activity
 * 
 * This engine ensures that economic metrics directly manifest as visible world changes,
 * creating a living, responsive economy that players can observe and influence.
 */

import type { WorldState, NPC } from './worldEngine';
import { random } from './prng';

/**
 * Economic cycle phases
 */
export enum EconomicCycle {
  BOOM = 'BOOM',           // Economy score > 75
  STABLE = 'STABLE',       // Economy score 25-75
  RECESSION = 'RECESSION'  // Economy score < 25
}

/**
 * Caravan merchant NPC (temporary entity for trading)
 */
export interface CaravanNPC extends NPC {
  isCaravan: true;
  fromLocationId: string;
  toLocationId: string;
  route: string[];                    // Waypoint path
  currentWaypointIndex: number;
  expiresAtTick: number;              // When caravan despawns
  caravanInventory: Array<{
    itemId: string;
    quantity: number;
    priceModifier: number;            // Percentage markup from base price
  }>;
}

/**
 * Economic cycle trigger result
 */
export interface EconomicCycleResult {
  cycle: EconomicCycle;
  economyScore: number;
  caravansSpawned: CaravanNPC[];
  migrationsTriggered: Array<{
    npcId: string;
    npcName: string;
    fromLocationId: string;
    toLocationId: string;
  }>;
  events: Array<{
    type: string;
    payload: any;
  }>;
}

/**
 * Economic Synthesis Engine: Converts economy metrics into NPC behaviors
 */
export class EconomicSynthesisEngine {
  private readonly caravanSpawnChance: Record<EconomicCycle, number> = {
    [EconomicCycle.BOOM]: 0.15,        // 15% chance per check in boom
    [EconomicCycle.STABLE]: 0.05,      // 5% chance in stable
    [EconomicCycle.RECESSION]: 0.01    // 1% chance in recession
  };

  private readonly migrationChance: Record<EconomicCycle, number> = {
    [EconomicCycle.BOOM]: 0,           // No migration during boom
    [EconomicCycle.STABLE]: 0.02,      // 2% migration chance
    [EconomicCycle.RECESSION]: 0.1     // 10% migration chance during recession
  };

  private readonly caravanDurationTicks = 2000; // Caravans last ~2000 ticks (game minutes)
  private readonly lastEconomicTriggerTick = -1000;
  private lastCycle = EconomicCycle.STABLE;

  /**
   * Determine economic cycle from economy score
   */
  getEconomicCycle(economyScore: number): EconomicCycle {
    if (economyScore > 75) return EconomicCycle.BOOM;
    if (economyScore < 25) return EconomicCycle.RECESSION;
    return EconomicCycle.STABLE;
  }

  /**
   * Process economic cycle: Check conditions and trigger consequences
   * Call every 100 ticks from advanceTick()
   */
  triggerEconomicCycle(state: WorldState, economyScore: number): EconomicCycleResult {
    const cycle = this.getEconomicCycle(economyScore);
    const result: EconomicCycleResult = {
      cycle,
      economyScore,
      caravansSpawned: [],
      migrationsTriggered: [],
      events: []
    };

    // Only trigger once per major economy shift to avoid spam
    const cycleChanged = cycle !== this.lastCycle;
    this.lastCycle = cycle;

    // Emit cycle change event if economy shifted
    if (cycleChanged) {
      result.events.push({
        type: `ECONOMY_${cycle}`,
        payload: {
          economyScore,
          cycle,
          message: this.getEconomicCycleNarrative(cycle, economyScore),
          timestamp: Date.now()
        }
      });
    }

    // === BOOM: Spawn caravans with high-value goods ===
    if (cycle === EconomicCycle.BOOM) {
      if (random() < this.caravanSpawnChance[EconomicCycle.BOOM]) {
        const caravan = this.spawnCaravan(state, economyScore);
        if (caravan) {
          result.caravansSpawned.push(caravan);
          result.events.push({
            type: 'ECONOMY_CARAVAN_SPAWNED',
            payload: {
              caravanId: caravan.id,
              caravanName: caravan.name,
              fromLocationId: caravan.fromLocationId,
              toLocationId: caravan.toLocationId,
              itemCount: caravan.caravanInventory.length,
              priceModifiers: caravan.caravanInventory.map(item => item.priceModifier),
              narrative: `A merchant caravan arrives, bringing exotic goods from distant lands!`
            }
          });
        }
      }
    }

    // === RECESSION: Trigger NPC migrations to safe zones ===
    if (cycle === EconomicCycle.RECESSION) {
      const migrations = this.triggerNpcMigrations(state, economyScore);
      result.migrationsTriggered = migrations;

      if (migrations.length > 0) {
        result.events.push({
          type: 'ECONOMY_MIGRATION_EXODUS',
          payload: {
            migratedNpcCount: migrations.length,
            migrations: migrations.map(m => ({
              npcName: m.npcName,
              from: m.fromLocationId,
              to: m.toLocationId
            })),
            narrative: `Economic hardship has driven several NPCs to seek refuge in safer regions.`
          }
        });
      }
    }

    return result;
  }

  /**
   * Spawn a caravan merchant NPC at a trade node
   * Caravans travel between major trade hubs with high-value inventory
   */
  private spawnCaravan(state: WorldState, economyScore: number): CaravanNPC | null {
    if (!state.locations || state.locations.length < 2) return null;

    // Pick two random trade locations
    const from = state.locations[Math.floor(random() * state.locations.length)];
    const to = state.locations[Math.floor(random() * state.locations.length)];

    if (from.id === to.id) return null; // Must be different locations

    // Create caravan inventory (boom economy = rarer items)
    const caravanInventory = this.generateCaravanInventory(state, economyScore);
    if (caravanInventory.length === 0) return null;

    const caravanId = `caravan_${Date.now()}_${Math.floor(random() * 0xffffff).toString(16)}`;
    const currentTick = state.tick ?? 0;

    const caravan: CaravanNPC = {
      id: caravanId,
      name: this.generateCaravanName(),
      locationId: from.id,
      isCaravan: true,
      fromLocationId: from.id,
      toLocationId: to.id,
      route: [from.id, to.id], // Simple 2-point route (can be enhanced to multi-waypoint)
      currentWaypointIndex: 0,
      expiresAtTick: currentTick + this.caravanDurationTicks,
      caravanInventory,
      hp: 50,
      maxHp: 50,
      stats: {
        str: 8,
        agi: 10,
        int: 12,
        cha: 14,
        end: 10,
        luk: 11
      },
      currentGoal: 'trade_route',
      availability: {
        startHour: 6,
        endHour: 22
      },
      statusEffects: []
    };

    return caravan;
  }

  /**
   * Generate caravan inventory based on economy score
   * Higher economy = rarer items, better prices for buyer
   */
  private generateCaravanInventory(
    state: WorldState,
    economyScore: number
  ): Array<{ itemId: string; quantity: number; priceModifier: number }> {
    const inventory: Array<{ itemId: string; quantity: number; priceModifier: number }> = [];

    // Sample cargo items (would pull from items.json in production)
    const cargoOptions = [
      { itemId: 'rare-silk', rarity: 'rare' },
      { itemId: 'spiced-tea', rarity: 'uncommon' },
      { itemId: 'arcane-scroll', rarity: 'rare' },
      { itemId: 'healing-elixir', rarity: 'uncommon' },
      { itemId: 'exotic-gem', rarity: 'epic' },
      { itemId: 'enchanted-trinket', rarity: 'rare' }
    ];

    // Select 3-6 random cargo items
    const itemCount = 3 + Math.floor(random() * 4);
    for (let i = 0; i < itemCount; i++) {
      const cargo = cargoOptions[Math.floor(random() * cargoOptions.length)];

      // Higher economy = items cost less to buy (negative markup)
      // Lower economy = items cost more (positive markup)
      let basePriceModifier: number;
      if (economyScore > 75) {
        basePriceModifier = -0.1;
      } else if (economyScore < 25) {
        basePriceModifier = 0.3;
      } else {
        basePriceModifier = 0.1;
      }
      const priceModifier = basePriceModifier + (random() * 0.1 - 0.05);

      inventory.push({
        itemId: cargo.itemId,
        quantity: 1 + Math.floor(random() * 3),
        priceModifier
      });
    }

    return inventory;
  }

  /**
   * Trigger NPC migrations away from recession zones
   * Permanent relocation to higher-economy locations
   */
  private triggerNpcMigrations(
    state: WorldState,
    economyScore: number
  ): Array<{ npcId: string; npcName: string; fromLocationId: string; toLocationId: string }> {
    const migrations: Array<{ npcId: string; npcName: string; fromLocationId: string; toLocationId: string }> = [];

    if (!state.npcs || state.npcs.length === 0 || !state.locations || state.locations.length === 0) {
      return migrations;
    }

    // Identify "Safe Havens" - locations with higher inherent value or faction control
    const safeHavens = state.locations.filter(
      (loc: any) => loc.biome === 'city' || loc.biome === 'settlement' || (loc.spiritDensity ?? 0) > 0.5
    );

    if (safeHavens.length === 0) {
      return migrations; // No migration destinations available
    }

    // Each NPC has a chance to migrate during recession
    for (const npc of state.npcs) {
      if (random() < this.migrationChance[EconomicCycle.RECESSION]) {
        const destination = safeHavens[Math.floor(random() * safeHavens.length)];

        if (destination.id !== npc.locationId) {
          migrations.push({
            npcId: npc.id,
            npcName: npc.name,
            fromLocationId: npc.locationId ?? 'unknown',
            toLocationId: destination.id
          });

          // Mark NPC as economic migrant (for behavioral changes)
          (npc as any).economicMigrant = true;
          (npc as any).migratedFromEconomy = economyScore;
        }
      }
    }

    return migrations;
  }

  /**
   * Generate narrative description for economic cycle
   */
  private getEconomicCycleNarrative(cycle: EconomicCycle, economyScore: number): string {
    switch (cycle) {
      case EconomicCycle.BOOM:
        return `The world's economy is flourishing (score: ${economyScore.toFixed(1)}). Merchants thrive, caravans grow frequent, and opportunity abounds. The smell of coins is in the air.`;
      case EconomicCycle.STABLE:
        return `The economy remains steady (score: ${economyScore.toFixed(1)}). Trade flows normally, NPCs go about their business. The world hums in familiar rhythm.`;
      case EconomicCycle.RECESSION:
        return `Economic hardship grips the world (score: ${economyScore.toFixed(1)}). Prices soar, trade slows, and NPCs seek refuge. Times are hard.`;
      default:
        return `The economy shifts (score: ${economyScore.toFixed(1)}).`;
    }
  }

  /**
   * Generate random caravan names
   */
  private generateCaravanName(): string {
    const adjectives = ['Swift', 'Golden', 'Royal', 'Merchant', 'Wandering', 'Star'];
    const nouns = ['Caravan', 'Company', 'Traders', 'Merchants', 'Fellowship', 'Convoy'];
    const adj = adjectives[Math.floor(random() * adjectives.length)];
    const noun = nouns[Math.floor(random() * nouns.length)];
    return `${adj} ${noun}`;
  }

  /**
   * Check if an NPC is an economic migrant
   */
  static isEconomicMigrant(npc: NPC): boolean {
    return (npc as any).economicMigrant === true;
  }

  /**
   * Check if an NPC is a caravan
   */
  static isCaravan(npc: NPC): npc is CaravanNPC {
    return (npc as any).isCaravan === true;
  }
}

/**
 * Global singleton instance
 */
let economicSynthesisEngineInstance: EconomicSynthesisEngine | null = null;

export function getEconomicSynthesisEngine(): EconomicSynthesisEngine {
  if (!economicSynthesisEngineInstance) {
    economicSynthesisEngineInstance = new EconomicSynthesisEngine();
  }
  return economicSynthesisEngineInstance;
}

/**
 * Initialize Economic Synthesis Engine (call on startup)
 */
export function initializeEconomicSynthesisEngine(): EconomicSynthesisEngine {
  economicSynthesisEngineInstance = new EconomicSynthesisEngine();
  console.log('[EconomicSynthesis] Engine initialized');
  return economicSynthesisEngineInstance;
}
