/**
 * M44-B3: Property Engine - Persistent Player Housing & Property Management
 * 
 * Manages player-owned properties (Houses, Vaults, Shrines) that provide benefits
 * and risks based on faction control of their location. Properties dynamically shift
 * benefits when factions change dominance (Political Displacement).
 */

import type { WorldState } from './worldEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';

export type PropertyType = 'house' | 'vault' | 'shrine' | 'workshop';

export interface Property {
  id: string;
  type: PropertyType;
  locationId: string;
  ownerId: string; // player ID
  acquiredAt: number; // world tick
  name: string;
  description: string;
  amenities: string[]; // e.g., 'bed', 'anvil', 'altar'
  storageCapacity: number; // items this property can hold
  currentStorage: string[]; // item IDs stored here
}

export interface PropertyBenefit {
  hpRecoveryBonus: number; // % multiplier to HP recovery (1.0 = no bonus, 1.25 = 25% bonus)
  mpRecoveryBonus: number; // % multiplier to MP recovery
  storageBonus: number; // additional storage slots
  factionReputationBonus: number; // bonus rep for controlling faction
  fastTravelHub: boolean; // can teleport to/from this property
  cost: number; // gold per day to maintain
}

export interface PropertyStatus {
  property: Property;
  currentFactionId: string; // faction controlling the location
  ownerFactionId?: string; // if player has faction allegiance
  benefitsActive: boolean; // true if both property faction and owner are aligned
  activeUntil: number; // tick when political displacement expires if misaligned
  reclamationQuestId?: string; // quest to regain full benefits if displaced
}

class PropertyEngine {
  private properties: Map<string, Property> = new Map();
  private propertyStatus: Map<string, PropertyStatus> = new Map();
  private maintenanceLog: Array<{ propertyId: string; tick: number; cost: number }> = [];

  /**
   * Build a new property for the player
   */
  buildProperty(
    locationId: string,
    playerId: string,
    propertyType: PropertyType,
    name: string,
    tick: number
  ): Property {
    const propertyId = `${locationId}_${propertyType}_${playerId}`;

    const property: Property = {
      id: propertyId,
      type: propertyType,
      locationId,
      ownerId: playerId,
      acquiredAt: tick,
      name,
      description: this.getPropertyDescription(propertyType, locationId),
      amenities: this.getAmenitiesForType(propertyType),
      storageCapacity: this.getStorageCapacity(propertyType),
      currentStorage: [],
    };

    this.properties.set(propertyId, property);

    // Initialize status
    this.updatePropertyStatus(propertyId, tick, undefined);

    return property;
  }

  /**
   * Get the default amenities for a property type
   */
  private getAmenitiesForType(propertyType: PropertyType): string[] {
    const amenities: Record<PropertyType, string[]> = {
      house: ['bed', 'fireplace', 'storage_chest', 'cooking_hearth'],
      vault: ['secure_vault', 'trap_defense', 'hidden_compartments', 'alarm_system'],
      shrine: ['altar', 'meditation_circle', 'spell_focus', 'rune_inscriptions'],
      workshop: ['crafting_bench', 'anvil', 'tool_rack', 'material_storage'],
    };
    return amenities[propertyType] || [];
  }

  /**
   * Get storage capacity based on property type
   */
  private getStorageCapacity(propertyType: PropertyType): number {
    const capacities: Record<PropertyType, number> = {
      house: 50,
      vault: 100,
      shrine: 30,
      workshop: 75,
    };
    return capacities[propertyType] || 50;
  }

  /**
   * Generate description for a property
   */
  private getPropertyDescription(propertyType: PropertyType, locationId: string): string {
    const descriptions: Record<PropertyType, string> = {
      house: `A cozy residence in ${locationId}. Your personal sanctuary away from the dangers of the world.`,
      vault: `A secure vault in ${locationId}. Reinforced walls and cunning traps protect your valuables.`,
      shrine: `A private shrine in ${locationId}. A place for meditation and spiritual practice.`,
      workshop: `A fully equipped workshop in ${locationId}. Perfect for crafting and repairs.`,
    };
    return descriptions[propertyType] || '';
  }

  /**
   * Calculate benefits for a property based on current faction control
   */
  calculateBenefits(propertyId: string, worldState: WorldState): PropertyBenefit {
    const property = this.properties.get(propertyId);
    if (!property) {
      return this.getNullBenefit();
    }

    const status = this.propertyStatus.get(propertyId);
    if (!status) {
      return this.getNullBenefit();
    }

    const baseBenefit = this.getBaseBenefit(property.type);

    // If benefits are active (faction aligned), apply full benefits
    if (status.benefitsActive) {
      return {
        ...baseBenefit,
        hpRecoveryBonus: baseBenefit.hpRecoveryBonus,
        mpRecoveryBonus: baseBenefit.mpRecoveryBonus,
        factionReputationBonus: baseBenefit.factionReputationBonus,
      };
    }

    // If displaced (faction misaligned), reduce benefits by 50%
    return {
      hpRecoveryBonus: baseBenefit.hpRecoveryBonus * 0.5,
      mpRecoveryBonus: baseBenefit.mpRecoveryBonus * 0.5,
      storageBonus: Math.floor(baseBenefit.storageBonus * 0.5),
      factionReputationBonus: baseBenefit.factionReputationBonus * 0.1, // almost zero
      fastTravelHub: false, // disabled when displaced
      cost: baseBenefit.cost * 0.5, // reduced upkeep cost when displaced
    };
  }

  /**
   * Get base benefit for a property type
   */
  private getBaseBenefit(propertyType: PropertyType): PropertyBenefit {
    const benefits: Record<PropertyType, PropertyBenefit> = {
      house: {
        hpRecoveryBonus: 1.25,
        mpRecoveryBonus: 1.1,
        storageBonus: 20,
        factionReputationBonus: 5,
        fastTravelHub: true,
        cost: 50,
      },
      vault: {
        hpRecoveryBonus: 1.0,
        mpRecoveryBonus: 1.0,
        storageBonus: 50,
        factionReputationBonus: 2,
        fastTravelHub: true,
        cost: 100,
      },
      shrine: {
        hpRecoveryBonus: 1.5,
        mpRecoveryBonus: 1.5,
        storageBonus: 10,
        factionReputationBonus: 15,
        fastTravelHub: false,
        cost: 75,
      },
      workshop: {
        hpRecoveryBonus: 1.0,
        mpRecoveryBonus: 1.2,
        storageBonus: 30,
        factionReputationBonus: 3,
        fastTravelHub: false,
        cost: 60,
      },
    };
    return benefits[propertyType] || this.getNullBenefit();
  }

  /**
   * Get null/placeholder benefit
   */
  private getNullBenefit(): PropertyBenefit {
    return {
      hpRecoveryBonus: 1.0,
      mpRecoveryBonus: 1.0,
      storageBonus: 0,
      factionReputationBonus: 0,
      fastTravelHub: false,
      cost: 0,
    };
  }

  /**
   * Update property status based on current faction control
   */
  updatePropertyStatus(propertyId: string, tick: number, ownerFactionId?: string): void {
    const property = this.properties.get(propertyId);
    if (!property) return;

    const factionEngine = getFactionWarfareEngine();
    const currentFactionId = factionEngine.getWarZoneStatus(property.locationId).currentDominant;

    // Determine if benefits are active
    const benefitsActive = !ownerFactionId || ownerFactionId === currentFactionId;

    let status = this.propertyStatus.get(propertyId);
    if (!status) {
      status = {
        property,
        currentFactionId,
        ownerFactionId,
        benefitsActive,
        activeUntil: tick + (benefitsActive ? 999999999 : 2000), // 2000 ticks grace period if displaced
      };
      this.propertyStatus.set(propertyId, status);
    } else {
      status.currentFactionId = currentFactionId;
      status.benefitsActive = benefitsActive;
      if (!benefitsActive && !status.reclamationQuestId) {
        // Start grace period for displacement
        status.activeUntil = tick + 2000;
      }
    }
  }

  /**
   * Add item to property storage
   */
  storeItem(propertyId: string, itemId: string): boolean {
    const property = this.properties.get(propertyId);
    if (!property) return false;

    if (property.currentStorage.length >= property.storageCapacity) {
      return false; // storage full
    }

    property.currentStorage.push(itemId);
    return true;
  }

  /**
   * Retrieve item from property storage
   */
  retrieveItem(propertyId: string, itemId: string): boolean {
    const property = this.properties.get(propertyId);
    if (!property) return false;

    const index = property.currentStorage.indexOf(itemId);
    if (index === -1) return false;

    property.currentStorage.splice(index, 1);
    return true;
  }

  /**
   * Apply maintenance cost (daily upkeep)
   */
  applyMaintenance(propertyId: string, tick: number, playerGold: number): { success: boolean; costApplied: number } {
    const status = this.propertyStatus.get(propertyId);
    if (!status) {
      return { success: false, costApplied: 0 };
    }

    const benefit = this.calculateBenefits(propertyId, {} as WorldState);
    const cost = benefit.cost;

    if (playerGold < cost) {
      // Cannot afford maintenance - mark as neglected
      return { success: false, costApplied: cost };
    }

    this.maintenanceLog.push({
      propertyId,
      tick,
      cost,
    });

    return { success: true, costApplied: cost };
  }

  /**
   * Get all properties owned by a player
   */
  getPlayerProperties(playerId: string): Property[] {
    return Array.from(this.properties.values()).filter((p) => p.ownerId === playerId);
  }

  /**
   * Get status of all properties
   */
  getAllPropertyStatus(): PropertyStatus[] {
    return Array.from(this.propertyStatus.values());
  }

  /**
   * Check if property is under political displacement
   */
  isPropertyDisplaced(propertyId: string): boolean {
    const status = this.propertyStatus.get(propertyId);
    return status ? !status.benefitsActive : false;
  }

  /**
   * Export property engine state
   */
  exportState(): object {
    return {
      propertyCount: this.properties.size,
      displacedProperties: Array.from(this.propertyStatus.values()).filter((s) => !s.benefitsActive)
        .length,
      properties: Array.from(this.properties.values()).map((p) => ({
        id: p.id,
        type: p.type,
        location: p.locationId,
        owner: p.ownerId,
        storage: `${p.currentStorage.length}/${p.storageCapacity}`,
      })),
      recentMaintenance: this.maintenanceLog.slice(-10).map((m) => ({
        property: m.propertyId,
        tick: m.tick,
        cost: m.cost,
      })),
    };
  }

  /**
   * Clear all properties (for testing/reset)
   */
  clearState(): void {
    this.properties.clear();
    this.propertyStatus.clear();
    this.maintenanceLog = [];
  }
}

// Singleton instance
let instance: PropertyEngine | null = null;

export function getPropertyEngine(): PropertyEngine {
  if (!instance) {
    instance = new PropertyEngine();
  }
  return instance;
}
