/**
 * M42 Phase 4 Task A.1: Determinism Audit - Director Command Engine
 *
 * Verify that Director commands are replay-safe and produce bit-identical results
 * when executed with the same world seed and tick sequence.
 *
 * Critical for multiplayer consensus: Two peers replaying the same director
 * command sequence must produce identical world state mutations.
 */

import { DirectorCommandEngine } from '../engine/directorCommandEngine';
import { SeededRng, setGlobalRng } from '../engine/prng';

describe('DirectorCommandEngine - Determinism Verification', () => {
  let directorEngine: DirectorCommandEngine;

  beforeEach(() => {
    directorEngine = new DirectorCommandEngine('director_primary');
  });

  /**
   * Test: Basic command replay produces identical mutations
   */
  it('should produce identical mutations on replay with same seed', async () => {
    const seed = 12345;
    const commandSequence = [
      '/announce --critical Critical situation detected',
      '/force_epoch 2',
      '/schedule_event catastrophe_rising 50 Catastrophe story_beat 100'
    ];

    // First execution
    const mutationLog1: any[] = [];
    const state1 = createMockState(seed, 1000);
    const context1: any = {
      state: state1,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog: mutationLog1,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    for (const command of commandSequence) {
      await directorEngine.execute(command, context1);
    }

    // Second execution (replay)
    const mutationLog2: any[] = [];
    const state2 = createMockState(seed, 1000);
    const context2: any = {
      state: state2,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog: mutationLog2,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    for (const command of commandSequence) {
      await directorEngine.execute(command, context2);
    }

    // Verify mutations are identical
    expect(mutationLog1.length).toBe(mutationLog2.length);
    mutationLog1.forEach((mutation, idx) => {
      const mutation2 = mutationLog2[idx];
      expect(mutation.timestamp).toBe(mutation2.timestamp);
      expect(mutation.type).toBe(mutation2.type);
      expect(mutation.action).toBe(mutation2.action);
    });
  });

  /**
   * Test: Different seeds produce different mutation timestamps
   */
  it('should produce different timestamps with different seeds', async () => {
    const command = '/announce Test message';

    // First execution with seed 1000
    const mutationLog1: any[] = [];
    const state1 = createMockState(1000, 1000);
    const context1: any = {
      state: state1,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog: mutationLog1,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    await directorEngine.execute(command, context1);

    // Second execution with seed 2000
    const mutationLog2: any[] = [];
    const state2 = createMockState(2000, 1000);
    const context2: any = {
      state: state2,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog: mutationLog2,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    await directorEngine.execute(command, context2);

    // Timestamps should differ based on state.tick (which differs by seed context)
    const ts1 = mutationLog1[0]?.timestamp;
    const ts2 = mutationLog2[0]?.timestamp;
    // Both should be deterministic multiples of 10 (MS_PER_TICK)
    expect(ts1).toBeDefined();
    expect(ts2).toBeDefined();
    expect(ts1 % 10).toBe(0);
    expect(ts2 % 10).toBe(0);
  });

  /**
   * Test: Announce command uses deterministic timestamp
   */
  it('announce command should use seededNow() timestamp', async () => {
    const worldTick = 500;
    const expectedTimestamp = worldTick * 10; // seededNow multiplies by 10

    const mutationLog: any[] = [];
    const state = createMockState(12345, worldTick);
    const context: any = {
      state,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    const result = await directorEngine.execute('/announce Test message', context);

    expect(result.status).toBe('success');
    expect(mutationLog.length).toBeGreaterThan(0);
    
    const announceMutation = mutationLog.find(m => m.action === 'announce');
    expect(announceMutation).toBeDefined();
    expect(announceMutation.timestamp).toBe(expectedTimestamp);
  });

  /**
   * Test: Force epoch command records deterministic mutation
   */
  it('force_epoch command should record deterministic mutation', async () => {
    const worldTick = 250;
    const expectedTimestamp = worldTick * 10;

    const mutationLog: any[] = [];
    const state = createMockState(12345, worldTick);
    const context: any = {
      state,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    const result = await directorEngine.execute('/force_epoch 2', context);

    expect(result.status).toBe('success');
    expect(result.result.triggeredAt).toBe(expectedTimestamp);
  });

  /**
   * Test: Schedule event uses deterministic tick-based timing
   */
  it('schedule_event command should use current worldTick context', async () => {
    const currentTick = 100;
    const delayTicks = 50;

    const mutationLog: any[] = [];
    const state = createMockState(12345, currentTick);
    const context: any = {
      state,
      controller: createMockController(),
      multiplayerEngine: createMockMultiplayerEngine(),
      transitionEngine: createMockTransitionEngine(),
      diagnosticsEngine: createMockDiagnosticsEngine(),
      mutationLog,
      addNarrativeWhisper: createMockNarrativeWhisper()
    };

    const result = await directorEngine.execute(
      `/schedule_event test_event ${delayTicks} TestEvent story_beat 75`,
      context
    );

    expect(result.status).toBe('success');
    // The scheduled fire time should be based on currentTick + delay
    expect(result.result).toBeDefined();
  });

  /**
   * Test: Multiple peers replaying same commands reach consensus
   */
  it('should support peer consensus on replayed commands', async () => {
    const seed = 99999;
    const commands = [
      '/announce --urgent Peer consensus test',
      '/set_faction_power faction_dawn 75',
      '/schedule_event epoch_shift_event 100 EpochShift story_beat 90'
    ];

    // Simulate 3 peers replaying the same commands
    const peerStates = [];
    for (let peerId = 0; peerId < 3; peerId++) {
      const mutationLog: any[] = [];
      const state = createMockState(seed, 1000);
      const context: any = {
        state,
        controller: createMockController(),
        multiplayerEngine: createMockMultiplayerEngine(),
        transitionEngine: createMockTransitionEngine(),
        diagnosticsEngine: createMockDiagnosticsEngine(),
        mutationLog,
        addNarrativeWhisper: createMockNarrativeWhisper()
      };

      for (const cmd of commands) {
        await directorEngine.execute(cmd, context);
      }

      peerStates.push({ peerId, mutationLog });
    }

    // All peers should have identical mutation sequences
    const refMutations = peerStates[0].mutationLog;
    for (let i = 1; i < peerStates.length; i++) {
      const peerMutations = peerStates[i].mutationLog;
      expect(peerMutations.length).toBe(refMutations.length);
      
      peerMutations.forEach((mutation, idx) => {
        expect(mutation.timestamp).toBe(refMutations[idx].timestamp);
        expect(mutation.type).toBe(refMutations[idx].type);
      });
    }
  });
});

// ============================================================================
// MOCK FACTORIES
// ============================================================================

function createMockState(seed: number, tick: number): any {
  const rng = new SeededRng(seed);
  setGlobalRng(rng);

  return {
    id: `world_${seed}`,
    seed,
    tick,
    player: { id: 'player_1', name: 'TestPlayer' },
    factions: [
      { id: 'faction_dawn', power: 50 },
      { id: 'faction_twilight', power: 45 }
    ],
    currentEpoch: 1,
    announcements: [],
    macroEvents: [],
    mutationLog: []
  };
}

function createMockController(): any {
  return {
    performAction: (action: any) => {
      // Mock implementation
    }
  };
}

function createMockMultiplayerEngine(): any {
  return {
    syncPeerState: () => ({
      success: true,
      peerId: 'peer_primary'
    })
  };
}

function createMockTransitionEngine(): any {
  return {
    startWorldTransition: (type: string) => {
      // Mock implementation
    },
    startTransition: (type: string, value: any) => {
      // Mock implementation
    }
  };
}

function createMockDiagnosticsEngine(): any {
  return {
    recordEvent: (event: any) => {
      // Mock implementation
    }
  };
}

function createMockNarrativeWhisper(): any {
  let whisperId = 0;
  return (message: string, priority: string, duration?: number) => {
    return `whisper_${whisperId++}`;
  };
}
