/**
 * Phase 38/39: usePlayerHand Hook
 * 
 * Manages player's card hand state with authoritative engine state binding.
 * 
 * Phase 39 Changes:
 * - Bind hand/deck/discard to worldEngine.player state (authoritative source)
 * - Read AP from engine and enforce AP costs
 * - Dispatch PLAY_CARD actions to engine instead of local mutations
 * - Keep UI state (selected card, animation) locally
 * 
 * Hand Lifecycle:
 * 1. Engine initialization: Player starts with seeded hand/deck in CHARACTER_CREATED
 * 2. Draw phase: ActionPipeline DRAW_CARD action moves cards from deck to hand
 * 3. Play phase: Player selects card, dispatches PLAY_CARD action
 * 4. Resolve phase: Engine resolves ability, moves card to discard, recovers AP
 * 5. Reshuffle: When deck empty, engine shuffles discard back to deck
 */

import { useEffect, useState, useCallback, useContext } from 'react';
import type { NarrativeCard } from '../../engine/narrativeCardRegistry';
import { createNarrativeCard } from '../../engine/narrativeCardRegistry';
import { ABILITY_DATABASE } from '../../engine/abilityResolver';

/**
 * Phase 39: World engine context or dependency injection
 * This would be provided by a GameProvider or similar context
 * For now, we'll accept it as a parameter to support both standalone and integrated usage
 */
export interface PlayerHandContextDeps {
  worldState?: any; // WorldState object from engine
  dispatchAction?: (action: { type: string; payload: any }) => void; // Dispatch function
  activeCodec?: string; // Current narrative codec
}

export interface PlayerHand {
  // Authoritative state from engine (Phase 39)
  currentHand: NarrativeCard[]; // Cards in hand (5-7 typically)
  handAbilityIds: string[]; // Raw ability IDs from engine
  deckRemaining: number; // Cards left in deck
  discardCount: number; // Size of discard pile
  ap: number; // Current action points
  maxAp: number; // Max AP per turn
  
  // UI state (local only)
  selectedCardIndex: number | null;
  isPlayingCard: boolean;
  lastPlayedCard: NarrativeCard | null;
  
  // Visual theme
  activeCodec: string;
}

export interface UsePlayerHandReturn {
  hand: PlayerHand;
  drawCards: (count: number) => void;
  playCard: (cardIndex: number) => Promise<void>;
  discardCard: (cardIndex: number) => void;
  selectCard: (cardIndex: number | null) => void;
  canPlayCard: (cardIndex: number) => { canPlay: boolean; reason?: string };
  reshuffleDiscardIntoDeck: () => void;
  setCodec: (codec: string) => void;
}

/**
 * Phase 39: Main hook - integrates with worldEngine state
 * @param deps Optional: WorldState, dispatch function, and codec for engine integration
 */
export function usePlayerHand(deps?: PlayerHandContextDeps): UsePlayerHandReturn {
  // UI-local state
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [isPlayingCard, setIsPlayingCard] = useState(false);
  const [lastPlayedCard, setLastPlayedCard] = useState<NarrativeCard | null>(null);
  const [activeCodec, setActiveCodec] = useState(deps?.activeCodec ?? 'medieval');

  // Phase 39: Read authoritative state from engine
  const worldState = deps?.worldState;
  const dispatchAction = deps?.dispatchAction;
  
  // Extract hand data from engine (or use fallback for standalone mode)
  // Stage 8.95: Include Attack and Interact base cards always available
  const baseCards = ['attack', 'interact', 'search']; // Always available actions
  const handAbilityIds = worldState?.player?.hand ?? (
    selectedCardIndex === null ? [...baseCards, 'fireball', 'frost-nova'] : []
  );
  const deckAbilityIds = worldState?.player?.deck ?? [];
  const discardAbilityIds = worldState?.player?.discard ?? [];
  const playerAp = worldState?.player?.ap ?? 3;
  const playerMaxAp = worldState?.player?.maxAp ?? 3;

  // Convert ability IDs to NarrativeCard objects for UI rendering
  const currentHand: NarrativeCard[] = handAbilityIds
    .map(abilityId => createNarrativeCard(abilityId, activeCodec))
    .filter((card): card is NarrativeCard => card !== null);

  /**
   * Phase 39: Check if a card can be played (AP + Mana validation)
   */
  const canPlayCard = useCallback((cardIndex: number): { canPlay: boolean; reason?: string } => {
    if (cardIndex < 0 || cardIndex >= currentHand.length) {
      return { canPlay: false, reason: 'Invalid card index' };
    }

    const card = currentHand[cardIndex];
    if (!card) {
      return { canPlay: false, reason: 'Card not found' };
    }

    const ability = ABILITY_DATABASE[card.abilityId];
    if (!ability) {
      return { canPlay: false, reason: 'Ability not found in registry' };
    }

    // Check AP cost first (primary resource)
    const apCost = ability.apCost ?? 1;
    if (playerAp < apCost) {
      return { canPlay: false, reason: `Not enough AP (${playerAp}/${apCost})` };
    }

    // Check Mana cost (secondary resource)
    const playerMp = worldState?.player?.mp ?? 100;
    if (playerMp < ability.manaCost) {
      return { canPlay: false, reason: `Not enough Mana (${playerMp}/${ability.manaCost})` };
    }

    return { canPlay: true };
  }, [currentHand, playerAp, worldState?.player?.mp]);

  /**
   * Phase 39: Play a card from hand by dispatching PLAY_CARD action to engine
   * Stage 8.98a: Now includes narrativeWeight and isCustom fields
   * Integrates with turn-based heartbeat (Phase 37) and AP economy
   */
  const playCard = useCallback(async (cardIndex: number, customPrompt?: string) => {
    const card = currentHand[cardIndex];
    if (!card) {
      console.warn(`[usePlayerHand] Card not found at index ${cardIndex}`);
      return;
    }

    const playCheck = canPlayCard(cardIndex);
    if (!playCheck.canPlay) {
      console.warn(`[usePlayerHand] Cannot play card: ${playCheck.reason}`);
      // Optional: Shake animation or visual feedback
      return;
    }

    try {
      setIsPlayingCard(true);

      // Phase 39: Dispatch PLAY_CARD action to worldEngine
      // Stage 8.98a: Include customPrompt and isCustom for intent synthesis
      if (dispatchAction) {
        console.log(`[usePlayerHand] Playing card "${card.cardTitle}" (ability: ${card.abilityId})`);
        
        dispatchAction({
          type: 'PLAY_CARD',
          payload: {
            abilityId: card.abilityId,
            cardIndex,
            targetId: undefined, // Phase 40: Target selection UI
            // Stage 8.98a: Player Intent fields
            customPrompt: customPrompt, // Optional override text
            narrativeWeight: 1.0, // Standard card has weight 1.0 (default)
            isCustom: !!customPrompt, // True if player provided custom text
          }
        });

        // Update UI state after dispatch
        setLastPlayedCard(card);
        setSelectedCardIndex(null);
        
        // Simulate brief play animation
        await new Promise(resolve => setTimeout(resolve, 300));
      } else {
        // Fallback: Demo mode without engine (Phase 38 behavior)
        console.log(`[usePlayerHand] Demo mode: played ${card.cardTitle}`);
        setLastPlayedCard(card);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (err) {
      console.error('[usePlayerHand] Play card error:', err);
    } finally {
      setIsPlayingCard(false);
    }
  }, [currentHand, canPlayCard, dispatchAction]);

  /**
   * Discard a card from hand without playing it (for Phase 39 Mulligan system)
   */
  const discardCard = useCallback((cardIndex: number) => {
    if (cardIndex < 0 || cardIndex >= currentHand.length) return;

    // Phase 39: Dispatch DISCARD_CARD action
    if (dispatchAction) {
      dispatchAction({
        type: 'DISCARD_CARD',
        payload: { cardIndex }
      });
    }
    
    setSelectedCardIndex(null);
  }, [currentHand.length, dispatchAction]);

  /**
   * Select a card to preview details
   */
  const selectCard = useCallback((cardIndex: number | null) => {
    setSelectedCardIndex(cardIndex);
  }, []);

  /**
   * Draw cards from deck into hand
   * Phase 39: Dispatches to engine instead of local mutation
   */
  const drawCards = useCallback((count: number) => {
    if (dispatchAction) {
      dispatchAction({
        type: 'DRAW_CARD',
        payload: { count }
      });
    }
  }, [dispatchAction]);

  /**
   * Reshuffle discard pile back into deck
   * Phase 39: Handled by engine when deck runs empty
   */
  const reshuffleDiscardIntoDeck = useCallback(() => {
    if (dispatchAction) {
      dispatchAction({
        type: 'RESHUFFLE_DECK',
        payload: {}
      });
    }
  }, [dispatchAction]);

  /**
   * Change active codec (Medieval → Noir, etc.)
   * Updates all card appearances
   */
  const setCodec = useCallback((codec: string) => {
    setActiveCodec(codec);
  }, []);

  const hand: PlayerHand = {
    currentHand,
    handAbilityIds,
    deckRemaining: deckAbilityIds.length,
    discardCount: discardAbilityIds.length,
    ap: playerAp,
    maxAp: playerMaxAp,
    selectedCardIndex,
    isPlayingCard,
    lastPlayedCard,
    activeCodec
  };

  return {
    hand,
    drawCards,
    playCard,
    discardCard,
    selectCard,
    canPlayCard,
    reshuffleDiscardIntoDeck,
    setCodec
  };
}
