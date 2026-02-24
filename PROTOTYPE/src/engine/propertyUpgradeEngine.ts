/**
 * M44-C3: Enhanced Property Engine - Upgrades & Gentrification
 * 
 * Extends propertyEngine with:
 * - Property upgrade levels and cosmetic/functional modifiers
 * - Gentrification metrics tied to location faction stability
 * - Local investment system for zone stabilization
 * - Property resale value scaling
 */

import { getPropertyEngine, type Property, type PropertyBenefit } from './propertyEngine';
import { getFactionWarfareEngine } from './factionWarfareEngine';
import type { WorldState } from './worldEngine';

/**
 * M44-C3: Property upgrade level with cosmetic/functional modifiers
 */
export interface PropertyModifier {
  id: string;
  name: string;
  type: 'cosmetic' | 'functional' | 'defensive';
  description: string;
  costToApply: number; // gold
  benefitBonus?: Partial<PropertyBenefit>; // additional benefits
  cooldown?: number; // ticks before can build another
}

/**
 * M44-C3: Expanded property interface with upgrades
 */
export interface PropertyUpgrade extends Property {
  upgradeLevel: number; // 0 = base, 1-5 = upgraded
  modifiers: PropertyModifier[]; // applied upgrades
  localhInvestment: number; // gold invested in zone stabilization
  gentrificationMetric: number; // 0-1, tied to faction stability
  resaleValue: number; // gold current property is worth
  lastUpgradeTick: number;
}

const UPGRADE_MODIFIERS: Record<string, PropertyModifier> = {
  reinforced_walls: {
    id: 'reinforced_walls',
    name: 'Reinforced Walls',
    type: 'functional',
    description: 'Increase HP recovery by 10%, improves security',
    costToApply: 500,
    benefitBonus: { hpRecoveryBonus: 0.1, fastTravelHub: true },
    cooldown: 1000,
  },
  luxury_furnishings: {
    id: 'luxury_furnishings',
    name: 'Luxury Furnishings',
    type: 'cosmetic',
    description: 'Increases faction reputation gain by 25%',
    costToApply: 300,
    benefitBonus: { factionReputationBonus: 5 },
  },
  secure_vault: {
    id: 'secure_vault',
    name: 'Secure Vault Extension',
    type: 'functional',
    description: 'Add 30 extra storage slots',
    costToApply: 750,
    benefitBonus: { storageBonus: 30 },
  },
  mystical_altar: {
    id: 'mystical_altar',
    name: 'Mystical Altar',
    type: 'functional',
    description: 'Increase MP recovery by 20%',
    costToApply: 600,
    benefitBonus: { mpRecoveryBonus: 0.2 },
  },
};

/**
 * M44-C3: Property upgrade manager
 */
export class PropertyUpgradeManager {
  /**
   * Apply an upgrade to a property
   */
  static applyUpgrade(propertyId: string, modifierId: string, playerGold: number, tick: number): boolean {
    const propEngine = getPropertyEngine();
    const property = (propEngine as any).properties.get(propertyId) as PropertyUpgrade | undefined;
    if (!property) return false;

    const modifier = UPGRADE_MODIFIERS[modifierId];
    if (!modifier) return false;

    // Check gold
    if (playerGold < modifier.costToApply) return false;

    // Check cooldown if property is upgraded
    if (property.lastUpgradeTick && tick - property.lastUpgradeTick < (modifier.cooldown || 0)) {
      return false;
    }

    // Apply modifier
    if (!property.modifiers) property.modifiers = [];
    property.modifiers.push(modifier);
    property.upgradeLevel = (property.upgradeLevel || 0) + 1;
    property.lastUpgradeTick = tick;

    return true;
  }

  /**
   * M44-C3: Calculate gentrification metric for a property
   * Reflects how desirable zone is (faction stability + player investment)
   */
  static calculateGentrificationMetric(property: PropertyUpgrade, worldState: WorldState): number {
    const factionEngine = getFactionWarfareEngine();
    const warZone = factionEngine.getWarZoneStatus(property.locationId);

    // Base on contention level (lower contention = higher value)
    let metric = 1.0 - (warZone.contentionLevel || 0.5);

    // Boost from player investment
    metric += Math.min(0.3, property.localhInvestment / 5000); // cap 30% boost

    // Boost from upgrades
    metric += property.upgradeLevel * 0.05;

    return Math.min(1.0, metric);
  }

  /**
   * M44-C3: Calculate property resale value
   */
  static calculateResaleValue(property: PropertyUpgrade, worldState: WorldState): number {
    let baseValue = 1000; // base property value

    // Adjust for property type
    const typeValues: Record<string, number> = {
      house: 1000,
      vault: 2000,
      shrine: 1500,
      workshop: 1200,
    };
    baseValue = typeValues[property.type] || baseValue;

    // Apply gentrification scaling
    const gentrification = this.calculateGentrificationMetric(property, worldState);
    const scaledValue = baseValue * (0.5 + gentrification * 1.5); // 0.5x to 2x multiplier

    // Degrade if displaced
    const status = (getPropertyEngine() as any).propertyStatus.get(property.id);
    if (status && !status.benefitsActive) {
      return scaledValue * 0.5; // half value if displaced
    }

    return scaledValue;
  }

  /**
   * M44-C3: Allow player to invest in local zone stabilization
   * Returns true if stabilization successful
   */
  static investInZoneStabilization(property: PropertyUpgrade, investmentAmount: number, playerGold: number, tick: number): boolean {
    if (playerGold < investmentAmount) return false;

    property.localhInvestment += investmentAmount;

    // Investment reduces contention over time
    // (handled by periodic tick in world engine)

    return true;
  }

  /**
   * Get all available upgrades
   */
  static getAvailableUpgrades(): PropertyModifier[] {
    return Object.values(UPGRADE_MODIFIERS);
  }

  /**
   * Get suggested upgrades for a property type
   */
  static getSuggestedUpgrades(propertyType: string): PropertyModifier[] {
    const suggestions: Record<string, string[]> = {
      house: ['reinforced_walls', 'luxury_furnishings'],
      vault: ['secure_vault', 'reinforced_walls'],
      shrine: ['mystical_altar', 'luxury_furnishings'],
      workshop: ['secure_vault', 'mystical_altar'],
    };

    const modIds = suggestions[propertyType] || [];
    return modIds.map(id => UPGRADE_MODIFIERS[id]).filter(m => m !== undefined);
  }
}
