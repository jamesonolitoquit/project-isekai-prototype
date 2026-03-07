/**
 * Phase 7: UI Convergence - Entry Point Unification
 * Phase 30 UI: Digital Board Game Integration & World Selection
 * Delegates all game UI rendering to BetaApplication shell
 * Handles: Template selection, World initialization, Controller setup, State subscription
 */
import React, { useState, useEffect } from 'react';
import type { WorldState } from '../engine/worldEngine';
import type { WorldController } from '../types/engines';
import { createWorldController, getAvailableTemplates } from '../engine/worldEngine';
import BetaApplication from '../client/components/BetaApplication';
import WorldSelectorOverlay from '../client/components/WorldSelectorOverlay';
import { ClientOnly } from '../client/components/ClientOnly';

export default function HomePage() {
  const [controller, setController] = useState<WorldController | null>(null);
  const [state, setState] = useState<WorldState | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Phase 30: Template selection state — blocks engine start until template selected
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(undefined);
  const [isStarting, setIsStarting] = useState<boolean>(false);

  // Handle template selection from overlay
  const handleSelectTemplate = (templateId: string) => {
    console.log(`[HomePage] Template selected: ${templateId}`);
    setSelectedTemplateId(templateId);
    setIsStarting(true);
  };

  // Initialize world controller only after template selection
  useEffect(() => {
    // Skip if template not selected yet
    if (!isStarting || selectedTemplateId === undefined) {
      return;
    }

    try {
      const isDev = process.env.NODE_ENV === 'development' || 
        (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('dev') === '1');
      
      // Phase 30: Create controller with selected template
      const c = createWorldController(undefined, isDev, selectedTemplateId) as WorldController;
      
      // Log available templates for diagnostics (dev only)
      if (isDev) {
        const templates = getAvailableTemplates();
        console.log('[HomePage] Available templates:', templates.map(t => t.id));
        console.log(`[HomePage] Using template: ${selectedTemplateId}`);
      }
      
      setController(c);

      // Subscribe to state updates
      const ctrl = c as any; // Phase 7: Runtime method checking
      if (ctrl.subscribe) {
        const unsubscribe = ctrl.subscribe((newState: WorldState) => {
          setState(newState);
          setError(null);
        });

        // Get initial state
        if (ctrl.getState) {
          const initialState = ctrl.getState();
          if (initialState) {
            setState(initialState);
          }
        }

        // Start controller
        if (ctrl.start) {
          ctrl.start();
        }

        // Cleanup on unmount
        return () => {
          try {
            unsubscribe();
            ctrl.stop?.();
          } catch (e) {
            console.warn('Error during cleanup:', e);
          }
        };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to initialize world: ${message}`);
      console.error('World initialization error:', err);
    }
  }, [isStarting, selectedTemplateId]);

  if (error) {
    return (
      <ClientOnly>
        <div style={{ padding: '20px', color: '#f87171', fontFamily: 'monospace' }}>
          <h2>⚠️ Initialization Error</h2>
          <pre style={{ background: '#1f2937', padding: '10px', borderRadius: '4px', overflow: 'auto' }}>
            {error}
          </pre>
        </div>
      </ClientOnly>
    );
  }

  // Phase 30: Show template selector until selection made
  if (!isStarting) {
    const templates = getAvailableTemplates();
    return (
      <ClientOnly>
        <div style={{
          width: '100vw',
          height: '100vh',
          background: '#0f172a',
          overflow: 'hidden'
        }}>
          <WorldSelectorOverlay
            templates={templates}
            onSelectTemplate={handleSelectTemplate}
            isOpen={true}
          />
        </div>
      </ClientOnly>
    );
  }

  return (
    <ClientOnly>
      {state && controller ? (
        <BetaApplication 
          initialState={state} 
          controller={controller}
        />
      ) : (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh',
          background: '#0f172a',
          color: '#e2e8f0',
          fontFamily: 'monospace'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '10px' }}>⚙️</div>
            <div>Initializing world...</div>
          </div>
        </div>
      )}
    </ClientOnly>
  );
}

export const dynamic = 'force-dynamic';