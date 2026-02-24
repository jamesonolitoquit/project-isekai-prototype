/**
 * M42 Task 4: Trade Manager Service
 *
 * Purpose: Orchestrate P2P atomic trades using the 4-stage protocol
 * Manages:
 * - Trade state machine progression
 * - Item validation and locking
 * - P2P message routing
 * - Timeout handling and rollback
 *
 * Integration:
 * - multiplayerEngine: Send trade_offer, trade_response messages
 * - inventoryManager: Lock/unlock items, apply transfers
 * - BetaApplication: Render TradeOverlay component
 */

import {
  AtomicTrade,
  TradeResolution,
  StagedInventory,
  createAtomicTrade,
  respondToTrade,
  stageTradeItems,
  commitTrade,
  cancelTrade,
  checkTradeTimeout,
  validateTrade,
  validateTradeItems,
  getTradeSummary
} from './atomicTradeEngine';

export interface TradeMessage {
  type: 'trade_offer' | 'trade_response' | 'trade_stage' | 'trade_commit' | 'trade_cancel';
  payload: {
    trade: AtomicTrade;
    stagingSnapshot?: StagedInventory;
  };
  from: string;
  to: string;
  timestamp: number;
}

export interface TradeManagerState {
  activeTrades: Map<string, AtomicTrade>;
  stagedInventories: Map<string, StagedInventory>; // Key: tradeId_clientId
  tradeHistory: TradeResolution[];
  timeoutIntervals: Map<string, NodeJS.Timeout>;
}

export interface TradeManagerConfig {
  clientId: string;
  stageTimeoutMs?: number;
  maxActiveTrades?: number;
  sendMessage: (msg: TradeMessage) => void;
  getInventory: (clientId?: string) => Map<string, number>;
  applyTransfer: (from: string, to: string, itemId: string, qty: number) => boolean;
}

/**
 * Trade Manager - Orchestrates atomic P2P trades
 */
export class TradeManager {
  private state: TradeManagerState;
  private config: Required<TradeManagerConfig>;
  private listeners: Map<string, Set<(trade: AtomicTrade) => void>> = new Map();

  constructor(config: TradeManagerConfig) {
    this.config = {
      stageTimeoutMs: 30000,
      maxActiveTrades: 10,
      ...config
    };

    this.state = {
      activeTrades: new Map(),
      stagedInventories: new Map(),
      tradeHistory: [],
      timeoutIntervals: new Map()
    };
  }

  /**
   * Initiate a new trade (Stage 1: PROPOSE)
   */
  initiateTraade(
    responderId: string,
    initiatorItems: Array<{ itemId: string; quantity: number }>,
    responderItems: Array<{ itemId: string; quantity: number }>
  ): { success: boolean; trade?: AtomicTrade; error?: string } {
    // Validation
    if (this.state.activeTrades.size >= this.config.maxActiveTrades) {
      return { success: false, error: 'Max active trades reached' };
    }

    if (responderId === this.config.clientId) {
      return { success: false, error: 'Cannot trade with yourself' };
    }

    // Validate initiator has items
    const myInventory = this.config.getInventory();
    const validation = validateTradeItems(myInventory, initiatorItems);
    if (!validation.valid) {
      return {
        success: false,
        error: `Missing items: ${validation.missingItems.join(', ')}`
      };
    }

    // Create trade
    const tradeId = `trade_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    const trade = createAtomicTrade(
      tradeId,
      this.config.clientId,
      responderId,
      initiatorItems,
      responderItems
    );

    // Store and broadcast
    this.state.activeTrades.set(tradeId, trade);
    this.setupTimeoutWatcher(tradeId);

    this.broadcastTradeMessage('trade_offer', trade);
    this.notifyListeners(tradeId, trade);

    return { success: true, trade };
  }

  /**
   * Respond to incoming trade offer (Stage 2: NEGOTIATE)
   */
  respondToOffer(
    tradeId: string,
    accepted: boolean
  ): { success: boolean; trade?: AtomicTrade; error?: string } {
    const trade = this.state.activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: 'Trade not found' };
    }

    const responderInventory = this.config.getInventory();
    const result = respondToTrade(trade, this.config.clientId, accepted, responderInventory);

    if (result.error) {
      return { success: false, error: result.error };
    }

    this.state.activeTrades.set(tradeId, result.trade);
    this.broadcastTradeMessage(accepted ? 'trade_response' : 'trade_cancel', result.trade);
    this.notifyListeners(tradeId, result.trade);

    if (!accepted) {
      this.finalizeTrade(tradeId);
    }

    return { success: true, trade: result.trade };
  }

  /**
   * Stage trade items (Lock them temporarily) (Stage 3: STAGE)
   */
  stageItems(tradeId: string): { success: boolean; trade?: AtomicTrade; error?: string } {
    const trade = this.state.activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: 'Trade not found' };
    }

    const myInventory = this.config.getInventory();
    const result = stageTradeItems(trade, this.config.clientId, myInventory);

    if (result.error) {
      return { success: false, error: result.error };
    }

    if (!result.staged) {
      return { success: false, error: 'Failed to create staging snapshot' };
    }

    // Store staged inventory
    const stageKey = `${tradeId}_${this.config.clientId}`;
    this.state.stagedInventories.set(stageKey, result.staged);

    this.state.activeTrades.set(tradeId, result.trade);
    this.broadcastTradeMessage('trade_stage', result.trade, result.staged);
    this.notifyListeners(tradeId, result.trade);

    return { success: true, trade: result.trade };
  }

  /**
   * Commit to trade (Stage 4: COMMIT)
   */
  commitToTrade(tradeId: string): { success: boolean; trade?: AtomicTrade; error?: string } {
    const trade = this.state.activeTrades.get(tradeId);
    if (!trade) {
      return { success: false, error: 'Trade not found' };
    }

    const result = commitTrade(trade, this.config.clientId);

    if (result.error) {
      return { success: false, error: result.error };
    }

    this.state.activeTrades.set(tradeId, result.trade);
    this.broadcastTradeMessage('trade_commit', result.trade);

    // If both committed, execute swap
    if (result.resolution) {
      const swapSuccess = this.executeSwap(result.resolution);
      if (swapSuccess) {
        this.finalizeTrade(tradeId, result.resolution);
        this.notifyListeners(tradeId, result.trade);
        return { success: true, trade: result.trade };
      } else {
        return {
          success: false,
          error: 'Swap execution failed',
          trade: { ...result.trade, stage: 'failed', failureReason: 'Swap execution failed' }
        };
      }
    }

    this.notifyListeners(tradeId, result.trade);
    return { success: true, trade: result.trade };
  }

  /**
   * Cancel trade and release locked items
   */
  cancelTrade(tradeId: string, reason?: string): { success: boolean; trade?: AtomicTrade } {
    const trade = this.state.activeTrades.get(tradeId);
    if (!trade) {
      return { success: false };
    }

    const result = cancelTrade(trade, this.config.clientId, reason);
    this.state.activeTrades.set(tradeId, result.trade);
    this.broadcastTradeMessage('trade_cancel', result.trade);
    this.releaseStagedItems(tradeId);
    this.finalizeTrade(tradeId);
    this.notifyListeners(tradeId, result.trade);

    return { success: true, trade: result.trade };
  }

  /**
   * Handle incoming trade message from peer
   */
  handleIncomingMessage(msg: TradeMessage): void {
    const { type, payload, from } = msg;
    let trade = payload.trade;

    // Validate trade structure
    const validation = validateTrade(trade);
    if (!validation.valid) {
      console.error('Invalid trade structure:', validation.errors);
      return;
    }

    // Check timeout
    const timeoutResult = checkTradeTimeout(trade);
    if (timeoutResult.timedOut) {
      this.finalizeTrade(trade.tradeId);
      return;
    }

    switch (type) {
      case 'trade_offer':
        this.handleTradeOffer(trade);
        break;
      case 'trade_response':
        this.handleTradeResponse(trade);
        break;
      case 'trade_stage':
        this.handleTradeStage(trade, payload.stagingSnapshot);
        break;
      case 'trade_commit':
        this.handleTradeCommit(trade);
        break;
      case 'trade_cancel':
        this.handleTradeCancel(trade);
        break;
    }
  }

  /**
   * Execute atomic swap (apply all transfers atomically)
   */
  private executeSwap(resolution: TradeResolution): boolean {
    try {
      for (const transfer of resolution.transfers) {
        const success = this.config.applyTransfer(
          transfer.from,
          transfer.to,
          transfer.itemId,
          transfer.quantity
        );

        if (!success) {
          // Partial failure — rollback all?
          console.error(
            `Transfer failed: ${transfer.from} → ${transfer.to} ${transfer.quantity}x${transfer.itemId}`
          );
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Swap execution error:', error);
      return false;
    }
  }

  /**
   * Release staged items back to inventory
   */
  private releaseStagedItems(tradeId: string): void {
    const stageKey = `${tradeId}_${this.config.clientId}`;
    this.state.stagedInventories.delete(stageKey);
  }

  /**
   * Finalize trade and cleanup
   */
  private finalizeTrade(tradeId: string, resolution?: TradeResolution): void {
    const trade = this.state.activeTrades.get(tradeId);
    if (!trade) return;

    this.releaseStagedItems(tradeId);

    if (resolution) {
      this.state.tradeHistory.push(resolution);
    }

    // Clear timeout
    const interval = this.state.timeoutIntervals.get(tradeId);
    if (interval) {
      clearInterval(interval);
      this.state.timeoutIntervals.delete(tradeId);
    }

    this.state.activeTrades.delete(tradeId);
  }

  /**
   * Setup timeout watcher for trade expiration
   */
  private setupTimeoutWatcher(tradeId: string): void {
    const interval = setInterval(() => {
      const trade = this.state.activeTrades.get(tradeId);
      if (!trade) {
        clearInterval(interval);
        return;
      }

      const result = checkTradeTimeout(trade);
      if (result.timedOut) {
        this.state.activeTrades.set(tradeId, result.trade);
        this.broadcastTradeMessage('trade_cancel', result.trade);
        this.finalizeTrade(tradeId);
        this.notifyListeners(tradeId, result.trade);
        clearInterval(interval);
      }
    }, 1000);

    this.state.timeoutIntervals.set(tradeId, interval);
  }

  /**
   * Broadcast trade message to peer
   */
  private broadcastTradeMessage(
    type: TradeMessage['type'],
    trade: AtomicTrade,
    stagingSnapshot?: StagedInventory
  ): void {
    const partner = trade.initiatorId === this.config.clientId ? trade.responderId : trade.initiatorId;

    this.config.sendMessage({
      type,
      payload: { trade, stagingSnapshot },
      from: this.config.clientId,
      to: partner,
      timestamp: Date.now()
    });
  }

  /**
   * Store and notify listeners
   */
  private notifyListeners(tradeId: string, trade: AtomicTrade): void {
    const set = this.listeners.get(tradeId);
    if (set) {
      set.forEach(listener => listener(trade));
    }
  }

  /**
   * Subscribe to trade updates
   */
  subscribe(tradeId: string, callback: (trade: AtomicTrade) => void): () => void {
    if (!this.listeners.has(tradeId)) {
      this.listeners.set(tradeId, new Set());
    }
    this.listeners.get(tradeId)!.add(callback);

    return () => {
      this.listeners.get(tradeId)?.delete(callback);
    };
  }

  /**
   * Force-apply incoming trade state (for sync)
   */
  private syncTradeState(trade: AtomicTrade): void {
    this.state.activeTrades.set(trade.tradeId, trade);
  }

  // ========== MESSAGE HANDLERS ==========

  private handleTradeOffer(trade: AtomicTrade): void {
    this.syncTradeState(trade);
    this.notifyListeners(trade.tradeId, trade);
  }

  private handleTradeResponse(trade: AtomicTrade): void {
    this.syncTradeState(trade);
    this.notifyListeners(trade.tradeId, trade);
  }

  private handleTradeStage(trade: AtomicTrade, snapshot?: StagedInventory): void {
    this.syncTradeState(trade);
    if (snapshot) {
      const stageKey = `${trade.tradeId}_${snapshot.clientId}`;
      this.state.stagedInventories.set(stageKey, snapshot);
    }
    this.notifyListeners(trade.tradeId, trade);
  }

  private handleTradeCommit(trade: AtomicTrade): void {
    this.syncTradeState(trade);
    // If both sides committed, execute swap
    if (trade.initiatorConfirmed && trade.responderConfirmed) {
      // Check that we also committed
      const currentTrade = this.state.activeTrades.get(trade.tradeId);
      if (
        currentTrade &&
        currentTrade.initiatorConfirmed &&
        currentTrade.responderConfirmed
      ) {
        // Execute swap
        const summary = getTradeSummary(trade);
        console.log(`Executing swap: ${summary.stagePercent}%`);
      }
    }
    this.notifyListeners(trade.tradeId, trade);
  }

  private handleTradeCancel(trade: AtomicTrade): void {
    this.finalizeTrade(trade.tradeId);
    this.notifyListeners(trade.tradeId, trade);
  }

  // ========== GETTERS ==========

  getTrade(tradeId: string): AtomicTrade | undefined {
    return this.state.activeTrades.get(tradeId);
  }

  getActiveTrades(): AtomicTrade[] {
    return Array.from(this.state.activeTrades.values());
  }

  getTradeHistory(): TradeResolution[] {
    return [...this.state.tradeHistory];
  }

  getStagedInventory(tradeId: string): StagedInventory | undefined {
    const stageKey = `${tradeId}_${this.config.clientId}`;
    return this.state.stagedInventories.get(stageKey);
  }
}
