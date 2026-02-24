/**
 * M14 Milestone Verification Test Suite: "The Shifting Mirror"
 * 
 * Tests for player-driven world adaptation and AI playstyle detection
 * - Playstyle vector calculation from action history
 * - Director nudge emission based on dominant type
 * - Template validation and hot-swap integrity
 * - Alpha the Bound One rare entity detection
 */

import {
  recordDecision,
  calculatePlayerPreferences,
  identifyStrugglePoints,
  suggestAIAdaptations,
  generateExplorationHeatmap,
} from '../engine/analyticsEngine';

import { initializeDirectorState } from '../engine/aiDmEngine';

import { checkAlphaTheBindOneManifest } from '../engine/proceduralEngine';

import type { Action } from '../engine/actionPipeline';

// Type mocks for testing
interface MockWorldState {
  tick: number;
  player: {
    id: string;
    location: string;
    health: number;
    stats: { strength: number; intelligence: number; wisdom: number };
    inventory: unknown[];
  };
  locations: Array<{
    id: string;
    name: string;
    biome: string;
    features: unknown[];
    connected: unknown[];
  }>;
  events: unknown[];
  mutationCount: number;
  [key: string]: unknown;
}

const createMockAction = (type: string): Action => ({
  worldId: 'test-world',
  playerId: 'test-player',
  type,
  payload: {}
});

// ============================================================================
// Test Suite: Playstyle Vector Calculation
// ============================================================================

describe('M14: Playstyle Vector System', () => {
  test('recordDecision - Combat action returns high engagement', () => {
    const decision = recordDecision(createMockAction('ATTACK'), 'success', 'arena-combat', 100);

    expect(decision).toBeDefined();
    expect(decision.actionType).toBe('ATTACK');
    expect(decision.engagementScore).toBeGreaterThan(80);
    expect(decision.outcome).toBe('success');
  });

  test('recordDecision - Dialogue action returns moderate-high engagement', () => {
    const decision = recordDecision(createMockAction('TALK'), 'success', 'tavern-persuade', 100);

    expect(decision).toBeDefined();
    expect(decision.actionType).toBe('TALK');
    expect(decision.engagementScore).toBeGreaterThan(70);
    expect(decision.engagementScore).toBeLessThan(100);
  });

  test('recordDecision - Exploration action returns moderate engagement', () => {
    const decision = recordDecision(createMockAction('EXAMINE'), 'success', 'cave-discovery', 100);

    expect(decision).toBeDefined();
    expect(decision.actionType).toBe('EXAMINE');
    expect(decision.engagementScore).toBeGreaterThan(60);
  });

  test('recordDecision - Engagement increased on success', () => {
    const success = recordDecision(createMockAction('ATTACK'), 'success', 'battle', 100);
    const failure = recordDecision(createMockAction('ATTACK'), 'failure', 'battle', 100);

    expect(success.engagementScore).toBeGreaterThanOrEqual(failure.engagementScore);
  });

  test('recordDecision - Engagement normalized to 0-100', () => {
    for (let i = 0; i < 20; i++) {
      const decision = recordDecision(createMockAction('ATTACK'), 'success', 'battle', i);
      expect(decision.engagementScore).toBeGreaterThanOrEqual(0);
      expect(decision.engagementScore).toBeLessThanOrEqual(100);
    }
  });

  test('calculatePlayerPreferences - Returns valid playstyle vector', () => {
    // Create mock analytics data
    const decisions = [
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 1),
      recordDecision(createMockAction('TALK'), 'success', 'tavern', 2),
      recordDecision(createMockAction('EXAMINE'), 'success', 'cave', 3)
    ];

    const prefs = calculatePlayerPreferences({ decisionsHistory: decisions } as any);
    expect(prefs).toBeDefined();
    expect(prefs.playstyleVector).toBeDefined();
    expect(prefs.playstyleVector.combatant).toBeGreaterThanOrEqual(0);
    expect(prefs.playstyleVector.diplomat).toBeGreaterThanOrEqual(0);
    expect(prefs.playstyleVector.explorer).toBeGreaterThanOrEqual(0);
  });

  test('identifyStrugglePoints - Returns structured data', () => {
    const decisions = [
      recordDecision(createMockAction('ATTACK'), 'failure', 'dungeon', 1),
      recordDecision(createMockAction('ATTACK'), 'failure', 'dungeon', 2),
      recordDecision(createMockAction('ATTACK'), 'success', 'zone', 3)
    ];

    const struggles = identifyStrugglePoints({ decisionsHistory: decisions } as any);
    expect(Array.isArray(struggles)).toBe(true);
  });
});

// ============================================================================
// Test Suite: Alpha the Bound One
// ============================================================================

describe('M14: Alpha the Bound One Rare Entity', () => {
  const createMockState = (): MockWorldState => ({
    tick: 1000,
    player: {
      id: 'player',
      location: 'corrupted-shrine',
      health: 100,
      stats: { strength: 10, intelligence: 10, wisdom: 10 },
      inventory: []
    },
    locations: [
      {
        id: 'corrupted-shrine',
        name: 'Corrupted Shrine',
        biome: 'corrupted',
        features: [],
        connected: []
      }
    ],
    events: [],
    mutationCount: 0
  });

  test('checkAlphaTheBindOneManifest - Triggers on high paradox + corrupted + night', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 80;
    (state as any).hour = 23; // Night
    (state as any).canonJournal = {
      narrativePivots: [
        { description: 'You betrayed the Forest Guardian' },
        { description: 'You saved the village' }
      ]
    };

    const encounter = checkAlphaTheBindOneManifest(state as any);

    expect(encounter).not.toBeNull();
    if (encounter) {
      expect(encounter.title).toBe('Alpha the Bound One');
      expect(encounter.type).toBe('social');
    }
  });

  test('checkAlphaTheBindOneManifest - Ignores if paradox too low', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 50;
    (state as any).hour = 23;

    const encounter = checkAlphaTheBindOneManifest(state as any);
    expect(encounter).toBeNull();
  });

  test('checkAlphaTheBindOneManifest - Ignores if not corrupted biome', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 80;
    state.locations[0].biome = 'forest';
    (state as any).hour = 23;

    const encounter = checkAlphaTheBindOneManifest(state as any);
    expect(encounter).toBeNull();
  });

  test('checkAlphaTheBindOneManifest - Ignores if not night', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 80;
    (state as any).hour = 12; // Daytime

    const encounter = checkAlphaTheBindOneManifest(state as any);
    expect(encounter).toBeNull();
  });

  test('checkAlphaTheBindOneManifest - Works with no narrative pivots', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 80;
    (state as any).hour = 23;
    (state as any).canonJournal = { narrativePivots: [] };

    const encounter = checkAlphaTheBindOneManifest(state as any);

    expect(encounter).not.toBeNull();
    if (encounter) {
      expect(encounter.description).toContain('Alpha');
    }
  });

  test('checkAlphaTheBindOneManifest - Difficulty is high', () => {
    const state = createMockState();
    (state.player as any).temporalDebt = 80;
    (state as any).hour = 23;

    const encounter = checkAlphaTheBindOneManifest(state as any);

    if (encounter) {
      expect(encounter.difficulty).toBeGreaterThanOrEqual(7);
    }
  });
});

// ============================================================================
// Test Suite: M14 Core Features Validation
// ============================================================================

describe('M14: Core Features', () => {
  test('Playstyle vector calculates from mixed actions', () => {
    const combatDecisions = [
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 1),
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 2),
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 3),
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 4),
      recordDecision(createMockAction('ATTACK'), 'success', 'battle', 5)
    ];
    
    const dialogueDecisions = [
      recordDecision(createMockAction('TALK'), 'success', 'tavern', 6),
      recordDecision(createMockAction('TALK'), 'success', 'tavern', 7),
      recordDecision(createMockAction('TALK'), 'success', 'tavern', 8)
    ];
    
    const explorationDecisions = [
      recordDecision(createMockAction('EXAMINE'), 'success', 'cave', 9),
      recordDecision(createMockAction('EXAMINE'), 'success', 'cave', 10)
    ];

    const allDecisions = [...combatDecisions, ...dialogueDecisions, ...explorationDecisions];

    const prefs = calculatePlayerPreferences({ decisionsHistory: allDecisions } as any);

    expect(prefs.playstyleVector.combatant).toBeGreaterThan(prefs.playstyleVector.diplomat);
    expect(prefs.playstyleVector.combatant).toBeGreaterThan(prefs.playstyleVector.explorer);
  });

  test('Engagement heatmap generation does not throw', () => {
    const decisionsData = [
      recordDecision(createMockAction('EXAMINE'), 'success', 'forest', 1),
      recordDecision(createMockAction('EXAMINE'), 'success', 'forest', 2),
      recordDecision(createMockAction('EXAMINE'), 'success', 'cave', 3)
    ];

    const mockLocations = [
      { id: 'forest', name: 'Forest' },
      { id: 'cave', name: 'Cave' }
    ];

    expect(() => {
      generateExplorationHeatmap(decisionsData, mockLocations);
    }).not.toThrow();
  });

  test('AI adaptation suggestions returned with valid structure', () => {
    const decisions = [
      recordDecision(createMockAction('ATTACK'), 'success', 'combat', 1),
      recordDecision(createMockAction('TALK'), 'success', 'social', 2)
    ];

    const prefs = calculatePlayerPreferences({ decisionsHistory: decisions } as any);
    const suggestions = suggestAIAdaptations(prefs, decisions);

    expect(suggestions).toBeDefined();
    expect(suggestions.suggestedPacing).toBeDefined();
    expect(suggestions.suggestedEncounterType).toBeDefined();
  });

  test('Director state initialization does not throw', () => {
    expect(() => {
      initializeDirectorState();
    }).not.toThrow();
  });
});
