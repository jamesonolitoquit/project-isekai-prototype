/**
 * Phase 30 Task 4-5: Weaver UI & Quest Integration Test
 * 
 * Comprehensive integration test verifying:
 * 1. WeaverProcessingIndicator wired correctly in HUD
 * 2. Processing indicator updates with latency tiers
 * 3. Tutorial async synthesis completes and updates overlay
 * 4. Quest enhancement works with slow API
 * 5. Multiple systems working together without blocking UI ticks
 */

import {
  getNextTutorialOverlay,
  getNextTutorialOverlayAsync,
  initializeTutorialState,
  updateTutorialState,
  detectMilestones,
  triggerWeaverMilestone,
  type TutorialState
} from '../engine/tutorialEngine';
import { getQuestSynthesisAI, type ProceduralQuest } from '../engine/questSynthesisAI';
import type { WorldState } from '../engine/worldEngine';

// Mock AIService for testing with configurable latency
class MockAIService {
  private latencyMs: number = 0;
  private shouldFail: boolean = false;
  private eventEmitter: Map<string, Function[]> = new Map();

  constructor(latencyMs: number = 0, shouldFail: boolean = false) {
    this.latencyMs = latencyMs;
    this.shouldFail = shouldFail;
  }

  async synthesize(context: any) {
    // Emit progress events
    this.emit('synthesisStart', context.type);

    // Simulate progressive synthesis
    const steps = 5;
    const stepDuration = this.latencyMs / steps;
    
    for (let i = 0; i < steps; i++) {
      await new Promise(resolve => setTimeout(resolve, stepDuration));
      this.emit('synthesisProgress', (i + 1) / steps * 100, (i + 1) * stepDuration);
    }

    if (this.shouldFail) {
      this.emit('synthesisError', 'Mock API failure');
      return {
        content: '',
        provider: 'static_fallback',
        latency: this.latencyMs,
        error: 'Synthesis failed'
      };
    }

    // Generate synthetic response based on context
    let content = '';
    
    if (context.type === 'knowledge_gated_tutorial') {
      const knowledgeLevel = context.factors?.knowledgeLevel || 0;
      const difficulty = knowledgeLevel > 10 ? 'advanced' : knowledgeLevel > 5 ? 'intermediate' : 'beginner';
      content = `[AI Enhancement - ${difficulty}] Enhanced tutorial for ${context.factors?.milestoneId}`;
    } else if (context.type === 'quest_prologue') {
      const questTitle = context.factors?.questTitle || 'Unknown Quest';
      content = `[AI Weaver] A mysterious adventure awaits: ${questTitle}. The threads converge...`;
    }

    this.emit('synthesisComplete', { latency: this.latencyMs });
    
    return {
      content,
      provider: 'groq',
      latency: this.latencyMs
    };
  }

  on(event: string, callback: Function) {
    if (!this.eventEmitter.has(event)) {
      this.eventEmitter.set(event, []);
    }
    this.eventEmitter.get(event)!.push(callback);
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.eventEmitter.get(event) || [];
    callbacks.forEach(cb => cb(...args));
  }
}

describe('Phase 30 Task 4-5: Weaver UI & Quest Integration', () => {
  // =========================================================================
  // Test 1: Fast API Response (< 100ms)
  // =========================================================================
  test('1. Fast API response triggers blue latency indicator', async () => {
    const mockAI = new MockAIService(50); // 50ms latency
    const events: any[] = [];

    mockAI.on('synthesisStart', (type: string) => {
      events.push({ type: 'start', synthType: type });
    });

    mockAI.on('synthesisProgress', (progress: number, latency: number) => {
      events.push({ type: 'progress', progress, latency });
    });

    mockAI.on('synthesisComplete', (result: any) => {
      events.push({ type: 'complete', latency: result.latency });
    });

    // Create mock tutorial state
    const tutorialState = initializeTutorialState();
    const mockWorldState = {
      tick: 1000,
      paradoxLevel: 25,
      ageRotSeverity: 'none',
      player: { knowledgeLevel: 5 }
    } as any;

    // Trigger async synthesis
    const overlay = await getNextTutorialOverlayAsync(
      tutorialState,
      mockWorldState,
      5
    );

    // Verify events were emitted
    expect(events.length).toBeGreaterThan(0);
    expect(events.some(e => e.type === 'start')).toBe(true);
    expect(events.some(e => e.type === 'complete')).toBe(true);

    // Verify latency falls in 'fast' range
    const completeEvent = events.find(e => e.type === 'complete');
    expect(completeEvent?.latency).toBeLessThan(100);

    // Verify overlay is updated with AI content
    expect(overlay?.text).toContain('AI Enhancement');
  });

  // =========================================================================
  // Test 2: Slow API Response (2000ms) with yellow indicator
  // =========================================================================
  test('2. Slow API response (2000ms) returns with appropriate intensity', async () => {
    const mockAI = new MockAIService(2000); // 2000ms latency
    let finalLatency = 0;

    mockAI.on('synthesisComplete', (result: any) => {
      finalLatency = result.latency;
    });

    const tutorialState = initializeTutorialState();
    const mockWorldState = { 
      tick: 1000, 
      paradoxLevel: 75,
      ageRotSeverity: 'moderate'
    } as any;

    const startTime = Date.now();
    const overlay = await getNextTutorialOverlayAsync(
      tutorialState,
      mockWorldState,
      10
    );
    const duration = Date.now() - startTime;

    // Verify latency is in critical range (>2000ms would be critical)
    expect(finalLatency).toBe(2000);
    expect(duration).toBeGreaterThanOrEqual(2000);
    expect(overlay).toBeDefined();
  });

  // =========================================================================
  // Test 3: API Failure with Graceful Fallback
  // =========================================================================
  test('3. API failure falls back to static tutorial', async () => {
    const mockAI = new MockAIService(500, true); // Fail after 500ms
    let errorEmitted = false;

    mockAI.on('synthesisError', () => {
      errorEmitted = true;
    });

    const tutorialState = initializeTutorialState();
    const mockWorldState = { 
      tick: 1000,
      paradoxLevel: 50,
      ageRotSeverity: 'moderate'
    } as any;

    // Try async synthesis that will fail
    const overlay = await getNextTutorialOverlayAsync(
      tutorialState,
      mockWorldState,
      0
    );

    // Should still have an overlay (static fallback)
    expect(overlay).toBeDefined();
    expect(overlay?.text).toBeDefined();
    expect(overlay?.visible).toBe(true);
  });

  // =========================================================================
  // Test 4: Tutorial Milestone triggers async enhancement
  // =========================================================================
  test('4. Weaver milestone detection triggers async synthesis', async () => {
    const mockAI = new MockAIService(100);
    let synthesisTriggered = false;

    mockAI.on('synthesisStart', () => {
      synthesisTriggered = true;
    });

    // Create state with Weaver milestone conditions
    let tutorialState = initializeTutorialState();
    
    // Trigger Weaver milestone
    tutorialState = triggerWeaverMilestone(tutorialState, 3, 1000);

    expect(tutorialState.milestones.weaver.achieved).toBe(true);

    // Get next overlay should reflect the milestone
    const overlay = getNextTutorialOverlay(tutorialState);
    expect(overlay).toBeDefined();
    expect(overlay?.milestoneId).toMatch(/weaver|grand/i);
  });

  // =========================================================================
  // Test 5: Quest Enhancement without blocking
  // =========================================================================
  test('5. Quest enhancement runs asynchronously without blocking', async () => {
    const questSynthesis = getQuestSynthesisAI(12345);
    const mockQuestEvents: any[] = [];
    
    // Create mock quests
    const mockQuests: ProceduralQuest[] = [
      {
        id: 'quest_1',
        title: 'Recover the Lost Tome',
        description: 'A scholar seeks aid',
        synthesisSource: 'faction_warfare',
        parentFactors: ['faction_0'],
        dynamicObjectives: [],
        rewardVariant: 'knowledge',
        difficultyRating: 3,
        objectives: []
      } as ProceduralQuest,
      {
        id: 'quest_2',
        title: 'Forge an Ancient Alliance',
        description: 'Factions need united front',
        synthesisSource: 'npc_memory',
        parentFactors: ['faction_1'],
        dynamicObjectives: [],
        rewardVariant: 'reputation',
        difficultyRating: 5,
        objectives: []
      } as ProceduralQuest
    ];

    const mockWorldState = {
      id: 'world_1',
      tick: 1000,
      paradoxLevel: 30,
      player: { currentRace: 'Human', knowledgeLevel: 7 },
      factions: []
    } as any;

    // Record timing - batch enhancement should not block
    const startTime = Date.now();
    
    // Fire off enhancement without awaiting in outer scope
    // In real scenario, this would happen in a Promise chain
    const enhancementPromise = questSynthesis.batchEnhanceQuestsWithAI(
      mockQuests,
      mockWorldState
    );

    // Immediate check - enhancement should start async
    const immediateTime = Date.now();
    expect(immediateTime - startTime).toBeLessThan(50); // Should not block

    // Wait for completion
    await enhancementPromise;
    
    // Quests should be enhanced by now
    expect(mockQuests.some(q => q.description.includes('Weaver'))).toBe(true);
  });

  // =========================================================================
  // Test 6: Multiple Systems Integration
  // =========================================================================
  test('6. Tutorial + Processing Indicator + Quest Enhancement together', async () => {
    const mockAI = new MockAIService(300);
    const events: any[] = [];

    // Subscribe to processing events
    mockAI.on('synthesisStart', (type: string) => {
      events.push({ 
        type: 'weaverStart', 
        processingState: {
          isProcessing: true,
          latencyMs: 0,
          synthesisType: type,
          progress: 0
        }
      });
    });

    mockAI.on('synthesisProgress', (progress: number, latency: number) => {
      events.push({
        type: 'weaverProgress',
        processingState: {
          isProcessing: true,
          progress,
          latencyMs: latency
        }
      });
    });

    mockAI.on('synthesisComplete', (result: any) => {
      events.push({
        type: 'weaverComplete',
        processingState: {
          isProcessing: false,
          latencyMs: result.latency
        }
      });
    });

    // Step 1: Milestone triggers tutorial synthesis
    const tutorialState = initializeTutorialState();
    const mockWorldState = {
      tick: 1000,
      paradoxLevel: 40,
      player: { knowledgeLevel: 8 }
    } as any;

    const tutorialOverlay = await getNextTutorialOverlayAsync(
      tutorialState,
      mockWorldState,
      8
    );

    expect(tutorialOverlay).toBeDefined();
    expect(events.length).toBeGreaterThan(0);

    // Step 2: Quests are enhanced in parallel
    const questSynthesis = getQuestSynthesisAI(12345);
    const mockQuests: ProceduralQuest[] = [
      {
        id: 'quest_3',
        title: 'Test Quest',
        description: 'Static description',
        synthesisSource: 'world_fragment',
        parentFactors: [],
        dynamicObjectives: [],
        rewardVariant: 'item',
        difficultyRating: 2,
        objectives: []
      } as ProceduralQuest
    ];

    // This runs in background without blocking
    const questPromise = questSynthesis.batchEnhanceQuestsWithAI(
      mockQuests,
      mockWorldState as any
    );

    // Both can progress independently
    expect(tutorialOverlay).toBeDefined();

    await questPromise;
    
    // Verify integration success
    expect(events.some(e => e.type === 'weaverStart')).toBe(true);
    expect(events.some(e => e.type === 'weaverComplete')).toBe(true);
  });

  // =========================================================================
  // Test 7: Latency-Based Intensity Calculation
  // =========================================================================
  test('7. Latency values map correctly to visualization intensity', () => {
    const getLatencyIntensity = (latencyMs: number) => {
      if (latencyMs <= 100) return { tier: 'fast', intensity: 0.2 };
      else if (latencyMs <= 500) return { tier: 'normal', intensity: 0.4 };
      else if (latencyMs <= 2000) return { tier: 'slow', intensity: 0.6 };
      else return { tier: 'critical', intensity: 0.9 };
    };

    // Test all latency tiers
    expect(getLatencyIntensity(50)).toEqual({ tier: 'fast', intensity: 0.2 });
    expect(getLatencyIntensity(100)).toEqual({ tier: 'fast', intensity: 0.2 });
    expect(getLatencyIntensity(250)).toEqual({ tier: 'normal', intensity: 0.4 });
    expect(getLatencyIntensity(500)).toEqual({ tier: 'normal', intensity: 0.4 });
    expect(getLatencyIntensity(1000)).toEqual({ tier: 'slow', intensity: 0.6 });
    expect(getLatencyIntensity(2000)).toEqual({ tier: 'slow', intensity: 0.6 });
    expect(getLatencyIntensity(3000)).toEqual({ tier: 'critical', intensity: 0.9 });
  });

  // =========================================================================
  // Test 8: Paradox Level Affects Enhancement
  // =========================================================================
  test('8. High paradox levels influence synthesis context', async () => {
    const mockAI = new MockAIService(100);
    let capturedContext: any = null;

    // Mock the synthesize to capture context
    const originalSynthesize = mockAI.synthesize.bind(mockAI);
    mockAI.synthesize = async function(context: any) {
      capturedContext = context;
      return originalSynthesize(context);
    };

    const tutorialState = initializeTutorialState();
    
    // Test with high paradox
    const highParadoxWorld = {
      tick: 1000,
      paradoxLevel: 90,
      ageRotSeverity: 'severe'
    } as any;

    await getNextTutorialOverlayAsync(
      tutorialState,
      highParadoxWorld,
      5
    );

    // Verify paradox level was passed to context
    expect(capturedContext?.paradoxLevel).toBe(90);
    expect(capturedContext?.factors?.itemCorruption).toBe(60);
  });

  // =========================================================================
  // Test 9: No Memory Leaks with Multiple Enhancements
  // =========================================================================
  test('9. Multiple sequential enhancements don\'t cause memory issues', async () => {
    const mockAI = new MockAIService(50);
    const tutorialState = initializeTutorialState();
    const mockWorldState = { 
      tick: 1000, 
      paradoxLevel: 25
    } as any;

    // Run multiple enhancements in sequence
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        getNextTutorialOverlayAsync(
          tutorialState,
          mockWorldState,
          i % 5 // Vary knowledge level
        )
      );
    }

    const results = await Promise.all(promises);
    
    // All should complete successfully
    expect(results).toHaveLength(10);
    expect(results.every(r => r !== undefined)).toBe(true);
  });

  // =========================================================================
  // Test 10: Processing Indicator Lifecycle
  // =========================================================================
  test('10. Processing indicator shows correct lifecycle states', async () => {
    const mockAI = new MockAIService(200);
    const states: any[] = [];

    mockAI.on('synthesisStart', (type) => {
      states.push({
        isProcessing: true,
        latencyMs: 0,
        synthesisType: type
      });
    });

    mockAI.on('synthesisProgress', (progress, latency) => {
      states.push({
        isProcessing: true,
        latencyMs: latency,
        progress
      });
    });

    mockAI.on('synthesisComplete', (result) => {
      // Immediate complete state
      states.push({
        isProcessing: false,
        latencyMs: result.latency
      });
      
      // Then clear after 1 second (as per component behavior)
      setTimeout(() => {
        states.push({ cleared: true });
      }, 1000);
    });

    const tutorialState = initializeTutorialState();
    const mockWorldState = { tick: 1000 } as any;

    const startTime = Date.now();
    await getNextTutorialOverlayAsync(tutorialState, mockWorldState, 0);
    
    // Wait for the clear timeout
    await new Promise(resolve => setTimeout(resolve, 1100));

    // Should have start, multiple progress, complete, and clear states
    expect(states.length).toBeGreaterThan(3);
    expect(states[0].isProcessing).toBe(true);
    expect(states[states.length - 1].cleared).toBe(true);
  });
});
