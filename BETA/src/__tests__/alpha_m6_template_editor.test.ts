/**
 * ALPHA_M6: Template Editor Validation & Composition Tests
 * Tests validateTemplate(), composeFromModules(), and export/import functionality
 */

import {
  validateTemplate,
  composeFromModules,
  exportTemplateAsJson,
  importTemplateFromJson,
  createBlankTemplate,
  type TemplateModule,
  type UserTemplate,
  type WorldTemplate
} from '../engine/templateEditor';

describe('ALPHA_M6: Template Editor', () => {
  describe('validateTemplate()', () => {
    it('should accept a valid template with all required fields', () => {
      const template: WorldTemplate = {
        id: 'tpl-1',
        name: 'Test World',
        description: 'A test world',
        season: 'spring',
        locations: [
          { id: 'loc-1', name: 'Town Square', x: 0, y: 0 }
        ],
        npcs: [
          { id: 'npc-1', name: 'John', locationId: 'loc-1' }
        ],
        quests: [
          { id: 'quest-1', title: 'Rescue the Cat' }
        ]
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject template missing required fields', () => {
      const invalidTemplate = {
        id: 'tpl-1',
        name: 'Incomplete' // missing description, season, locations, npcs, quests
      };

      const result = validateTemplate(invalidTemplate);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should validate location IDs', () => {
      const template: WorldTemplate = {
        id: 'tpl-1',
        name: 'Test World',
        description: 'Test',
        season: 'summer',
        locations: [
          { id: 'loc-1', name: 'Home' }
        ],
        npcs: [
          { id: 'npc-1', name: 'Bob', locationId: 'loc-invalid' } // Invalid location reference
        ],
        quests: []
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('non-existent location'))).toBe(true);
    });

    it('should detect duplicate location IDs', () => {
      const template: WorldTemplate = {
        id: 'tpl-1',
        name: 'Test World',
        description: 'Test',
        season: 'autumn',
        locations: [
          { id: 'loc-1', name: 'Home' },
          { id: 'loc-1', name: 'Duplicate' } // Duplicate ID
        ],
        npcs: [],
        quests: []
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Duplicate location ID'))).toBe(true);
    });

    it('should warn about templates without NPCs', () => {
      const template: WorldTemplate = {
        id: 'tpl-1',
        name: 'Empty World',
        description: 'No NPCs',
        season: 'winter',
        locations: [
          { id: 'loc-1', name: 'Lonely Place' }
        ],
        npcs: [],
        quests: []
      };

      const result = validateTemplate(template);
      expect(result.valid).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(w => w.includes('no NPCs'))).toBe(true);
    });
  });

  describe('composeFromModules()', () => {
    it('should merge multiple location modules', () => {
      const modules: TemplateModule[] = [
        {
          id: 'mod-1',
          name: 'Towns',
          type: 'locations',
          content: [
            { id: 'town-1', name: 'Rivertown' },
            { id: 'town-2', name: 'Hillford' }
          ]
        },
        {
          id: 'mod-2',
          name: 'Dungeons',
          type: 'locations',
          content: [
            { id: 'dungeon-1', name: 'Dark Cavern' }
          ]
        }
      ];

      const result = composeFromModules(modules);
      expect(result.locations).toHaveLength(3);
      expect(result.locations?.some(loc => loc.id === 'town-1')).toBe(true);
      expect(result.locations?.some(loc => loc.id === 'dungeon-1')).toBe(true);
    });

    it('should handle NPC module composition', () => {
      const modules: TemplateModule[] = [
        {
          id: 'mod-1',
          name: 'Villagers',
          type: 'npcs',
          content: [
            { id: 'npc-1', name: 'Alice', locationId: 'town-1' },
            { id: 'npc-2', name: 'Bob', locationId: 'town-2' }
          ]
        }
      ];

      const result = composeFromModules(modules);
      expect(result.npcs).toHaveLength(2);
      expect(result.npcs?.find(npc => npc.name === 'Alice')).toBeDefined();
    });

    it('should resolve NPC ID conflicts using merge strategy', () => {
      const modules: TemplateModule[] = [
        {
          id: 'mod-1',
          name: 'Base NPCs',
          type: 'npcs',
          content: [
            { id: 'npc-1', name: 'Original Alice', locationId: 'loc-1' }
          ]
        },
        {
          id: 'mod-2',
          name: 'Update Module',
          type: 'npcs',
          content: [
            { id: 'npc-1', name: 'Updated Alice', locationId: 'loc-1' } // Same ID
          ]
        }
      ];

      const result = composeFromModules(modules);
      expect(result.npcs).toHaveLength(1);
      expect(result.npcs?.[0].name).toBe('Updated Alice'); // Newer wins
      expect((result.npcs?.[0] as any)._source).toBe('Update Module'); // Source of latest wins
    });

    it('should merge quest modules', () => {
      const modules: TemplateModule[] = [
        {
          id: 'mod-1',
          name: 'Main Quests',
          type: 'quests',
          content: [
            { id: 'quest-1', title: 'Save the Village' },
            { id: 'quest-2', title: 'Defeat the Boss' }
          ]
        }
      ];

      const result = composeFromModules(modules);
      expect(result.quests).toHaveLength(2);
    });

    it('should store composition metadata', () => {
      const modules: TemplateModule[] = [
        {
          id: 'mod-1',
          name: 'Module 1',
          type: 'locations',
          content: [{ id: 'loc-1', name: 'Place' }]
        }
      ];

      const result = composeFromModules(modules);
      expect(result.locations).toBeDefined();
      expect(result.locations).toHaveLength(1);
      expect((result.locations?.[0] as any)._source).toBe('Module 1');
    });
  });

  describe('exportTemplateAsJson()', () => {
    it('should export a valid template as JSON string', () => {
      const template: UserTemplate = {
        id: 'utpl-1',
        name: 'My World',
        description: 'My custom world',
        authorId: 'user-1',
        template: {
          id: 'tpl-1',
          name: 'My World',
          description: 'My custom world',
          season: 'spring',
          locations: [{ id: 'loc-1', name: 'Town' }],
          npcs: [{ id: 'npc-1', name: 'Guard', locationId: 'loc-1' }],
          quests: [{ id: 'q-1', title: 'Defend' }]
        },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        downloads: 0
      };

      const jsonStr = exportTemplateAsJson(template);
      expect(typeof jsonStr).toBe('string');
      expect(jsonStr).toContain('"name": "My World"');
      expect(jsonStr).toContain('"author": "user-1"');
    });

    it('should include mandatory fields in export', () => {
      const template: UserTemplate = {
        id: 'utpl-1',
        name: 'Export Test',
        description: 'Test export',
        authorId: 'dev',
        template: {
          id: 'tpl-1',
          name: 'Export Test',
          description: 'Test export',
          season: 'summer',
          locations: [{ id: 'loc-1', name: 'TestLoc' }],
          npcs: [],
          quests: []
        },
        version: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        downloads: 0
      };

      const jsonStr = exportTemplateAsJson(template);
      const parsed = JSON.parse(jsonStr);
      
      expect(parsed.meta.id).toBeTruthy();
      expect(parsed.meta.name).toBe('Export Test');
      expect(parsed.template.id).toBeTruthy();
      // Note: startLocation is not included in export by default anymore
      expect(parsed.template.locations?.length).toBe(1);
    });

    it('should throw error if template is invalid', () => {
      const invalidTemplate: any = {
        id: 'utpl-1',
        name: 'Invalid',
        authorId: 'dev',
        template: {
          name: 'No Locations', // Missing required fields
          season: 'spring'
        },
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        downloads: 0
      };

      expect(() => exportTemplateAsJson(invalidTemplate)).toThrow();
    });
  });

  describe('importTemplateFromJson()', () => {
    it('should import valid JSON as UserTemplate', () => {
      const jsonStr = JSON.stringify({
        meta: {
          name: 'Imported World',
          author: 'extern',
          version: 1
        },
        template: {
          id: 'tpl-import-1',
          name: 'Imported World',
          description: 'From JSON',
          season: 'autumn',
          locations: [{ id: 'loc-1', name: 'Entrance' }],
          npcs: [{ id: 'npc-1', name: 'Guide', locationId: 'loc-1' }],
          quests: [{ id: 'q-1', title: 'Explore' }]
        }
      });

      const result = importTemplateFromJson(jsonStr);
      expect(result.success).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.name).toBe('Imported World');
      expect(result.template?.template.locations).toHaveLength(1);
    });

    it('should reject invalid JSON', () => {
      const result = importTemplateFromJson('{ invalid json }');
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(e => e.includes('parse JSON'))).toBe(true);
    });

    it('should validate imported template structure', () => {
      const jsonStr = JSON.stringify({
        meta: { name: 'Bad Template' },
        template: {
          name: 'Incomplete' // Missing required fields
        }
      });

      const result = importTemplateFromJson(jsonStr);
      expect(result.success).toBe(false);
      expect(result.errors?.some(e => e.includes('Invalid template'))).toBe(true);
    });

    it('should preserve metadata during import/export cycle', () => {
      const original: UserTemplate = {
        id: 'utpl-cycle-1',
        name: 'Cycle Test',
        description: 'Testing round-trip',
        authorId: 'tester',
        template: {
          id: 'tpl-1',
          name: 'Cycle Test',
          description: 'Testing round-trip',
          season: 'winter',
          locations: [{ id: 'loc-1', name: 'Base' }],
          npcs: [{ id: 'npc-1', name: 'Survivor', locationId: 'loc-1' }],
          quests: [{ id: 'q-1', title: 'Survive' }]
        },
        version: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: false,
        downloads: 0
      };

      // Export
      const jsonStr = exportTemplateAsJson(original);

      // Import
      const importResult = importTemplateFromJson(jsonStr);
      expect(importResult.success).toBe(true);

      const imported = importResult.template!;
      expect(imported.name).toBe(original.name);
      expect(imported.template.season).toBe(original.template.season);
      expect(imported.template.npcs?.length).toBe(original.template.npcs?.length);
    });
  });

  describe('Integration Tests', () => {
    it('should create, validate, export, and import a complete template workflow', () => {
      // 1. Create modules
      const locationModule: TemplateModule = {
        id: 'mod-locs',
        name: 'Starter Locations',
        type: 'locations',
        content: [
          { id: 'village', name: 'Starter Village' },
          { id: 'forest', name: 'Ancient Forest' }
        ]
      };

      const npcModule: TemplateModule = {
        id: 'mod-npcs',
        name: 'Starter NPCs',
        type: 'npcs',
        content: [
          { id: 'mentor', name: 'Old Mentor', locationId: 'village' },
          { id: 'ranger', name: 'Forest Ranger', locationId: 'forest' }
        ]
      };

      // 2. Compose template from modules
      const composed = composeFromModules([locationModule, npcModule]);
      expect(composed.locations).toHaveLength(2);
      expect(composed.npcs).toHaveLength(2);

      // 3. Validate composed template
      const validation = validateTemplate(composed);
      expect(validation.valid).toBe(false); // Missing season and description
      
      // 4. Add missing fields
      composed.season = 'spring';
      composed.description = 'Starter world for new players';
      
      const validation2 = validateTemplate(composed);
      expect(validation2.valid).toBe(true);

      // 5. Create UserTemplate and export
      const userTemplate: UserTemplate = {
        id: 'starter-pack',
        name: 'Starter Pack',
        description: 'Perfect for beginners',
        authorId: 'system',
        template: composed,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPublic: true,
        downloads: 0
      };

      const exported = exportTemplateAsJson(userTemplate);

      // 6. Import the exported template
      const importResult = importTemplateFromJson(exported);
      expect(importResult.success).toBe(true);
      expect(importResult.template?.template.locations).toHaveLength(2);
      expect(importResult.template?.template.npcs).toHaveLength(2);
    });
  });
});
