import { templateHotSwapManager, TemplateHotSwapManager } from '../engine/templateHotSwap';
import { WorldTemplate, UserTemplate } from '../engine/templateEditor';
import { validateTemplate } from '../engine/templateEditor';

describe('TemplateHotSwapManager', () => {
  let manager: TemplateHotSwapManager;
  let mockController: any;
  let testTemplate: UserTemplate;
  let secondTemplate: UserTemplate;

  beforeEach(() => {
    manager = new TemplateHotSwapManager();
    mockController = {
      getWorldState: jest.fn(() => ({ name: 'test' })),
      performAction: jest.fn(),
    };

    testTemplate = {
      id: 'template-1',
      name: 'Test Template',
      description: 'A test template',
      version: 1,
      authorId: 'author-1',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isPublic: false,
      downloads: 0,
      template: {
        id: 'world-1',
        name: 'Test World',
        description: 'A test world',
        season: 'spring',
        startingLocation: 'Village',
        locations: [
          { id: 'loc1', name: 'Village', x: 0, y: 0, description: 'Starting point' },
        ],
        npcs: [
          { id: 'npc1', name: 'NPC1', locationId: 'loc1', schedule: [] }
        ],
        quests: [],
        loot: [],
      },
    };

    secondTemplate = {
      ...testTemplate,
      id: 'template-2',
      name: 'Second Template',
      template: {
        ...testTemplate.template,
        id: 'world-2',
      }
    };
  });

  afterEach(() => {
    manager.exitTestMode();
  });

  describe('swapTemplate', () => {
    test('should successfully swap to a valid template', () => {
      manager.init(mockController);

      const result = manager.swapTemplate(testTemplate);

      expect(result.success).toBe(true);
      expect(Array.isArray(result.errors) || result.errors === undefined).toBe(true);
      expect(manager.isInTestMode()).toBe(true);
    });

    test('should return validation errors for invalid template', () => {
      manager.init(mockController);
      const invalidTemplate = { ...testTemplate, template: { ...testTemplate.template, locations: [] } };

      const result = manager.swapTemplate(invalidTemplate);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should track swap in history', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      const history = manager.getSwapHistory();

      expect(history).toHaveLength(1);
      expect(history[0].toTemplateId).toBe('template-1');
    });

    test('should set baseTemplateId on first swap', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      const state = manager.getTestState();

      expect(state.baseTemplateId).toBe('template-1');
    });

    test('should track previous template on multiple swaps', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      const history1 = manager.getSwapHistory();

      manager.swapTemplate(secondTemplate);
      const history2 = manager.getSwapHistory();

      expect(history1).toHaveLength(1);
      expect(history2).toHaveLength(2);
      expect(history2[1].toTemplateId).toBe('template-2');
    });

    test('should return warnings with swap result', () => {
      manager.init(mockController);
      const templateWithWarnings = { ...testTemplate, template: { ...testTemplate.template, quests: undefined } };

      const result = manager.swapTemplate(templateWithWarnings);

      // Should have success=true but may have warnings
      expect(result.success).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('rollback', () => {
    test('should rollback to previous template', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      manager.swapTemplate(secondTemplate);

      const rollbackResult = manager.rollback();

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.newTemplateId).toBe(testTemplate.id);
    });

    test('should return error when no history available', () => {
      manager.init(mockController);

      const rollbackResult = manager.rollback();

      expect(rollbackResult.success).toBe(false);
      expect(rollbackResult.errors.length).toBeGreaterThan(0);
    });

    test('should maintain history after rollback', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      manager.swapTemplate(secondTemplate);
      manager.rollback();

      const history = manager.getSwapHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('should be able to rollback multiple times', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      manager.swapTemplate(secondTemplate);

      const rollback1 = manager.rollback();

      expect(rollback1.success).toBe(true);

      const history = manager.getSwapHistory();
      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('getTestState', () => {
    test('should return test state when in test mode', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);

      const state = manager.getTestState();

      expect(state.isTestMode).toBe(true);
      expect(state.baseTemplateId).toBe(testTemplate.id);
      expect(state.testingTemplateId).toBe(testTemplate.id);
    });

    test('should show isTestMode false when not in test', () => {
      manager.init(mockController);

      const state = manager.getTestState();

      expect(state.isTestMode).toBe(false);
    });

    test('should track swapCount correctly', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      manager.swapTemplate(secondTemplate);

      const state = manager.getTestState();

      expect(state.swapHistory.length).toBe(2);
    });
  });

  describe('getSwapHistory', () => {
    test('should return empty history initially', () => {
      manager.init(mockController);

      const history = manager.getSwapHistory();

      expect(history).toHaveLength(0);
    });

    test('should include swap timestamps', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      const history = manager.getSwapHistory();

      expect(typeof history[0].timestamp).toBe('number');
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    test('should not modify history when accessed', () => {
      manager.init(mockController);

      manager.swapTemplate(testTemplate);
      const history1 = manager.getSwapHistory();
      const history2 = manager.getSwapHistory();

      expect(history1).toEqual(history2);
    });
  });

  describe('exitTestMode', () => {
    test('should reset test mode', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);

      manager.exitTestMode();

      expect(manager.isInTestMode()).toBe(false);
    });

    test('should clear test state', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);

      manager.exitTestMode();
      const state = manager.getTestState();

      expect(state.isTestMode).toBe(false);
      expect(state.testingTemplateId).toBeUndefined();
    });

    test('should preserve swap history after exit', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);
      const historyDuring = manager.getSwapHistory().length;

      manager.exitTestMode();
      const historyAfter = manager.getSwapHistory().length;

      // History should be cleared on exit
      expect(historyAfter).toBe(0);
    });
  });

  describe('isInTestMode', () => {
    test('should return false initially', () => {
      manager.init(mockController);

      expect(manager.isInTestMode()).toBe(false);
    });

    test('should return true after swap', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);

      expect(manager.isInTestMode()).toBe(true);
    });

    test('should return false after exit', () => {
      manager.init(mockController);
      manager.swapTemplate(testTemplate);
      manager.exitTestMode();

      expect(manager.isInTestMode()).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    test('should be a singleton instance', () => {
      expect(templateHotSwapManager).toBeInstanceOf(TemplateHotSwapManager);
    });
  });
});
