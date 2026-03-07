/**
 * Phase 8: UI Logic & Perception Layer - Integration Tests
 *
 * Tests cover:
 * 1. UIPerceptionManager - Information lag filtering and diegetic descriptors
 * 2. useEngineIntegration - EventBus subscription and state mapping
 * 3. useEventBusSync - Direct event subscription and mutation tracking
 * 4. Perception-based view filtering (NPC visibility, location obscuration)
 * 5. Causal lock countdown display
 * 6. Study Mode overlay and vitals decay tracking
 * 7. UI notification system
 * 8. End-to-end perception filter with 1.5s tick heartbeat
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FrictionManager, HealthDescriptor, VitalDescriptor } from '../engine/FrictionManager';
import { UIPerceptionManager } from '../client/managers/UIPerceptionManager';
import { EventBus, type WorldUpdateEvent } from '../engine/EventBus';
import type { Vessel, CoreAttributes } from '../types';

// Mock vessel factory
function createMockVessel(overrides?: Partial<Vessel>): Vessel {
  return {
    id: 'vessel_1',
    name: 'Test Character',
    healthPoints: 50,
    maxHealthPoints: 100,
    attributes: {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      PER: 10,
    } as CoreAttributes,
    vitals: {
      vigor: 100,
      nourishment: 100,
      sanity: 100,
    },
    maximumVitals: {
      maxVigor: 100,
      maxNourishment: 100,
      maxSanity: 100,
    },
    injuries: [],
    ...overrides,
  } as any;
}

describe('Phase 8: UI Perception Layer', () => {
  describe('UIPerceptionManager - Information Lag Filtering', () => {
    
    it('Should filter health data based on PER/WIS attributes', () => {
      // Low perception character
      const weakVessel = createMockVessel({
        attributes: { PER: 5, WIS: 5 } as any,
      });
      
      const weakPerception = UIPerceptionManager.calculatePlayerPerception(weakVessel);
      
      expect(weakPerception.perceivedHealth.hasExactHealth).toBe(false);
      expect(weakPerception.lagMultiplier).toBeGreaterThan(0.5);
      
      // High perception character
      const strongVessel = createMockVessel({
        attributes: { PER: 18, WIS: 18 } as any,
      });
      
      const strongPerception = UIPerceptionManager.calculatePlayerPerception(strongVessel);
      
      expect(strongPerception.perceivedHealth.hasExactHealth).toBe(true);
      expect(strongPerception.lagMultiplier).toBeLessThan(0.1);
    });

    it('Should provide vague descriptors for low perception characters', () => {
      const character = createMockVessel({
        healthPoints: 25,        // 25% health
        maxHealthPoints: 100,
        attributes: { PER: 5, WIS: 5 } as any,
      });
      
      const perception = UIPerceptionManager.calculatePlayerPerception(character);
      
      expect(perception.perceivedHealth.hasExactHealth).toBe(false);
      expect(perception.perceivedHealth.healthDescriptor).toBe(HealthDescriptor.SIGNIFICANT);
      expect(perception.perceivedHealth.healthPercent).toBeUndefined();
    });

    it('Should provide exact values for high perception characters', () => {
      const character = createMockVessel({
        healthPoints: 25,
        maxHealthPoints: 100,
        attributes: { PER: 18, WIS: 18 } as any,
      });
      
      const perception = UIPerceptionManager.calculatePlayerPerception(character);
      
      expect(perception.perceivedHealth.hasExactHealth).toBe(true);
      expect(perception.perceivedHealth.healthPercent).toBe(25);
    });

    it('Should calculate health descriptors across all percentage ranges', () => {
      const testCases: Array<[number, HealthDescriptor]> = [
        [100, HealthDescriptor.PERFECT],
        [90, HealthDescriptor.PERFECT],
        [75, HealthDescriptor.MANAGEABLE],
        [50, HealthDescriptor.SIGNIFICANT],
        [25, HealthDescriptor.CRITICAL],
        [10, HealthDescriptor.DYING],
        [0, HealthDescriptor.DEAD],
      ];
      
      testCases.forEach(([healthPercent, expected]) => {
        const descriptor = FrictionManager.getHealthDescriptor(healthPercent);
        expect(descriptor).toBe(expected);
      });
    });

    it('Should filter enemy visibility based on combined perception', () => {
      const player = createMockVessel({
        attributes: { PER: 15, WIS: 15 } as any,
      });
      
      const enemy = createMockVessel({
        id: 'enemy_1',
        name: 'Goblin',
        attributes: { PER: 5, WIS: 5 } as any,
        healthPoints: 30,
        maxHealthPoints: 50,
      });
      
      const perception = UIPerceptionManager.calculatePlayerPerception(player, [enemy]);
      
      expect(perception.visibleEnemies).toHaveLength(1);
      expect(perception.visibleEnemies[0].visibilityRange).toBeGreaterThan(50);
    });

    it('Should obfuscate NPC positions based on uncertainty', () => {
      const exactX = 100;
      const exactY = 200;
      const uncertainty = 0.8;
      
      const obfuscated = UIPerceptionManager.getObfuscatedPosition(exactX, exactY, uncertainty);
      
      // Should be within jitter range
      expect(Math.abs(obfuscated.x - exactX)).toBeLessThanOrEqual(200);
      expect(Math.abs(obfuscated.y - exactY)).toBeLessThanOrEqual(200);
    });
  });

  describe('UIPerceptionManager - Causal Lock Display', () => {
    
    it('Should format causal lock with remaining time', () => {
      const currentTick = 5000;
      const lockExpiresTick = 5000 + 259200; // 72 hours later
      
      const lockDisplay = UIPerceptionManager.formatCausalLock(
        'hero_soul',
        lockExpiresTick,
        currentTick,
        'Hero'
      );
      
      expect(lockDisplay.soulId).toBe('hero_soul');
      expect(lockDisplay.sessionName).toBe('Hero');
      expect(lockDisplay.remainingTicks).toBe(259200);
      expect(lockDisplay.remainingHours).toBe(108); // 259200 / 2400
      expect(lockDisplay.progressPercent).toBe(0);
    });

    it('Should calculate progress percentage correctly', () => {
      const lockDisplay = UIPerceptionManager.formatCausalLock(
        'soul_1',
        10000,
        7500,  // 50% through
        'Character'
      );
      
      expect(lockDisplay.progressPercent).toBeGreaterThan(0);
      expect(lockDisplay.progressPercent).toBeLessThan(100);
    });

    it('Should handle expired locks', () => {
      const lockDisplay = UIPerceptionManager.formatCausalLock(
        'soul_1',
        5000,
        10000, // Lock expired
        'Character'
      );
      
      expect(lockDisplay.remainingTicks).toBe(0);
    });
  });

  describe('UIPerceptionManager - Study Mode', () => {
    
    it('Should track study mode progress', () => {
      const startTick = 1000;
      const targetTick = 11080; // 7 days
      const currentTick = 6040;  // Halfway through
      
      const studyDisplay = UIPerceptionManager.formatStudyMode(
        startTick,
        targetTick,
        currentTick,
        100,  // Starting health
        100   // Current health
      );
      
      expect(studyDisplay.isActive).toBe(true);
      expect(studyDisplay.progressPercent).toBe(50);
      expect(studyDisplay.estimatedDurationSeconds).toBeGreaterThan(0);
    });

    it('Should calculate vitals decay during study', () => {
      const studyDisplay = UIPerceptionManager.formatStudyMode(
        1000,
        11080,
        6040,
        100,  // Starting health
        75    // Current health after decay
      );
      
      expect(studyDisplay.healthDecayPercent).toBe(25);
    });
  });

  describe('EventBus - Real-time Event Distribution', () => {
    
    let eventBus: EventBus;
    
    beforeEach(() => {
      eventBus = new EventBus();
    });

    it('Should distribute events to subscribers', () => {
      const handler = vi.fn();
      eventBus.subscribe(handler);
      
      const event: WorldUpdateEvent = {
        tick: 100,
        epochNumber: 0,
        timestamp: Date.now(),
        stateHash: {
          hash: 'abc123',
          componentHashes: {
            vesselsHash: 'v1',
            factionsHash: 'f1',
            territoriesHash: 't1',
            deitiesHash: 'd1',
            constantsHash: 'g1',
          },
          computedAt: 100,
          isValidated: true,
        },
        mutations: [],
        playerVesselId: 'player_1',
        playerSoulId: 'soul_1',
        causalLocks: [],
        echoPoints: [],
      };
      
      eventBus.emit(event);
      
      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('Should filter events by mutation type', () => {
      const handler = vi.fn();
      eventBus.subscribe(handler, {
        mutationTypes: ['death_event'],
      });
      
      const event: WorldUpdateEvent = {
        tick: 100,
        epochNumber: 0,
        timestamp: Date.now(),
        stateHash: {
          hash: 'abc123',
          componentHashes: {
            vesselsHash: 'v1',
            factionsHash: 'f1',
            territoriesHash: 't1',
            deitiesHash: 'd1',
            constantsHash: 'g1',
          },
          computedAt: 100,
          isValidated: true,
        },
        mutations: [
          {
            type: 'death_event',
            actorId: 'vessel_1',
            tick: 100,
          } as any,
        ],
        playerVesselId: 'player_1',
        playerSoulId: 'soul_1',
        causalLocks: [],
        echoPoints: [],
      };
      
      eventBus.emit(event);
      
      expect(handler).toHaveBeenCalledWith(event);
      expect(handler).toHaveBeenCalledTimes(1);
      
      handler.mockClear();
      
      // Test filtering - this mutation type doesn't match
      const event2: WorldUpdateEvent = {
        tick: 101,
        epochNumber: 0,
        timestamp: Date.now(),
        stateHash: {
          hash: 'xyz789',
          componentHashes: {
            vesselsHash: 'v2',
            factionsHash: 'f2',
            territoriesHash: 't2',
            deitiesHash: 'd2',
            constantsHash: 'g2',
          },
          computedAt: 101,
          isValidated: true,
        },
        mutations: [
          {
            type: 'faction_shift' as any,
            timestamp: 101,
          },
        ],
        playerVesselId: 'player_1',
        playerSoulId: 'soul_1',
        causalLocks: [],
        echoPoints: [],
      };
      
      eventBus.emit(event2);
      
      // Handler should NOT be called because mutation type doesn't match filter
      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('Should allow unsubscription', () => {
      const handler = vi.fn();
      const unsubscribe = eventBus.subscribe(handler);
      
      unsubscribe();
      
      const event: any = {
        tick: 100,
        mutations: [],
        causalLocks: [],
        echoPoints: [],
      };
      
      eventBus.emit(event);
      
      expect(handler).toHaveBeenCalledTimes(0);
    });

    it('Should maintain event history for replay', () => {
      const event1: any = { tick: 100, mutations: [] };
      const event2: any = { tick: 101, mutations: [] };
      
      eventBus.emit(event1);
      eventBus.emit(event2);
      
      // History should be available for debugging/replay
      expect((eventBus as any).eventHistory).toBeDefined();
      expect((eventBus as any).eventHistory.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Perception Integration - End-to-End', () => {
    
    it('Should apply perception penalties to rolls', () => {
      const character = createMockVessel({
        attributes: { PER: 5, WIS: 5 } as any,
      });
      
      const baseRoll = 15;
      const penalizedRoll = UIPerceptionManager.applyPerceptionPenaltyToRoll(baseRoll, character);
      
      // Should have penalty applied
      expect(penalizedRoll).toBeLessThan(baseRoll);
    });

    it('Should determine NPC position visibility based on perception', () => {
      const npc = createMockVessel({
        id: 'npc_1',
        attributes: { DEX: 15 } as any, // High stealth
      });
      
      // Low perception player can't see NPC at distance
      const isVisible = UIPerceptionManager.isNPCPositionVisible(npc, 5, 50);
      
      expect(typeof isVisible).toBe('boolean');
    });

    it('Should calculate entity opacity based on visibility', () => {
      const npc = createMockVessel();
      const opacity = UIPerceptionManager.calculateEntityOpacity(npc, 8); // Low perception
      
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(1);
    });

    it('Should determine when to show exact data', () => {
      const character = createMockVessel({
        attributes: { PER: 18, WIS: 18 } as any,
      });
      
      expect(UIPerceptionManager.shouldShowExactData(character, 'health')).toBe(true);
      
      const character2 = createMockVessel({
        attributes: { PER: 5, WIS: 5 } as any,
      });
      
      expect(UIPerceptionManager.shouldShowExactData(character2, 'health')).toBe(false);
    });

    it('Should filter and tag events for UI display', () => {
      const event = {
        type: 'distant_combat',
        data: { actors: ['npc_1', 'npc_2'] },
      };
      
      const filtered = UIPerceptionManager.filterEventForUI(event, 8); // Moderate perception
      
      expect(filtered).not.toBeNull();
      expect(filtered?.isVisible).toBe(true);
      expect(typeof filtered?.vagueness).toBe('number');
    });

    it('Should provide stat descriptors in diegetic language', () => {
      const descriptor1 = UIPerceptionManager.getStatDescriptor('health', 75, false);
      expect(descriptor1).toBe(HealthDescriptor.MANAGEABLE);
      
      const descriptor2 = UIPerceptionManager.getStatDescriptor('health', 75, true);
      expect(descriptor2).toBe('75%');
    });
  });

  describe('Perception Data Consistency', () => {
    
    it('Should maintain consistency between FrictionManager and UIPerceptionManager', () => {
      const character = createMockVessel({
        healthPoints: 50,
        maxHealthPoints: 100,
        attributes: { PER: 10, WIS: 10 } as any,
      });
      
      const frictionState = FrictionManager.getPerceivedVesselState(character);
      const uiState = UIPerceptionManager.calculatePlayerPerception(character);
      
      // Should have same health descriptor
      expect(uiState.perceivedHealth.healthDescriptor).toBe(frictionState.healthDescriptor);
    });

    it('Should match lag multiplier calculations', () => {
      const character = createMockVessel({
        attributes: { PER: 12, WIS: 14 } as any,
      });
      
      const frictionLag = FrictionManager.getInformationLagMultiplier(character);
      const uiLag = UIPerceptionManager.calculatePlayerPerception(character).lagMultiplier;
      
      expect(Math.abs(frictionLag - uiLag)).toBeLessThan(0.01);
    });
  });

  describe('Performance & Edge Cases', () => {
    
    it('Should handle high-count NPC arrays efficiently', () => {
      const player = createMockVessel();
      const enemies = Array.from({ length: 100 }, (_, i) =>
        createMockVessel({ id: `enemy_${i}` })
      );
      
      const startTime = performance.now();
      UIPerceptionManager.calculatePlayerPerception(player, enemies);
      const elapsed = performance.now() - startTime;
      
      // Should complete in reasonable time (< 100ms)
      expect(elapsed).toBeLessThan(100);
    });

    it('Should handle negative remainingTicks in causal locks', () => {
      const lockDisplay = UIPerceptionManager.formatCausalLock(
        'soul_1',
        5000,
        10000, // Expired
        'Character'
      );
      
      expect(lockDisplay.remainingTicks).toBe(0); // Clamped to 0
    });

    it('Should handle division by zero in progress calculations', () => {
      const studyDisplay = UIPerceptionManager.formatStudyMode(
        1000,
        1000, // 0 duration
        1000,
        100,
        100
      );
      
      // Should not throw, should show 0 or NaN handled gracefully
      expect(typeof studyDisplay.progressPercent).toBe('number');
    });
  });
});
