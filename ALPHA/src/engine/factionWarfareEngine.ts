/**
 * factionWarfareEngine.ts - M44-T2/E4: Territory Control & Skirmish System
 * Manages faction rivalry, territorial expansion, and combat resolution.
 */

import { SeededRng } from './prng';
import type { WorldState } from './worldEngine';

export interface Faction {
  id: string;
  name: string;
  abbr: string;
  color: string;
  alignment: 'lawful' | 'chaotic' | 'neutral';
  primaryLocationId: string;
  controlledLocations: string[];
  militaryStrength: number;
  treasury: number;
  reputation: number;
  isExtinct: boolean;
  alliesOf: string[];
  enemiesOf: string[];
  treatyWith: string[];
}

export interface LocationInfluence {
  locationId: string;
  controllingFactionId: string;
  militaryGarrisonStrength: number;
  fortificationLevel: number;
  isLedByNpc?: string;
  lastChangedAtTick?: number;
}

export interface SkirmishEvent {
  id: string;
  tick: number;
  locationId: string;
  attackingFactionId: string;
  defendingFactionId: string;
  incitedByNpcId?: string;
  attackStrength: number;
  defenseStrength: number;
  outcome: 'attacker_victory' | 'defender_victory' | 'stalemate';
  casualtyCount: number;
  militaryDesertion: number;
  capturedNpcIds: string[];
  falloutReputation: Record<string, number>;
  narrative: string;
}

export interface WarZoneStatus {
  locationId: string;
  isConflicted: boolean;
  lastSkirmishTick?: number;
  skirmishEventIds: string[];
  conflictIntensity: number;
}

export interface TreatyPact {
  id: string;
  faction1Id: string;
  faction2Id: string;
  treatyType: 'alliance' | 'non_aggression' | 'trade' | 'vassalage';
  startTick: number;
  durationInTicks?: number;
  isActive: boolean;
  diplomatNpcId?: string;
}

class FactionWarfareEngine {
  private factions: Map<string, Faction> = new Map();
  private locationInfluence: Map<string, LocationInfluence> = new Map();
  private skirmishEvents: Map<string, SkirmishEvent> = new Map();
  private warZones: Map<string, WarZoneStatus> = new Map();
  private treatyPacts: Map<string, TreatyPact> = new Map();
  private rng: SeededRng;

  constructor(seed: number) {
    this.rng = new SeededRng(seed);
  }

  registerFaction(faction: Faction): void {
    this.factions.set(faction.id, faction);
    this.locationInfluence.set(faction.primaryLocationId, {
      locationId: faction.primaryLocationId,
      controllingFactionId: faction.id,
      militaryGarrisonStrength: faction.militaryStrength,
      fortificationLevel: 3
    });
  }

  getFaction(factionId: string): Faction | undefined {
    return this.factions.get(factionId);
  }

  getAllFactions(): Faction[] {
    return Array.from(this.factions.values());
  }

  getControllingFaction(locationId: string): Faction | undefined {
    const influence = this.locationInfluence.get(locationId);
    if (!influence) return undefined;
    return this.factions.get(influence.controllingFactionId);
  }

  setLocationControl(locationId: string, factionId: string, garrisonStrength: number, fortification: number = 1): void {
    this.locationInfluence.set(locationId, {
      locationId,
      controllingFactionId: factionId,
      militaryGarrisonStrength: garrisonStrength,
      fortificationLevel: fortification,
      lastChangedAtTick: this.rng.nextInt(0, 100000)
    });

    const faction = this.factions.get(factionId);
    if (faction) {
      if (!faction.controlledLocations.includes(locationId)) {
        faction.controlledLocations.push(locationId);
      }
    }
  }

  initiateSkirmish(
    locationId: string,
    attackingFactionId: string,
    defendingFactionId: string,
    incitedByNpcId?: string
  ): SkirmishEvent | null {
    const attackingFaction = this.factions.get(attackingFactionId);
    const defendingFaction = this.factions.get(defendingFactionId);

    if (!attackingFaction || !defendingFaction) {
      return null;
    }

    const influence = this.locationInfluence.get(locationId);
    if (!influence) {
      return null;
    }

    const attackStrength = Math.max(1, attackingFaction.militaryStrength + this.rng.nextInt(-10, 10));
    const defenseStrength = Math.max(1, (influence.militaryGarrisonStrength || 5) + (influence.fortificationLevel || 1) * 2 + this.rng.nextInt(-5, 5));

    let outcome: SkirmishEvent['outcome'];
    let casualtyMultiplier = 1;

    if (attackStrength > defenseStrength * 1.5) {
      outcome = 'attacker_victory';
      casualtyMultiplier = 0.8;
    } else if (defenseStrength > attackStrength * 1.5) {
      outcome = 'defender_victory';
      casualtyMultiplier = 0.6;
    } else {
      outcome = 'stalemate';
      casualtyMultiplier = 1.2;
    }

    const casualtyCount = Math.round((attackStrength + defenseStrength) * casualtyMultiplier * 0.3);
    const militaryDesertion = this.rng.nextInt(0, Math.max(1, casualtyCount / 5));

    const skirmish: SkirmishEvent = {
      id: `skirmish_${locationId}_${Date.now()}`,
      tick: this.rng.nextInt(0, 100000),
      locationId,
      attackingFactionId,
      defendingFactionId,
      incitedByNpcId,
      attackStrength,
      defenseStrength,
      outcome,
      casualtyCount,
      militaryDesertion,
      capturedNpcIds: [],
      falloutReputation: {
        [attackingFactionId]: outcome === 'attacker_victory' ? 15 : (outcome === 'defender_victory' ? -10 : 0),
        [defendingFactionId]: outcome === 'defender_victory' ? 10 : (outcome === 'attacker_victory' ? -15 : 0)
      },
      narrative: this.generateSkirmishNarrative(
        attackingFaction.name,
        defendingFaction.name,
        outcome,
        locationId
      )
    };

    this.skirmishEvents.set(skirmish.id, skirmish);

    if (outcome === 'attacker_victory') {
      this.setLocationControl(locationId, attackingFactionId, attackStrength / 2, 1);
      attackingFaction.controlledLocations.push(locationId);
      defendingFaction.controlledLocations = defendingFaction.controlledLocations.filter(id => id !== locationId);
      defendingFaction.reputation -= 10;
    } else if (outcome === 'defender_victory') {
      defendingFaction.militaryStrength += Math.ceil(casualtyCount * 0.2);
      attackingFaction.militaryStrength -= casualtyCount;
    }

    attackingFaction.militaryStrength -= casualtyCount;
    defendingFaction.militaryStrength -= Math.ceil(casualtyCount * 0.5);

    this.recordWarZone(locationId, casualtyCount > 20);

    return skirmish;
  }

  private recordWarZone(locationId: string, isIntense: boolean): void {
    let zone = this.warZones.get(locationId);
    if (!zone) {
      zone = {
        locationId,
        isConflicted: true,
        skirmishEventIds: [],
        conflictIntensity: 0
      };
      this.warZones.set(locationId, zone);
    }

    zone.isConflicted = true;
    zone.conflictIntensity = Math.min(100, zone.conflictIntensity + (isIntense ? 25 : 10));
    zone.lastSkirmishTick = this.rng.nextInt(0, 100000);
  }

  private generateSkirmishNarrative(attacker: string, defender: string, outcome: string, locationId: string): string {
    const narratives: Record<string, string[]> = {
      'attacker_victory': [
        `The ${attacker} forces overwhelmed the ${defender} garrison at ${locationId}.`,
        `${attacker} claimed victory over ${defender}, seizing control of ${locationId}.`,
        `The assault by ${attacker} was devastating; ${defender} fell back in disarray.`
      ],
      'defender_victory': [
        `${defender} held firm against the ${attacker} onslaught in ${locationId}.`,
        `The ${attacker} attack was repelled by the stalwart defense of ${defender}.`,
        `Victory went to ${defender}, who successfully defended ${locationId}.`
      ],
      'stalemate': [
        `The battle between ${attacker} and ${defender} at ${locationId} ended without clear victory.`,
        `Neither ${attacker} nor ${defender} could claim dominance in the conflict at ${locationId}.`,
        `The skirmish at ${locationId} between ${attacker} and ${defender} exhausted both sides.`
      ]
    };

    const array = narratives[outcome] || narratives['stalemate'];
    return array[this.rng.nextInt(0, array.length - 1)];
  }

  getSkirmishesAtLocation(locationId: string): SkirmishEvent[] {
    return Array.from(this.skirmishEvents.values()).filter(s => s.locationId === locationId);
  }

  getAllSkirmishes(): SkirmishEvent[] {
    return Array.from(this.skirmishEvents.values());
  }

  getWarZone(locationId: string): WarZoneStatus | undefined {
    return this.warZones.get(locationId);
  }

  decrementWarZoneIntensity(locationId: string, decrement: number = 5): void {
    const zone = this.warZones.get(locationId);
    if (zone) {
      zone.conflictIntensity = Math.max(0, zone.conflictIntensity - decrement);
      if (zone.conflictIntensity === 0) {
        zone.isConflicted = false;
      }
    }
  }

  createTreatyPact(pact: TreatyPact): void {
    this.treatyPacts.set(pact.id, pact);

    const faction1 = this.factions.get(pact.faction1Id);
    const faction2 = this.factions.get(pact.faction2Id);

    if (faction1 && faction2) {
      if (pact.treatyType === 'alliance') {
        if (!faction1.alliesOf.includes(pact.faction2Id)) faction1.alliesOf.push(pact.faction2Id);
        if (!faction2.alliesOf.includes(pact.faction1Id)) faction2.alliesOf.push(pact.faction1Id);
      }
    }
  }

  getTreatyBetween(faction1Id: string, faction2Id: string): TreatyPact | undefined {
    return Array.from(this.treatyPacts.values()).find(t =>
      (t.faction1Id === faction1Id && t.faction2Id === faction2Id) ||
      (t.faction1Id === faction2Id && t.faction2Id === faction1Id)
    );
  }

  getAllTreaties(): TreatyPact[] {
    return Array.from(this.treatyPacts.values());
  }

  calculateFactionPower(factionId: string): number {
    const faction = this.factions.get(factionId);
    if (!faction) return 0;

    const locationValue = faction.controlledLocations.length * 10;
    const militaryValue = faction.militaryStrength;
    const treasuryValue = Math.floor(faction.treasury / 100);
    const allyBonus = faction.alliesOf.length * 5;

    return locationValue + militaryValue + treasuryValue + allyBonus;
  }

  clearSkirmishHistory(): void {
    this.skirmishEvents.clear();
  }

  updateFromWorldState(state: WorldState): void {
    // Syncs faction data with world state if needed
  }

  reset(): void {
    this.factions.clear();
    this.locationInfluence.clear();
    this.skirmishEvents.clear();
    this.warZones.clear();
    this.treatyPacts.clear();
  }
}

let factionEngineInstance: FactionWarfareEngine | null = null;

export function getFactionWarfareEngine(seed: number = 12345): FactionWarfareEngine {
  if (!factionEngineInstance) {
    factionEngineInstance = new FactionWarfareEngine(seed);
  }
  return factionEngineInstance;
}

export function resetFactionWarfareEngine(): void {
  if (factionEngineInstance) {
    factionEngineInstance.reset();
    factionEngineInstance = null;
  }
}

export const FactionWarfareEngineExports = {
  getFactionWarfareEngine,
  resetFactionWarfareEngine
};
