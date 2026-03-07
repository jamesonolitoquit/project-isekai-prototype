/**
 * World Registry — Centralized manager for world templates
 * 
 * Provides:
 * - WorldTemplateMetadata interface for tracking available templates
 * - Registry listing and lookup of official templates (Luxfier, Demo)
 * - Support for dynamic registration of World Seeds (evolved worlds)
 * - Demo-first default with backward compatibility for env flags
 */

import type { NarrativeCodec } from '../client/services/themeManager';
import luxfierTemplate from '../data/luxfier-world.json';
import demoTemplate from '../data/demo-fantasy-world.json';

/**
 * Metadata about a registered world template
 */
export interface WorldTemplateMetadata {
  id: string;                 // Unique identifier (e.g., 'demo-fantasy', 'luxfier-v1')
  name: string;               // Display name (e.g., 'Demo Fantasy World')
  description: string;        // Short description
  difficulty: 'beginner' | 'intermediate' | 'expert'; // Difficulty level
  genre: string;              // Genre/theme (e.g., 'fantasy', 'sci-fi')
  preferredThemeId?: NarrativeCodec; // Recommended narrative codec/visual lens for this world
  authoredAt?: string;        // ISO timestamp when template was created
  seedGeneration?: number;    // If this is an evolved seed, what generation
  parentId?: string;          // If evolved, reference to parent template
}

/**
 * Registry entry combining metadata and the template data
 */
interface RegistryEntry {
  metadata: WorldTemplateMetadata;
  template: any;              // The actual world JSON
}

/**
 * Singleton registry of world templates
 */
class WorldRegistry {
  private registry: Map<string, RegistryEntry> = new Map();
  private defaultTemplateId: string = 'demo-fantasy';

  constructor() {
    this.initializeBuiltInTemplates();
  }

  /**
   * Initialize the registry with built-in templates
   */
  private initializeBuiltInTemplates(): void {
    // Register Demo Fantasy World (default, beginner-friendly)
    this.register({
      id: 'demo-fantasy',
      name: 'Demo Fantasy World',
      description: 'A lightweight, beginner-friendly fantasy world with core mechanics. Ideal for testing and onboarding.',
      difficulty: 'beginner',
      genre: 'fantasy',
      preferredThemeId: 'CODENAME_MEDIEVAL',
      authoredAt: new Date().toISOString(),
      seedGeneration: 0
    }, demoTemplate);

    // Register Luxfier (full world, expert content)
    this.register({
      id: 'luxfier-v1',
      name: 'Luxfier — World of Paradox',
      description: 'The complete Luxfier world with all narrative layers, factions, and paradox mechanics. Recommended for experienced players.',
      difficulty: 'expert',
      genre: 'fantasy',
      preferredThemeId: 'CODENAME_GLITCH',
      authoredAt: new Date().toISOString(),
      seedGeneration: 0
    }, luxfierTemplate);
  }

  /**
   * Register a new world template (for World Seeds and evolved worlds)
   */
  register(metadata: WorldTemplateMetadata, template: any): void {
    if (this.registry.has(metadata.id)) {
      console.warn(`[worldRegistry] Overwriting existing template: ${metadata.id}`);
    }
    this.registry.set(metadata.id, { metadata, template });
    console.log(`[worldRegistry] Registered template: ${metadata.id}`);
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(id: string): any | null {
    const entry = this.registry.get(id);
    if (!entry) {
      console.warn(`[worldRegistry] Template not found: ${id}`);
      return null;
    }
    return entry.template;
  }

  /**
   * Get metadata for a specific template
   */
  getMetadata(id: string): WorldTemplateMetadata | null {
    const entry = this.registry.get(id);
    if (!entry) {
      return null;
    }
    return entry.metadata;
  }

  /**
   * List all registered templates with their metadata
   */
  listTemplates(): WorldTemplateMetadata[] {
    return Array.from(this.registry.values()).map(entry => entry.metadata);
  }

  /**
   * Get the default template ID
   */
  getDefaultTemplateId(): string {
    return this.defaultTemplateId;
  }

  /**
   * Set the default template ID (used by controller initialization)
   */
  setDefaultTemplateId(id: string): void {
    if (!this.registry.has(id)) {
      console.error(`[worldRegistry] Cannot set default: template not found: ${id}`);
      return;
    }
    this.defaultTemplateId = id;
    console.log(`[worldRegistry] Default template changed to: ${id}`);
  }

  /**
   * Get the currently active default template
   */
  getDefaultTemplate(): any | null {
    return this.getTemplate(this.defaultTemplateId);
  }

  /**
   * Resolve template ID from various sources:
   * 1. Explicit ID parameter
   * 2. Environment variable override (deprecated)
   * 3. Registry default (demo-fantasy-world)
   */
  resolveTemplateId(explicitId?: string): string {
    // Explicit parameter takes precedence
    if (explicitId && this.registry.has(explicitId)) {
      return explicitId;
    }

    // Deprecation: Check env var for backward compatibility
    if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_USE_DEMO_WORLD === 'false') {
      // Explicitly set to use Luxfier
      if (this.registry.has('luxfier-v1')) {
        console.warn('[worldRegistry] Using deprecated NEXT_PUBLIC_USE_DEMO_WORLD env var — prefer registry.resolveTemplateId()');
        return 'luxfier-v1';
      }
    }

    // Default to demo-fantasy
    return this.defaultTemplateId;
  }
}

// Singleton instance
let registryInstance: WorldRegistry | null = null;

/**
 * Get or create the global registry instance
 */
export function getWorldRegistry(): WorldRegistry {
  if (!registryInstance) {
    registryInstance = new WorldRegistry();
  }
  return registryInstance;
}

/**
 * For testing: reset the registry to a clean state
 */
export function resetWorldRegistry(): void {
  registryInstance = new WorldRegistry();
}
