import { useState, useEffect } from 'react';
import type { CoreAttributes } from '../../types/attributes';

/**
 * Character Creation Draft
 * Represents all state for an in-progress character creation
 */
export interface CreationDraft {
  // Step 1: World Context
  worldTemplateId?: string;

  // Step 2: Identity
  characterName: string;
  gender?: string;
  backstorySnippet?: string;

  // Step 3: Ancestry (Race)
  selectedRace?: string;
  racialBaseStats?: CoreAttributes;  // Track racial baseline to prevent reducing below it

  // Step 4: Stats (The Grid)
  baseStats: CoreAttributes;

  // Step 5: Talents & Skills
  selectedTalents: string[];

  // Step 6: Origin & Finalize (3-Phase Sub-flow)
  archetype?: string;
  originStory?: string;
  startingLocationId?: string;
  startingGearId?: string;
  flavorItemId?: string;
  preparationPhase?: 'location' | 'gear' | 'curio' | 'complete'; // Track which sub-phase we're in

  // Metadata
  createdAt: number;
  lastUpdatedAt: number;
  currentStep?: number;
}

/**
 * Generate empty draft
 * Base stats start at 8 (64 total), with 12-point essence pool for allocation
 * This creates a "Starter" experience (76 total) with forced specialization trade-offs
 */
function generateEmptyDraft(): CreationDraft {
  return {
    characterName: '',
    selectedTalents: [],
    baseStats: {
      STR: 8,
      DEX: 8,
      AGI: 8,
      CON: 8,
      INT: 8,
      WIS: 8,
      CHA: 8,
      PER: 8,
    },
    racialBaseStats: {
      STR: 8,
      DEX: 8,
      AGI: 8,
      CON: 8,
      INT: 8,
      WIS: 8,
      CHA: 8,
      PER: 8,
    },
    createdAt: Date.now(),
    lastUpdatedAt: Date.now(),
    currentStep: 0,
  };
}

const STORAGE_KEY = 'isekai_character_creation_draft';

/**
 * Hook for persistent character creation state management
 * Automatically saves and loads character creation progress from localStorage
 *
 * Usage:
 * const { draft, updateDraft, advanceStep, regressStep, clearDraft } = usePersistentCreation();
 */
export function usePersistentCreation() {
  const [draft, setDraft] = useState<CreationDraft>(generateEmptyDraft());
  const [isLoading, setIsLoading] = useState(true);

  // Load draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as CreationDraft;
        setDraft(parsed);
      }
    } catch (error) {
      console.error('Failed to load character creation draft:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-save draft to localStorage whenever it changes
  useEffect(() => {
    if (!isLoading) {
      try {
        const updatedDraft = { ...draft, lastUpdatedAt: Date.now() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedDraft));
      } catch (error) {
        console.error('Failed to save character creation draft:', error);
      }
    }
  }, [draft, isLoading]);

  /**
   * Update any field in the draft
   */
  const updateDraft = (updates: Partial<CreationDraft>) => {
    setDraft(prev => ({
      ...prev,
      ...updates,
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Update stats specifically
   */
  const updateStats = (stats: CoreAttributes) => {
    setDraft(prev => ({
      ...prev,
      baseStats: stats,
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Add talent to selection
   */
  const addTalent = (talentId: string) => {
    setDraft(prev => ({
      ...prev,
      selectedTalents: [...prev.selectedTalents, talentId],
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Remove talent from selection
   */
  const removeTalent = (talentId: string) => {
    setDraft(prev => ({
      ...prev,
      selectedTalents: prev.selectedTalents.filter(id => id !== talentId),
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Advance to next step
   */
  const advanceStep = () => {
    setDraft(prev => ({
      ...prev,
      currentStep: (prev.currentStep || 0) + 1,
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Go back to previous step
   */
  const regressStep = () => {
    setDraft(prev => ({
      ...prev,
      currentStep: Math.max(0, (prev.currentStep || 0) - 1),
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Go to specific step
   */
  const goToStep = (stepNumber: number) => {
    setDraft(prev => ({
      ...prev,
      currentStep: stepNumber,
      lastUpdatedAt: Date.now(),
    }));
  };

  /**
   * Clear draft (only call on successful character creation)
   */
  const clearDraft = () => {
    localStorage.removeItem(STORAGE_KEY);
    setDraft(generateEmptyDraft());
  };

  /**
   * Reset draft to empty state (for "Start Over" functionality)
   */
  const resetDraft = () => {
    setDraft(generateEmptyDraft());
  };

  /**
   * Check if draft is valid for advancing to next step
   */
  const isDraftValidForStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 0:
        // Step 1: World Context - always valid
        return true;
      case 1:
        // Step 2: Identity - requires name
        return draft.characterName.trim().length > 0;
      case 2:
        // Step 3: Ancestry - requires race selection
        return !!draft.selectedRace;
      case 3:
        // Step 4: Stats - validate stat allocation
        const coreStats =
          draft.baseStats.STR +
          draft.baseStats.DEX +
          draft.baseStats.AGI +
          draft.baseStats.CON +
          draft.baseStats.INT +
          draft.baseStats.WIS +
          draft.baseStats.CHA +
          draft.baseStats.PER;
        return coreStats === 76; // 8 * 8 base (64) + 12 points allocated
      case 4:
        // Step 5: Talents - no strict requirement, at least 0 talents is valid
        return true;
      case 5:
        // Step 6: Origin & Finalize - requires all 3 preparation phases
        return !!draft.startingLocationId && !!draft.startingGearId && !!draft.flavorItemId;
      default:
        return false;
    }
  };

  /**
   * Get all required fields for current draft
   */
  const getMissingRequiredFields = (): string[] => {
    const missing: string[] = [];

    if (!draft.characterName.trim()) missing.push('Character Name');
    if (!draft.selectedRace) missing.push('Race');
    // archetype is auto-derived at finalize, not required from user input
    if (!draft.startingLocationId) missing.push('Starting Location');
    if (!draft.startingGearId) missing.push('Starting Gear');
    if (!draft.flavorItemId) missing.push('Curio / Fate');

    // Check stat allocation
    const coreStats =
      draft.baseStats.STR +
      draft.baseStats.DEX +
      draft.baseStats.AGI +
      draft.baseStats.CON +
      draft.baseStats.INT +
      draft.baseStats.WIS +
      draft.baseStats.CHA +
      draft.baseStats.PER;
    if (coreStats !== 76) {
      missing.push('Valid Stat Allocation');
    }

    return missing;
  };

  return {
    draft,
    isLoading,
    updateDraft,
    updateStats,
    addTalent,
    removeTalent,
    advanceStep,
    regressStep,
    goToStep,
    clearDraft,
    resetDraft,
    isDraftValidForStep,
    getMissingRequiredFields,
  };
}
