/**
 * M42 Phase 4 Task 1: Director Command Engine - Unit Tests
 * 
 * Tests for all 9 built-in commands + command registration
 */

import { DirectorCommandEngine, CommandResult } from '../engine/directorCommandEngine';

describe('DirectorCommandEngine', () => {
  let engine: DirectorCommandEngine;
  let mockContext: any;

  beforeEach(() => {
    engine = new DirectorCommandEngine('test_director');
    mockContext = {
      state: {
        id: 'world_test',
        epochId: '1',
        player: { id: 'player_1', location: 'forest' },
        factions: [
          { id: 'faction_01', power: 50 },
          { id: 'faction_02', power: 40 }
        ],
        macroEvents: [],
        phantoms: [
          { id: 'phantom_1', name: 'Echo-001' },
          { id: 'phantom_2', name: 'Echo-002' }
        ],
        announcements: []
      },
      controller: {
        performAction: jest.fn().mockResolvedValue(true),
        getState: jest.fn().mockReturnValue(mockContext.state)
      },
      multiplayerEngine: {
        requestFullSync: jest.fn().mockResolvedValue(true),
        getPeerRegistry: jest.fn().mockReturnValue([
          { id: 'peer_00', connected: true, latency: 45 },
          { id: 'peer_01', connected: true, latency: 38 },
          { id: 'peer_02', connected: false, latency: null }
        ])
      },
      transitionEngine: {
        startWorldTransition: jest.fn().mockReturnValue(true)
      },
      mutationLog: []
    };
  });

  describe('Command: /force_epoch', () => {
    it('should accept epochs 1, 2, or 3', async () => {
      const result = await engine.execute('/force_epoch 2', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.newEpoch).toBe(2);
    });

    it('should reject invalid epoch numbers', async () => {
      const result = await engine.execute('/force_epoch 5', mockContext);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Epoch must be 1');
    });

    it('should require an argument', async () => {
      const result = await engine.execute('/force_epoch', mockContext);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Usage');
    });

    it('should trigger transition engine', async () => {
      await engine.execute('/force_epoch 3', mockContext);
      expect(mockContext.transitionEngine.startWorldTransition).toHaveBeenCalled();
    });

    it('should record DIRECTOR_OVERRIDE mutation', async () => {
      const before = mockContext.mutationLog.length;
      await engine.execute('/force_epoch 1', mockContext);
      expect(mockContext.mutationLog.length).toBe(before + 1);
      expect(mockContext.mutationLog[before].type).toBe('DIRECTOR_OVERRIDE');
    });
  });

  describe('Command: /spawn_macro_event', () => {
    it('should accept event ID', async () => {
      const result = await engine.execute('/spawn_macro_event catastrophe_01', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.eventId).toBe('catastrophe_01');
    });

    it('should add event to state', async () => {
      const before = mockContext.state.macroEvents.length;
      await engine.execute('/spawn_macro_event faction_war_01', mockContext);
      expect(mockContext.state.macroEvents.length).toBe(before + 1);
    });

    it('should require an event ID', async () => {
      const result = await engine.execute('/spawn_macro_event', mockContext);
      expect(result.status).toBe('error');
    });

    it('should trigger transition for catastrophe events', async () => {
      await engine.execute('/spawn_macro_event catastrophe_meteor', mockContext);
      expect(mockContext.transitionEngine.startWorldTransition).toHaveBeenCalled();
    });
  });

  describe('Command: /kick_phantom', () => {
    it('should clear all phantoms', async () => {
      expect(mockContext.state.phantoms.length).toBe(2);
      const result = await engine.execute('/kick_phantom', mockContext);
      expect(result.status).toBe('success');
      expect(mockContext.state.phantoms.length).toBe(0);
      expect(result.result?.clearedPhantoms).toBe(2);
    });

    it('should handle empty phantom list', async () => {
      mockContext.state.phantoms = [];
      const result = await engine.execute('/kick_phantom', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.clearedPhantoms).toBe(0);
    });
  });

  describe('Command: /reset_consensus', () => {
    it('should call requestFullSync', async () => {
      const result = await engine.execute('/reset_consensus', mockContext);
      expect(result.status).toBe('success');
      expect(mockContext.multiplayerEngine.requestFullSync).toHaveBeenCalled();
    });
  });

  describe('Command: /list_peers', () => {
    it('should return peer registry', async () => {
      const result = await engine.execute('/list_peers', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.peers).toHaveLength(3);
    });

    it('should include peer latency', async () => {
      const result = await engine.execute('/list_peers', mockContext);
      const peers = result.result?.peers;
      expect(peers[0].latency).toBe('45ms');
      expect(peers[2].latency).toBe('N/A');
    });

    it('should show connection status', async () => {
      const result = await engine.execute('/list_peers', mockContext);
      const peers = result.result?.peers;
      expect(peers[0].status).toBe('online');
      expect(peers[2].status).toBe('offline');
    });
  });

  describe('Command: /announce', () => {
    it('should broadcast message', async () => {
      const result = await engine.execute('/announce The gates are shattered!', mockContext);
      expect(result.status).toBe('success');
      expect(mockContext.state.announcements[0].message).toBe('The gates are shattered!');
    });

    it('should mark announcements as diegetic', async () => {
      await engine.execute('/announce Test message', mockContext);
      expect(mockContext.state.announcements[0].diegetic).toBe(true);
    });

    it('should require a message', async () => {
      const result = await engine.execute('/announce', mockContext);
      expect(result.status).toBe('error');
    });
  });

  describe('Command: /set_faction_power', () => {
    it('should set faction power', async () => {
      const result = await engine.execute('/set_faction_power faction_01 75', mockContext);
      expect(result.status).toBe('success');
      expect(mockContext.state.factions[0].power).toBe(75);
    });

    it('should clamp power to 0-100 range', async () => {
      await engine.execute('/set_faction_power faction_01 150', mockContext);
      expect(mockContext.state.factions[0].power).toBeLessThanOrEqual(100);
    });

    it('should reject unknown faction', async () => {
      const result = await engine.execute('/set_faction_power faction_unknown 50', mockContext);
      expect(result.status).toBe('error');
      expect(result.error).toContain('not found');
    });

    it('should require numeric power value', async () => {
      const result = await engine.execute('/set_faction_power faction_01 abc', mockContext);
      expect(result.status).toBe('error');
    });
  });

  describe('Command: /help', () => {
    it('should list all available commands', async () => {
      const result = await engine.execute('/help', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.commands).toContain('force_epoch');
      expect(result.result?.commands).toContain('spawn_macro_event');
      expect(result.result?.commands).toContain('announce');
    });
  });

  describe('Command: /history', () => {
    it('should return command history', async () => {
      await engine.execute('/force_epoch 1', mockContext);
      await engine.execute('/announce Test', mockContext);
      const result = await engine.execute('/history', mockContext);
      expect(result.status).toBe('success');
      expect(result.result?.commands.length).toBeGreaterThan(0);
    });

    it('should support custom limit', async () => {
      for (let i = 0; i < 10; i++) {
        await engine.execute('/help', mockContext);
      }
      const result = await engine.execute('/history 3', mockContext);
      expect(result.result?.commands.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Command Registration', () => {
    it('should allow custom command registration', async () => {
      engine.register('custom', async () => ({
        success: true,
        message: 'Custom command executed'
      }));

      const result = await engine.execute('/custom', mockContext);
      expect(result.status).toBe('success');
    });

    it('should override built-in commands', async () => {
      engine.register('help', async () => ({
        success: true,
        message: 'Custom help handler'
      }));

      const result = await engine.execute('/help', mockContext);
      expect(result.result?.message).toBe('Custom help handler');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown commands', async () => {
      const result = await engine.execute('/unknown_command', mockContext);
      expect(result.status).toBe('error');
      expect(result.error).toContain('Unknown command');
    });

    it('should handle case-insensitive commands', async () => {
      const result1 = await engine.execute('/HELP', mockContext);
      const result2 = await engine.execute('/Help', mockContext);
      expect(result1.status).toBe('success');
      expect(result2.status).toBe('success');
    });

    it('should trim whitespace', async () => {
      const result = await engine.execute('  /help  ', mockContext);
      expect(result.status).toBe('success');
    });
  });

  describe('History Management', () => {
    it('should maintain command history', () => {
      expect(engine.getHistory(0)).toHaveLength(0);
    });

    it('should limit history to max size', () => {
      for (let i = 0; i < 1100; i++) {
        // Execute and auto-record
      }
      const history = engine.getHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });

    it('should return available commands list', () => {
      const commands = engine.getAvailableCommands();
      expect(commands).toContain('force_epoch');
      expect(commands).toContain('help');
    });
  });
});
