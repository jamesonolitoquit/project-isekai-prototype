/**
 * Template Panel (ALPHA_M6: The Architect's Forge)
 * Entry point for template management
 * - Browse saved templates
 * - Launch template designer
 * - Manage template library
 */

'use client';

import React, { useState, useEffect } from 'react';
// import { templateStorageManager } from '../../engine/templateStorage';

// Temporary implementation
const templateStorageManager = {
  listTemplates: () => [],
  getTemplate: (id: string) => null,
  saveTemplate: (template: any) => {},
  deleteTemplate: (id: string) => {},
  getAllTemplateIds: () => [],
  loadTemplate: (id: string) => null,
  getStorageStats: () => ({ totalTemplates: 0, totalSizeBytes: 0 }),
};
import type { UserTemplate } from '../../engine/templateEditor';

interface TemplatePanelProps {
  readonly onLoad?: (template: UserTemplate) => void;
  readonly onDesignerOpen?: () => void;
}

export default function TemplatePanel({ onLoad, onDesignerOpen }: TemplatePanelProps) {
  const [templates, setTemplates] = useState<UserTemplate[]>([]);
  const [stats, setStats] = useState({ total: 0, size: 0 });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = () => {
    const allIds = templateStorageManager.getAllTemplateIds();
    const loaded = allIds
      .map(id => templateStorageManager.loadTemplate(id))
      .filter((t): t is UserTemplate => t !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    
    setTemplates(loaded);

    const stats = templateStorageManager.getStorageStats();
    setStats({ total: stats.totalTemplates, size: stats.totalSizeBytes });
  };

  const handleDelete = (templateId: string) => {
    if (confirm('Delete this template?')) {
      templateStorageManager.deleteTemplate(templateId);
      loadTemplates();
    }
  };

  const handleLoad = (template: UserTemplate) => {
    onLoad?.(template);
  };

  return (
    <div style={styles.panel}>
      <h2>The Architect's Forge</h2>
      <p style={styles.subtitle}>Manage your custom world templates</p>

      <div style={styles.statsBar}>
        <span>📚 Saved: {stats.total}</span>
        <span>💾 Size: {(stats.size / 1024).toFixed(1)}KB</span>
      </div>

      <button onClick={onDesignerOpen} style={styles.createButton}>
        ✨ Create New Template
      </button>

      {templates.length === 0 ? (
        <div style={styles.emptyState}>
          <p>No templates yet. Create one to get started!</p>
        </div>
      ) : (
        <div style={styles.templateList}>
          {templates.map(template => (
            <div key={template.id} style={styles.templateCard}>
              <div style={styles.templateInfo}>
                <h3>{template.name}</h3>
                <p>{template.description}</p>
                <small>
                  v{template.version} • {new Date(template.updatedAt).toLocaleDateString()}
                </small>
              </div>
              <div style={styles.templateActions}>
                <button onClick={() => handleLoad(template)} style={styles.loadButton}>
                  Load
                </button>
                <button onClick={() => handleDelete(template.id)} style={styles.deleteButton}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    padding: '2rem',
    background: '#f5f5f5',
    borderRadius: '12px',
    marginBottom: '2rem'
  },
  subtitle: {
    margin: '0.5rem 0 1.5rem',
    color: '#666'
  },
  statsBar: {
    display: 'flex' as const,
    gap: '2rem',
    padding: '1rem',
    background: 'white',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.9rem'
  },
  createButton: {
    width: '100%',
    padding: '0.75rem',
    background: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 600,
    marginBottom: '1.5rem'
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: '2rem',
    color: '#999'
  },
  templateList: {
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '1rem'
  },
  templateCard: {
    display: 'flex' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center',
    padding: '1rem',
    background: 'white',
    borderRadius: '8px',
    borderLeft: '4px solid #3498db'
  },
  templateInfo: {
    flex: 1
  },
  templateActions: {
    display: 'flex' as const,
    gap: '0.5rem'
  },
  loadButton: {
    padding: '0.5rem 1rem',
    background: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  },
  deleteButton: {
    padding: '0.5rem 1rem',
    background: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem'
  }
};

