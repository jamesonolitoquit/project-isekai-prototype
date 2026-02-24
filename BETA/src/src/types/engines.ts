/**
 * Strict Engine Interfaces for Director Console and Dashboard
 * Replaces `: any` types with proper interface contracts
 */

/**
 * Telemetry/Trade Manager interface
 */
export interface TradeManager {
  getLatencyStats(): {
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  recordTrade(trade: any): void;
  getActiveTrades(): any[];
}

/**
 * Multiplayer Engine interface
 */
export interface MultiplayerEngine {
  getConsensusStatus(): {
    agreementPercentage: number;
    activePeers: number;
    consensusTick: number;
    lastSync: number;
  };
  syncPeerState(state: any): Promise<{ success: boolean; peerId: string }>;
  getPeerRegistry(): Array<{ peerId: string; state: string }>;
}

/**
 * Phantom Engine interface
 */
export interface PhantomEngine {
  getActivePhantoms(): Array<{ id: string; playerId: string; createdAt: number }>;
  getPhantomCount(): number;
  createPhantom(sourcePlayerId: string): string;
  resolvePhantom(phantomId: string): void;
}

/**
 * Transition Engine interface
 */
export interface TransitionEngine {
  startWorldTransition(reason: string, estimatedDuration?: number): void;
  finishWorldTransition(): void;
  subscribeToTransition(callback: (event: any) => void): () => void;
  getCurrentTransition(): any | null;
  cancelTransition(): void;
  isTransitioning(): boolean;
}

/**
 * Diagnostics Engine interface
 */
export interface DiagnosticsEngine {
  recordEvent(event: any): void;
  getHealthReport(): {
    status: 'healthy' | 'degraded' | 'critical';
    issues: string[];
  };
}

/**
 * World Controller interface
 */
export interface WorldController {
  performAction(action: {
    worldId: string;
    playerId: string;
    type: string;
    payload?: Record<string, any>;
  }): void;
  getState(): any;
  subscribeToState(callback: (state: any) =>  void): () => void;
}

/**
 * Director Command Engine context
 */
export interface DirectorCommandEngineContext {
  state: any;
  controller: WorldController;
  multiplayerEngine?: MultiplayerEngine;
  transitionEngine?: TransitionEngine;
  diagnosticsEngine?: DiagnosticsEngine;
  mutationLog?: any[];
  addNarrativeWhisper?: (message: string, priority: 'normal' | 'urgent' | 'critical', duration?: number) => string;
}

/**
 * Trade item interface
 */
export interface TradeItem {
  itemId: string;
  kind: 'unique' | 'stackable';
  quantity?: number;
  rarity: 'common' | 'rare' | 'legendary';
}

/**
 * Dice roll result interface
 */
export interface DiceRollResult {
  roll: number;
  modifiers: Array<{ source: string; value: number; icon?: string; description?: string }>;
  total: number;
  dc: number;
  passed: boolean;
  isCritical: boolean;
  isFumble: boolean;
  margin: number;
}
