/**
 * World Registry Unit Tests
 * 
 * Tests for the World Registry scaffolding to ensure:
 * - Templates are correctly registered
 * - Template lookup works by ID
 * - Default template is correctly set to demo-fantasy
 * - Metadata is correctly tracked
 */

import { getWorldRegistry, resetWorldRegistry } from '../engine/worldRegistry';

describe('WorldRegistry', () => {
  beforeEach(() => {
    resetWorldRegistry();
  });

  describe('Initialization', () => {
    it('should initialize with built-in templates', () => {
      const registry = getWorldRegistry();
      const templates = registry.listTemplates();
      
      expect(templates).toBeDefined();
      expect(templates.length).toBeGreaterThanOrEqual(2);
      
      const ids = templates.map(t => t.id);
      expect(ids).toContain('demo-fantasy');
      expect(ids).toContain('luxfier-v1');
    });

    it('should set demo-fantasy as default template', () => {
      const registry = getWorldRegistry();
      const defaultId = registry.getDefaultTemplateId();
      
      expect(defaultId).toBe('demo-fantasy');
    });
  });

  describe('Template Lookup', () => {
    it('should retrieve template by ID', () => {
      const registry = getWorldRegistry();
      const template = registry.getTemplate('demo-fantasy');
      
      expect(template).toBeDefined();
      expect(template).not.toBeNull();
      expect(typeof template).toBe('object');
    });

    it('should return null for non-existent template', () => {
      const registry = getWorldRegistry();
      const template = registry.getTemplate('non-existent-world');
      
      expect(template).toBeNull();
    });

    it('should retrieve metadata for template', () => {
      const registry = getWorldRegistry();
      const metadata = registry.getMetadata('demo-fantasy');
      
      expect(metadata).toBeDefined();
      expect(metadata.id).toBe('demo-fantasy');
      expect(metadata.name).toBeDefined();
      expect(metadata.description).toBeDefined();
      expect(metadata.difficulty).toBe('beginner');
      expect(metadata.genre).toBe('fantasy');
    });
  });

  describe('Template Listing', () => {
    it('should list all template metadata', () => {
      const registry = getWorldRegistry();
      const templates = registry.listTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      templates.forEach(t => {
        expect(t.id).toBeDefined();
        expect(t.name).toBeDefined();
        expect(t.description).toBeDefined();
        expect(t.difficulty).toBeDefined();
        expect(t.genre).toBeDefined();
      });
    });
  });

  describe('Template Resolution', () => {
    it('should resolve to default when no explicit ID provided', () => {
      const registry = getWorldRegistry();
      const resolved = registry.resolveTemplateId();
      
      expect(resolved).toBe('demo-fantasy');
    });

    it('should resolve to explicit ID when provided', () => {
      const registry = getWorldRegistry();
      const resolved = registry.resolveTemplateId('luxfier-v1');
      
      expect(resolved).toBe('luxfier-v1');
    });

    it('should fall back to default if explicit ID not found', () => {
      const registry = getWorldRegistry();
      const resolved = registry.resolveTemplateId('invalid-id');
      
      expect(resolved).toBe('demo-fantasy');
    });
  });

  describe('Demo-First Verification', () => {
    it('demo-fantasy template should have beginner difficulty', () => {
      const registry = getWorldRegistry();
      const metadata = registry.getMetadata('demo-fantasy');
      
      expect(metadata.difficulty).toBe('beginner');
    });

    it('demo-fantasy template should be lightweight', () => {
      const registry = getWorldRegistry();
      const template = registry.getTemplate('demo-fantasy');
      
      expect(template).toBeDefined();
      expect(template.locations).toBeDefined();
      expect(template.npcs).toBeDefined();
      expect(Array.isArray(template.locations)).toBe(true);
    });
  });
});

