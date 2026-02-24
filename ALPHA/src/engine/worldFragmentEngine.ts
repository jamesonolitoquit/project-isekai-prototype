/**
 * worldFragmentEngine.ts - M43 Task A.4: Persistent World Objects with Weathering
 * Manages world fragments with lifecycle progression from pristine to destroyed.
 */

import { SeededRng } from './prng';
import type { WorldState } from './worldEngine';

export type FragmentDurability = 'pristine' | 'weathered' | 'crumbling' | 'ruined' | 'destroyed';

export interface FragmentDurabilityState {
  durationTick: number;
  currentDurability: FragmentDurability;
  durabilityScore: number;
  weatheringRate: number;
  environmentalStressors: string[];
  lastWeatherTick: number;
  recentDamage: Array<{ source: string; amount: number; tick: number; }>;
}

export interface WorldFragment {
  id: string;
  name: string;
  fragmentType: 'ruin' | 'monument' | 'shrine' | 'tomb' | 'statue' | 'artifact_location' | 'nexus';
  locationId: string;
  description: string;
  loreContent: string;
  createdFromEvent?: { eventId: string; eventType: string; eventTick: number; };
  durabilityState: FragmentDurabilityState;
  discoveryChance: number;
  isDiscovered: boolean;
  discoveredAt?: number;
  isSealed?: boolean;
  sealingReason?: string;
  interactableObjects: Array<{ id: string; name: string; canTake: boolean; value: number; }>;
  hasSecretArea: boolean;
  secretAreaContent?: string;
  emotionalResonance: number;
  timeLeftUntilDecay: number;
}

export interface WorldFragmentRegistry {
  id: string;
  fragments: Map<string, WorldFragment>;
  locationFragmentIndex: Map<string, string[]>;
  totalFragmentsCreated: number;
  totalFragmentsDestroyed: number;
  fragmentsByState: Map<FragmentDurability, number>;
}

class WorldFragmentEngine {
  private registry: WorldFragmentRegistry;
  private rng: SeededRng;

  constructor(seed: number = 12345) {
    this.rng = new SeededRng(seed);
    this.registry = {
      id: `registry_${Date.now()}`,
      fragments: new Map(),
      locationFragmentIndex: new Map(),
      totalFragmentsCreated: 0,
      totalFragmentsDestroyed: 0,
      fragmentsByState: new Map([
        ['pristine', 0],
        ['weathered', 0],
        ['crumbling', 0],
        ['ruined', 0],
        ['destroyed', 0]
      ])
    };
  }

  createWorldFragment(
    name: string,
    fragmentType: WorldFragment['fragmentType'],
    locationId: string,
    loreContent: string,
    createdFromEvent?: { eventId: string; eventType: string; eventTick: number; }
  ): WorldFragment {
    const fragment: WorldFragment = {
      id: `fragment_${locationId}_${Date.now()}`,
      name,
      fragmentType,
      locationId,
      description: this.generateDescription(fragmentType, name),
      loreContent,
      createdFromEvent,
      durabilityState: {
        durationTick: 0,
        currentDurability: 'pristine',
        durabilityScore: 100,
        weatheringRate: this.rng.nextInt(1, 5) / 100,
        environmentalStressors: [],
        lastWeatherTick: 0,
        recentDamage: []
      },
      discoveryChance: this.rng.nextInt(30, 100) / 100,
      isDiscovered: false,
      interactableObjects: this.generateInteractableObjects(fragmentType),
      hasSecretArea: this.rng.nextInt(0, 100) > 70,
      emotionalResonance: this.rng.nextInt(20, 100),
      timeLeftUntilDecay: this.rng.nextInt(1000, 5000)
    };

    if (fragment.hasSecretArea) {
      fragment.secretAreaContent = this.generateSecretContent(fragmentType);
    }

    this.registry.fragments.set(fragment.id, fragment);
    this.registry.totalFragmentsCreated++;

    if (!this.registry.locationFragmentIndex.has(locationId)) {
      this.registry.locationFragmentIndex.set(locationId, []);
    }
    this.registry.locationFragmentIndex.get(locationId)!.push(fragment.id);

    const state = fragment.durabilityState.currentDurability;
    const count = this.registry.fragmentsByState.get(state) || 0;
    this.registry.fragmentsByState.set(state, count + 1);

    return fragment;
  }

  private generateDescription(type: WorldFragment['fragmentType'], name: string): string {
    const descriptions: Record<WorldFragment['fragmentType'], string[]> = {
      'ruin': [
        `Crumbling walls overgrown with vines mark the remains of ${name}.`,
        `The ruins of ${name} stand as a testament to ages past.`,
        `Stones scattered about indicate the location of ${name}.`
      ],
      'monument': [
        `A grand monument dedicated to ${name} stands here.`,
        `${name} is immortalized in stone and memory.`,
        `This monument was erected to honor ${name}.`
      ],
      'shrine': [
        `A sacred shrine dedicated to ${name} emanates divine presence.`,
        `Worshippers gather at the shrine of ${name}.`,
        `The shrine of ${name} glows with spiritual energy.`
      ],
      'tomb': [
        `The tomb of ${name} rests here, solemn and still.`,
        `An ancient burial site marks where ${name} was laid to rest.`,
        `${name}'s final resting place is marked by this solemn structure.`
      ],
      'statue': [
        `A statue of ${name} stands sentinel over the land.`,
        `${name} is immortalized in this carved likeness.`,
        `The statue of ${name} watches eternally.`
      ],
      'artifact_location': [
        `Rumors speak of ${name} being hidden in this place.`,
        `Legends say ${name} can be found here.`,
        `This is said to be where ${name} is kept.`
      ],
      'nexus': [
        `A nexus of power centered on ${name} exists here.`,
        `${name} marks a convergence of mystical energies.`,
        `This nexus is tied to ${name}.`
      ]
    };

    const array = descriptions[type];
    return array[this.rng.nextInt(0, array.length - 1)];
  }

  private generateInteractableObjects(type: WorldFragment['fragmentType']): WorldFragment['interactableObjects'] {
    const objectSets: Record<WorldFragment['fragmentType'], Array<{ id: string; name: string; canTake: boolean; value: number; }>> = {
      'ruin': [
        { id: 'obj_1', name: 'Ancient Pottery Shard', canTake: true, value: 50 },
        { id: 'obj_2', name: 'Rusted Weapon', canTake: false, value: 0 }
      ],
      'monument': [
        { id: 'obj_1', name: 'Inscription Plaque', canTake: false, value: 0 },
        { id: 'obj_2', name: 'Commemorative Coin', canTake: true, value: 100 }
      ],
      'shrine': [
        { id: 'obj_1', name: 'Sacred Offering Dish', canTake: false, value: 0 },
        { id: 'obj_2', name: 'Blessed Water', canTake: true, value: 200 }
      ],
      'tomb': [
        { id: 'obj_1', name: 'Burial Goods', canTake: true, value: 150 },
        { id: 'obj_2', name: 'Sarcophagus', canTake: false, value: 0 }
      ],
      'statue': [
        { id: 'obj_1', name: 'Carved Gemstone', canTake: true, value: 250 },
        { id: 'obj_2', name: 'Statue Base', canTake: false, value: 0 }
      ],
      'artifact_location': [
        { id: 'obj_1', name: 'Ancient Relic', canTake: true, value: 500 }
      ],
      'nexus': [
        { id: 'obj_1', name: 'Crystallized Mana', canTake: true, value: 300 }
      ]
    };

    return objectSets[type] || [];
  }

  private generateSecretContent(type: WorldFragment['fragmentType']): string {
    const secrets: Record<WorldFragment['fragmentType'], string[]> = {
      'ruin': ['A hidden chamber contains an ancient scroll.', 'A passage leads deeper underground.'],
      'monument': ['An inscription reversed reveals a hidden message.', 'Secret compartment hidden in the base.'],
      'shrine': ['A hidden altar lies beneath the main shrine.', 'Sacred relics concealed in the walls.'],
      'tomb': ['A secret passage to another burial chamber.', 'Treasure hidden alongside the deceased.'],
      'statue': ['The statue conceals an artifact within.', 'A hidden chamber beneath the statue.'],
      'artifact_location': ['The artifact is closer than it appears.', 'Magical wards protect the true location.'],
      'nexus': ['Multiple nexuses exist in this location.', 'The nexus is powered by an ancient source.']
    };

    const array = secrets[type];
    return array[this.rng.nextInt(0, array.length - 1)];
  }

  discoverFragment(fragmentId: string, discovererNpcId?: string): boolean {
    const fragment = this.registry.fragments.get(fragmentId);
    if (!fragment || fragment.isDiscovered) return false;

    if (this.rng.nextInt(0, 100) / 100 > fragment.discoveryChance) return false;

    fragment.isDiscovered = true;
    fragment.discoveredAt = this.rng.nextInt(0, 100000);

    return true;
  }

  weatherFragment(fragmentId: string, weatherAmount: number = 1): void {
    const fragment = this.registry.fragments.get(fragmentId);
    if (!fragment || fragment.isSealed) return;

    fragment.durabilityState.durabilityScore -= weatherAmount;
    fragment.durabilityState.lastWeatherTick = this.rng.nextInt(0, 100000);
    fragment.timeLeftUntilDecay -= weatherAmount;

    this.updateDurabilityState(fragment);
  }

  private updateDurabilityState(fragment: WorldFragment): void {
    const oldState = fragment.durabilityState.currentDurability;
    const score = fragment.durabilityState.durabilityScore;

    let newState: FragmentDurability;
    if (score > 80) {
      newState = 'pristine';
    } else if (score > 60) {
      newState = 'weathered';
    } else if (score > 40) {
      newState = 'crumbling';
    } else if (score > 0) {
      newState = 'ruined';
    } else {
      newState = 'destroyed';
    }

    if (oldState !== newState) {
      const oldCount = this.registry.fragmentsByState.get(oldState) || 0;
      this.registry.fragmentsByState.set(oldState, Math.max(0, oldCount - 1));

      const newCount = this.registry.fragmentsByState.get(newState) || 0;
      this.registry.fragmentsByState.set(newState, newCount + 1);

      fragment.durabilityState.currentDurability = newState;

      if (newState === 'destroyed') {
        this.registry.totalFragmentsDestroyed++;
      }
    }
  }

  sealFragment(fragmentId: string, reason: string): void {
    const fragment = this.registry.fragments.get(fragmentId);
    if (!fragment) return;

    fragment.isSealed = true;
    fragment.sealingReason = reason;
  }

  unsealFragment(fragmentId: string): void {
    const fragment = this.registry.fragments.get(fragmentId);
    if (!fragment) return;

    fragment.isSealed = false;
    fragment.sealingReason = undefined;
  }

  damageFragment(fragmentId: string, damage: number, source: string): void {
    const fragment = this.registry.fragments.get(fragmentId);
    if (!fragment) return;

    fragment.durabilityState.recentDamage.push({
      source,
      amount: damage,
      tick: this.rng.nextInt(0, 100000)
    });

    this.weatherFragment(fragmentId, damage);

    if (fragment.durabilityState.recentDamage.length > 20) {
      fragment.durabilityState.recentDamage = fragment.durabilityState.recentDamage.slice(-10);
    }
  }

  getFragment(fragmentId: string): WorldFragment | undefined {
    return this.registry.fragments.get(fragmentId);
  }

  getFragmentsAtLocation(locationId: string): WorldFragment[] {
    const fragmentIds = this.registry.locationFragmentIndex.get(locationId) || [];
    return fragmentIds.map(id => this.registry.fragments.get(id)!).filter(f => f);
  }

  getAllFragments(): WorldFragment[] {
    return Array.from(this.registry.fragments.values());
  }

  getFragmentsByDurability(durability: FragmentDurability): WorldFragment[] {
    return Array.from(this.registry.fragments.values()).filter(
      f => f.durabilityState.currentDurability === durability
    );
  }

  getRegistry(): WorldFragmentRegistry {
    return this.registry;
  }

  clearFragments(): void {
    this.registry.fragments.clear();
    this.registry.locationFragmentIndex.clear();
    this.registry.fragmentsByState.forEach((_, key) => {
      this.registry.fragmentsByState.set(key, 0);
    });
  }

  reset(): void {
    this.registry = {
      id: `registry_${Date.now()}`,
      fragments: new Map(),
      locationFragmentIndex: new Map(),
      totalFragmentsCreated: 0,
      totalFragmentsDestroyed: 0,
      fragmentsByState: new Map([
        ['pristine', 0],
        ['weathered', 0],
        ['crumbling', 0],
        ['ruined', 0],
        ['destroyed', 0]
      ])
    };
  }
}

let fragmentEngineInstance: WorldFragmentEngine | null = null;

export function getWorldFragmentEngine(seed: number = 12345): WorldFragmentEngine {
  if (!fragmentEngineInstance) {
    fragmentEngineInstance = new WorldFragmentEngine(seed);
  }
  return fragmentEngineInstance;
}

export function resetWorldFragmentEngine(): void {
  if (fragmentEngineInstance) {
    fragmentEngineInstance.reset();
    fragmentEngineInstance = null;
  }
}

export const WorldFragmentEngineExports = {
  getWorldFragmentEngine,
  resetWorldFragmentEngine
};
