/**
 * Template Storage Module (ALPHA_M6)
 * 
 * Manages persistence of user-created templates via localStorage
 * Features:
 * - Save/load UserTemplate objects
 * - Versioning and metadata tracking
 * - Local cache management
 * - Export/import for backup
 */

import type { UserTemplate, WorldTemplate } from './templateEditor';

const STORAGE_KEY_PREFIX = 'luxfier_template_';
const STORAGE_INDEX_KEY = 'luxfier_template_index';
const STORAGE_VERSION = 1;

export interface StorageStats {
  totalTemplates: number;
  totalSizeBytes: number;
  oldestTemplate?: { id: string; createdAt: number };
  newestTemplate?: { id: string; createdAt: number };
}

export class TemplateStorageManager {
  /**
   * Save a user template to localStorage
   */
  saveTemplate(template: UserTemplate): boolean {
    try {
      const key = `${STORAGE_KEY_PREFIX}${template.id}`;
      const data = {
        version: STORAGE_VERSION,
        timestamp: Date.now(),
        template: template
      };

      localStorage.setItem(key, JSON.stringify(data));
      this.updateIndex(template.id, true);
      return true;
    } catch (error) {
      console.warn('Failed to save template:', error);
      return false;
    }
  }

  /**
   * Load a template from localStorage
   */
  loadTemplate(templateId: string): UserTemplate | null {
    try {
      const key = `${STORAGE_KEY_PREFIX}${templateId}`;
      const item = localStorage.getItem(key);
      if (!item) return null;

      const data = JSON.parse(item);
      return data.template as UserTemplate;
    } catch (error) {
      console.warn(`Failed to load template ${templateId}:`, error);
      return null;
    }
  }

  /**
   * Load all templates for an author
   */
  loadAuthorTemplates(authorId: string): UserTemplate[] {
    try {
      const templates: UserTemplate[] = [];
      const index = this.getIndex();

      for (const templateId of index) {
        const template = this.loadTemplate(templateId);
        if (template && template.authorId === authorId) {
          templates.push(template);
        }
      }

      return templates.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (error) {
      console.warn('Failed to load author templates:', error);
      return [];
    }
  }

  /**
   * Delete a template from localStorage
   */
  deleteTemplate(templateId: string): boolean {
    try {
      const key = `${STORAGE_KEY_PREFIX}${templateId}`;
      localStorage.removeItem(key);
      this.updateIndex(templateId, false);
      return true;
    } catch (error) {
      console.warn('Failed to delete template:', error);
      return false;
    }
  }

  /**
   * Check if a template exists
   */
  templateExists(templateId: string): boolean {
    try {
      const key = `${STORAGE_KEY_PREFIX}${templateId}`;
      return localStorage.getItem(key) !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  getStorageStats(): StorageStats {
    try {
      const index = this.getIndex();
      let totalSizeBytes = 0;
      let oldestTemplate: { id: string; createdAt: number } | undefined;
      let newestTemplate: { id: string; createdAt: number } | undefined;

      for (const templateId of index) {
        const key = `${STORAGE_KEY_PREFIX}${templateId}`;
        const item = localStorage.getItem(key);
        if (item) {
          totalSizeBytes += item.length;
          const data = JSON.parse(item);
          const template = data.template as UserTemplate;

          if (!oldestTemplate || template.createdAt < oldestTemplate.createdAt) {
            oldestTemplate = { id: template.id, createdAt: template.createdAt };
          }
          if (!newestTemplate || template.createdAt > newestTemplate.createdAt) {
            newestTemplate = { id: template.id, createdAt: template.createdAt };
          }
        }
      }

      return {
        totalTemplates: index.length,
        totalSizeBytes,
        oldestTemplate,
        newestTemplate
      };
    } catch (error) {
      console.warn('Failed to get storage stats:', error);
      return { totalTemplates: 0, totalSizeBytes: 0 };
    }
  }

  /**
   * Clear all templates from storage
   */
  clearAllTemplates(): boolean {
    try {
      const index = this.getIndex();
      for (const templateId of index) {
        const key = `${STORAGE_KEY_PREFIX}${templateId}`;
        localStorage.removeItem(key);
      }
      localStorage.removeItem(STORAGE_INDEX_KEY);
      return true;
    } catch (error) {
      console.warn('Failed to clear storage:', error);
      return false;
    }
  }

  /**
   * Export templates as JSON for backup
   */
  exportTemplates(templateIds: string[]): string {
    try {
      const templates = templateIds
        .map(id => this.loadTemplate(id))
        .filter((t): t is UserTemplate => t !== null);

      const exportData = {
        version: STORAGE_VERSION,
        exportedAt: new Date().toISOString(),
        templates: templates
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.warn('Failed to export templates:', error);
      return '';
    }
  }

  /**
   * Import templates from JSON backup
   */
  importTemplates(jsonStr: string): { success: boolean; imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data.templates)) {
        errors.push('Invalid backup format: missing templates array');
        return { success: false, imported, errors };
      }

      for (const template of data.templates) {
        try {
          if (this.saveTemplate(template as UserTemplate)) {
            imported++;
          }
        } catch (e) {
          errors.push(`Failed to import template ${template.id}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }

      return {
        success: imported > 0,
        imported,
        errors
      };
    } catch (error) {
      errors.push(`Failed to parse backup: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
      return { success: false, imported, errors };
    }
  }

  /**
   * Get all template IDs
   */
  getAllTemplateIds(): string[] {
    try {
      return this.getIndex();
    } catch (error) {
      console.warn('Failed to get template IDs:', error);
      return [];
    }
  }

  /**
   * Update the index of template IDs
   */
  private updateIndex(templateId: string, add: boolean): void {
    try {
      let index = this.getIndex();

      if (add) {
        if (!index.includes(templateId)) {
          index.push(templateId);
        }
      } else {
        index = index.filter(id => id !== templateId);
      }

      localStorage.setItem(STORAGE_INDEX_KEY, JSON.stringify(index));
    } catch (error) {
      console.warn('Failed to update index:', error);
    }
  }

  /**
   * Get the index of all template IDs
   */
  private getIndex(): string[] {
    try {
      const index = localStorage.getItem(STORAGE_INDEX_KEY);
      return index ? JSON.parse(index) : [];
    } catch (error) {
      console.warn('Failed to read index:', error);
      return [];
    }
  }
}

// Export singleton instance
export const templateStorageManager = new TemplateStorageManager();
