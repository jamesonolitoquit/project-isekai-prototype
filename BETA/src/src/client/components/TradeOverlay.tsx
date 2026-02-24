/**
 * M42 Task 4b: Trade Overlay Component
 *
 * Purpose: Drag-drop UI for P2P trading with real-time state management
 * Features:
 * - Dual inventory panes (left=you, right=partner)
 * - Shared "Trade Table" in center (what each side offers)
 * - Optional D20 Barter check integration
 * - State machine: proposing → negotiating → staging → committing → completed
 *
 * Accessibility:
 * - Keyboard navigation (Tab through items, Space/Enter to select)
 * - Screen reader: Trade table announces offers
 * - Reduced motion: Disable drag animations
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
// import { AtomicTrade, TradeStage } from '../engine/atomicTradeEngine';
// import { resolveDiceRoll, DiceAction } from '../engine';

// Temporary type definitions
type TradeStage = 'proposed' | 'negotiating' | 'staged' | 'committing' | 'completed' | 'cancelled' | 'failed';

interface AtomicTrade {
  tradeId: string;
  stage: TradeStage;
  initiatorId: string;
  responderId: string;
  initiatorItems: any[];
  responderItems: any[];
  createdAt: number;
  timeoutAt: number;
  failureReason?: string;
}
interface DiceAction {
  type?: string;
  dc?: number;
  description?: string;
  actionType?: string;
  actionTitle?: string;
  targetDC?: number;
}

function resolveDiceRoll(action: DiceAction, modifiers: any[], dc: number): any {
  // Temporary implementation
  return {
    roll: Math.floor(Math.random() * 20) + 1,
    total: Math.floor(Math.random() * 20) + 1,
    passed: Math.random() > 0.5,
    isCritical: false,
    isFumble: false
  };
}

interface TradeOverlayProps {
  trade: AtomicTrade | null;
  clientId: string;
  clientInventory: Map<string, number>;
  partnerInventory: Map<string, number>;
  onTradeUpdate: (trade: AtomicTrade) => void;
  onTradeComplete: (trade: AtomicTrade) => void;
  onCancel: () => void;
  allowBarterCheck?: boolean;
  barterSkillBonus?: number;
}

interface InventoryItem {
  itemId: string;
  quantity: number;
  displayName: string;
  icon?: string;
  _source?: 'mine' | 'theirs';
}

/**
 * Trade Overlay Component
 */
export const TradeOverlay: React.FC<TradeOverlayProps> = ({
  trade,
  clientId,
  clientInventory,
  partnerInventory,
  onTradeUpdate,
  onTradeComplete,
  onCancel,
  allowBarterCheck = false,
  barterSkillBonus = 0
}) => {
  const [draggedItem, setDraggedItem] = useState<InventoryItem | null>(null);
  const [selectedTab, setSelectedTab] = useState<'inventory' | 'table'>('table');
  const [barterCheckResult, setBarterCheckResult] = useState<number | null>(null);
  const [barterVisible, setBarterVisible] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (!trade) return null;

  const isInitiator = clientId === trade.initiatorId;
  const isResponder = clientId === trade.responderId;
  const partnerName = isInitiator ? trade.responderId : trade.initiatorId;
  const myItems = isInitiator ? trade.initiatorItems : trade.responderItems;
  const partnerItems = isInitiator ? trade.responderItems : trade.initiatorItems;

  // Convert inventory to array
  const myInventoryArray = useMemo(
    () =>
      Array.from(clientInventory.entries()).map(([itemId, qty]) => ({
        itemId,
        quantity: qty,
        displayName: formatItemName(itemId),
        icon: getItemIcon(itemId)
      })),
    [clientInventory]
  );

  const partnerInventoryArray = useMemo(
    () =>
      Array.from(partnerInventory.entries()).map(([itemId, qty]) => ({
        itemId,
        quantity: qty,
        displayName: formatItemName(itemId),
        icon: getItemIcon(itemId)
      })),
    [partnerInventory]
  );

  /**
   * Handle drag start from inventory
   */
  const handleDragStart = (item: InventoryItem, source: 'mine' | 'theirs') => {
    if (trade.stage !== 'proposed' && trade.stage !== 'negotiating') {
      return; // Can't modify offers once staged
    }
    setDraggedItem({ ...item, _source: source as any });
  };

  /**
   * Handle drag over trade table
   */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  /**
   * Handle drop on trade table (add item to offer)
   */
  const handleDropOnTable = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;

    const source = (draggedItem as any)._source;
    if (source === 'mine' && !isInitiator) return; // Partner can't add to initiator's items

    // Emit update to parent (actual item addition handled there)
    // This is a UI component; state mgmt is in parent TradeManager
    setDraggedItem(null);
  };

  /**
   * Remove item from offer
   */
  const handleRemoveFromOffer = (itemId: string, fromResponder: boolean) => {
    if (trade.stage !== 'proposed' && trade.stage !== 'negotiating') return;
    // Handled by parent
  };

  /**
   * Roll barter check (optional D20 test to modify terms)
   */
  const handleBarterCheck = useCallback(() => {
    const action: DiceAction = {
      actionType: 'skill_check',
      actionTitle: 'Barter Negotiation',
      targetDC: 12
    };

    const modifiers = [
      { name: 'Charisma', value: barterSkillBonus, source: 'stat' },
      { name: 'Trade Goods', value: 2, source: 'circumstance' }
    ];

    const result = resolveDiceRoll(action, modifiers, 12);
    setBarterCheckResult(result.total);
    setBarterVisible(true);

    // Show result in UI (e.g., "You rolled 18! Better terms available")
  }, [barterSkillBonus]);

  /**
   * Agree to trade (advance stage)
   */
  const handleAgree = () => {
    setAgreed(true);
    onTradeUpdate(trade);
  };

  /**
   * Get visual stage indicator (0-100%)
   */
  const stagePercent = useMemo(() => {
    const stages: TradeStage[] = ['proposed', 'negotiating', 'staged', 'committing', 'completed'];
    const idx = stages.indexOf(trade.stage);
    return ((idx + 1) / stages.length) * 100;
  }, [trade.stage]);

  return (
    <div className="trade-overlay" role="dialog" aria-label={`Trade with ${partnerName}`}>
      {/* Header */}
      <div className="trade-header">
        <h2>Trade Exchange</h2>
        <div className="trade-participants">
          <span className={`participant ${isInitiator ? 'you' : ''}`}>
            {isInitiator ? 'You (Initiator)' : clientId}
          </span>
          <span className="vs">⟷</span>
          <span className={`participant ${isResponder ? 'you' : ''}`}>
            {isResponder ? 'You (Responder)' : partnerName}
          </span>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="trade-progress" aria-label={`Trade stage: ${trade.stage}`}>
        <div className="progress-bar" style={{ width: `${stagePercent}%` }} />
        <span className="progress-text">{trade.stage.toUpperCase()}</span>
      </div>

      {/* Main Trading Interface */}
      <div className="trade-container">
        {/* Left: My Inventory */}
        <div className="inventory-pane mine" role="region" aria-label="Your inventory">
          <h3>Your Inventory</h3>
          <div
            className="inventory-list"
            onDragOver={handleDragOver}
            aria-live="polite"
          >
            {myInventoryArray.map(item => {
              const inOffer = myItems.some(o => o.itemId === item.itemId);
              return (
                <div
                  key={item.itemId}
                  className={`inventory-item ${inOffer ? 'in-offer' : ''}`}
                  draggable={trade.stage === 'proposed' || trade.stage === 'negotiating'}
                  onDragStart={() => handleDragStart(item, isInitiator ? 'mine' : 'theirs')}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.displayName} x${item.quantity}${inOffer ? ' (in offer)' : ''}`}
                >
                  {item.icon && <span className="item-icon">{item.icon}</span>}
                  <div className="item-name">{item.displayName}</div>
                  <div className="item-qty">×{item.quantity}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Trade Table */}
        <div
          className="trade-table"
          role="region"
          aria-label="Proposed trade items"
          onDragOver={handleDragOver}
          onDrop={handleDropOnTable}
        >
          <div className="table-title">Trade Offers</div>

          {/* My Offer */}
          <div className="offer-side mine">
            <h4>You Offer</h4>
            <div className="offer-items" aria-live="polite">
              {myItems.length > 0 ? (
                myItems.map((item, idx) => (
                  <div key={idx} className="trade-offer-item">
                    <span className="item-name">{formatItemName(item.itemId)}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    {(trade.stage === 'proposed' || trade.stage === 'negotiating') && (
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveFromOffer(item.itemId, !isInitiator)}
                        aria-label={`Remove ${formatItemName(item.itemId)}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="placeholder">Drag items here</p>
              )}
            </div>
          </div>

          {/* Partner Offer */}
          <div className="offer-side theirs">
            <h4>{partnerName} Offers</h4>
            <div className="offer-items" aria-live="polite">
              {partnerItems.length > 0 ? (
                partnerItems.map((item, idx) => (
                  <div key={idx} className="trade-offer-item partner">
                    <span className="item-name">{formatItemName(item.itemId)}</span>
                    <span className="item-qty">×{item.quantity}</span>
                    {(trade.stage === 'proposed' || trade.stage === 'negotiating') && isResponder && (
                      <button
                        className="remove-btn"
                        onClick={() => handleRemoveFromOffer(item.itemId, true)}
                        aria-label={`Remove ${formatItemName(item.itemId)}`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="placeholder">Waiting for offer</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Partner Inventory (read-only) */}
        <div className="inventory-pane theirs" role="region" aria-label={`${partnerName} inventory`}>
          <h3>{partnerName}'s Inventory</h3>
          <div className="inventory-list" aria-live="polite">
            {partnerInventoryArray.slice(0, 5).map(item => (
              <div
                key={item.itemId}
                className="inventory-item read-only"
                role="img"
                aria-label={`${item.displayName} x${item.quantity} (partner inventory)`}
              >
                {item.icon && <span className="item-icon">{item.icon}</span>}
                <div className="item-name">{item.displayName}</div>
                <div className="item-qty">×{item.quantity}</div>
              </div>
            ))}
            {partnerInventoryArray.length > 5 && (
              <div className="inventory-item placeholder">+{partnerInventoryArray.length - 5} more</div>
            )}
          </div>
        </div>
      </div>

      {/* Optional Barter Check Section */}
      {allowBarterCheck && trade.stage === 'negotiating' && (
        <div className="barter-section">
          <button
            className="barter-btn"
            onClick={handleBarterCheck}
            aria-label="Roll D20 Barter check to modify terms"
          >
            📜 Barter Check (D20)
          </button>
          {barterVisible && barterCheckResult !== null && (
            <div className="barter-result" role="status" aria-live="assertive">
              <p>
                You rolled <strong>{barterCheckResult}</strong>
                {barterCheckResult >= 18 && ' — Excellent terms available!'}
                {barterCheckResult >= 15 && barterCheckResult < 18 && ' — Good negotiation.'}
                {barterCheckResult < 12 && ' — Could be better...'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="trade-actions">
        {(trade.stage === 'proposed' || trade.stage === 'negotiating') && (
          <>
            {isInitiator && trade.stage === 'proposed' && (
              <button
                className="btn btn-primary"
                onClick={handleAgree}
                disabled={myItems.length === 0}
                aria-label="Propose this trade offer to partner"
              >
                Propose Trade
              </button>
            )}
            {isResponder && trade.stage === 'proposed' && (
              <>
                <button
                  className="btn btn-primary"
                  onClick={handleAgree}
                  disabled={partnerItems.length === 0}
                  aria-label="Accept this trade offer"
                >
                  Accept
                </button>
              </>
            )}
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              aria-label="Cancel this trade"
            >
              Cancel
            </button>
          </>
        )}

        {trade.stage === 'staged' && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleAgree}
              disabled={agreed}
              aria-label="Confirm and commit to this trade"
            >
              {agreed ? '✓ Committed' : 'Commit Trade'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={onCancel}
              aria-label="Back out and cancel"
            >
              Back Out
            </button>
          </>
        )}

        {trade.stage === 'completed' && (
          <button
            className="btn btn-success"
            onClick={onCancel}
            aria-label="Close this completed trade"
          >
            ✓ Trade Complete
          </button>
        )}

        {trade.stage === 'cancelled' && (
          <button
            className="btn"
            onClick={onCancel}
            aria-label="Close this cancelled trade"
          >
            Trade Cancelled
          </button>
        )}

        {trade.stage === 'failed' && (
          <button
            className="btn"
            onClick={onCancel}
            aria-label="Close this failed trade"
          >
            ✗ Trade Failed: {trade.failureReason}
          </button>
        )}
      </div>

      {/* Error/Status Messages */}
      {trade.failureReason && (
        <div className="trade-error" role="alert">
          {trade.failureReason}
        </div>
      )}
    </div>
  );
};

/**
 * Helper: Format item ID to display name
 */
function formatItemName(itemId: string): string {
  return itemId
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Helper: Get emoji icon for item type
 */
function getItemIcon(itemId: string): string {
  const icons: Record<string, string> = {
    gold_coin: '🪙',
    silver_coin: '🟢',
    copper_coin: '🔴',
    diamond: '💎',
    emerald: '💚',
    ruby: '❤️',
    sapphire: '💙',
    potion_health: '🧪',
    potion_mana: '🔵',
    scroll_fire: '🔥',
    scroll_ice: '❄️',
    ancient_tome: '📖',
    sword: '⚔️',
    shield: '🛡️',
    bow: '🏹',
    staff: '🪄',
    cloak: '👗',
    boots: '👢',
    ring_gold: '💍',
    necklace: '📿'
  };
  return icons[itemId] || '📦';
}

export default TradeOverlay;
