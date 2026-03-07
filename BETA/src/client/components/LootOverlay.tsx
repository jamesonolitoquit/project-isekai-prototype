/**
 * LootOverlay.tsx — Phase 45: Diegetic Loot UI
 * 
 * Displays a physical "Loot Sack" or "Evidence Bag" on the tabletop
 * when SEARCH or HARVEST actions succeed. Allows drag-and-drop
 * item transfer into player inventory with diegetic flavor.
 */

import React, { useState, useEffect } from 'react';
import type { WorldState, StackableItem } from '../../engine/worldEngine';
import type { NarrativeCodec } from '../services/themeManager';

interface LootItem {
  name: string;
  quantity: number;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

interface LootOverlayProps {
  isVisible: boolean;
  lootItems: LootItem[];
  actionType: 'SEARCH' | 'HARVEST' | 'INTERACT';
  location: string;
  currentCodec: NarrativeCodec;
  onLootSelected?: (item: LootItem, quantity: number) => void;
  onLootAll?: (items: LootItem[]) => void;
  onClose?: () => void;
}

/**
 * Get codec-specific loot container styling
 */
const getLootContainerStyle = (codec: NarrativeCodec, actionType: string): React.CSSProperties => {
  const styleMap: Record<string, React.CSSProperties> = {
    'CODENAME_MEDIEVAL': {
      background: 'linear-gradient(135deg, rgba(139, 100, 50, 0.9) 0%, rgba(101, 67, 33, 0.9) 100%)',
      border: '3px solid #8b6432',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      borderRadius: '4px'
    },
    'CODENAME_CYBERPUNK': {
      background: 'linear-gradient(135deg, rgba(0, 204, 255, 0.2) 0%, rgba(0, 102, 204, 0.2) 100%)',
      border: '2px solid #00ccff',
      boxShadow: '0 0 20px rgba(0, 204, 255, 0.4), inset 0 0 10px rgba(0, 204, 255, 0.1)',
      borderRadius: '0px'
    },
    'CODENAME_NOIR': {
      background: 'linear-gradient(135deg, rgba(50, 50, 50, 0.9) 0%, rgba(30, 30, 30, 0.9) 100%)',
      border: '2px dashed #666666',
      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.8)',
      borderRadius: '2px'
    },
    'CODENAME_GLITCH': {
      background: 'linear-gradient(135deg, rgba(255, 0, 255, 0.15) 0%, rgba(255, 0, 0, 0.15) 100%)',
      border: '2px solid #ff00ff',
      boxShadow: '0 0 15px rgba(255, 0, 255, 0.3), inset 0 0 8px rgba(255, 0, 0, 0.1)',
      borderRadius: '0px'
    },
    'CODENAME_STORYBOOK': {
      background: 'linear-gradient(135deg, rgba(184, 134, 11, 0.85) 0%, rgba(139, 69, 19, 0.85) 100%)',
      border: '3px solid #daa520',
      boxShadow: '0 8px 16px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
      borderRadius: '6px'
    }
  };

  return styleMap[codec] || styleMap['CODENAME_MEDIEVAL'];
};

/**
 * Get rarity color for loot items
 */
const getRarityColor = (rarity: string): string => {
  const colors: Record<string, string> = {
    'common': '#aaaaaa',
    'uncommon': '#00cc00',
    'rare': '#0066ff',
    'epic': '#ff00ff'
  };
  return colors[rarity] || '#ffffff';
};

/**
 * Get rarity background for visual distinction
 */
const getRarityBg = (rarity: string): string => {
  const bgs: Record<string, string> = {
    'common': 'rgba(100, 100, 100, 0.2)',
    'uncommon': 'rgba(0, 200, 0, 0.15)',
    'rare': 'rgba(0, 100, 255, 0.15)',
    'epic': 'rgba(255, 0, 255, 0.15)'
  };
  return bgs[rarity] || 'rgba(200, 200, 200, 0.2)';
};

export const LootOverlay: React.FC<LootOverlayProps> = ({
  isVisible,
  lootItems,
  actionType,
  location,
  currentCodec,
  onLootSelected,
  onLootAll,
  onClose
}) => {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [draggedItem, setDraggedItem] = useState<number | null>(null);

  if (!isVisible || lootItems.length === 0) {
    return null;
  }

  const containerStyle = getLootContainerStyle(currentCodec, actionType);

  /**
   * Handle item selection (click)
   */
  const handleItemClick = (idx: number) => {
    const newSelected = new Set(selectedIndices);
    if (newSelected.has(idx)) {
      newSelected.delete(idx);
    } else {
      newSelected.add(idx);
    }
    setSelectedIndices(newSelected);
  };

  /**
   * Handle drag start for item
   */
  const handleDragStart = (idx: number) => {
    setDraggedItem(idx);
  };

  /**
   * Handle loot all button
   */
  const handleLootAll = () => {
    onLootAll?.(lootItems);
    setSelectedIndices(new Set());
    onClose?.();
  };

  /**
   * Get action-specific title and flavor text
   */
  const getActionTitle = (): string => {
    const titles: Record<string, string> = {
      'SEARCH': '🔍 Discovery Sack',
      'HARVEST': '⛏️ Harvested Materials',
      'INTERACT': '🔓 Recovered Items'
    };
    return titles[actionType] || 'Loot Found';
  };

  /**
   * Get flavor text for action
   */
  const getFlavorText = (): string => {
    const flavors: Record<NarrativeCodec, Record<string, string>> = {
      'CODENAME_MEDIEVAL': {
        'SEARCH': 'Parchment and treasures found beneath the earth.',
        'HARVEST': 'Raw materials gathered from natural deposits.',
        'INTERACT': 'Ancient relics recovered from this place.'
      },
      'CODENAME_CYBERPUNK': {
        'SEARCH': '[DATA_FOUND] Classified information extracted.',
        'HARVEST': '[MATERIAL_SCAN] Valuable minerals isolated.',
        'INTERACT': '[ARTIFACT_RETRIEVED] Pre-collapse tech secured.'
      },
      'CODENAME_NOIR': {
        'SEARCH': 'Evidence bagged. Keep it safe.',
        'HARVEST': 'Raw goods extracted. No questions asked.',
        'INTERACT': 'Relics recovered. Time to fade.'
      },
      'CODENAME_GLITCH': {
        'SEARCH': 'DATA_ACQUIRED_ 0x%fs corruption detected',
        'HARVEST': 'MATL_EXTRACT_ fragments reassembling',
        'INTERACT': 'RELIC_FOUND_ encrypted payload accessed'
      },
      'CODENAME_STORYBOOK': {
        'SEARCH': 'Treasures of the realm revealed.',
        'HARVEST': 'Essences of nature gathered.',
        'INTERACT': 'Artifacts of power recovered.'
      },
      'CODENAME_MINIMAL': {
        'SEARCH': 'Items found.',
        'HARVEST': 'Materials extracted.',
        'INTERACT': 'Object accessed.'
      },
      'CODENAME_SOLARPUNK': {
        'SEARCH': 'Natural treasures discovered.',
        'HARVEST': 'Sustainable materials gathered.',
        'INTERACT': 'Harmony restored.'
      },
      'CODENAME_VOIDSYNC': {
        'SEARCH': 'Void-touched artifacts recovered.',
        'HARVEST': 'Sterile minerals extracted.',
        'INTERACT': 'Void object interfaced.'
      },
      'CODENAME_OVERLAND': {
        'SEARCH': 'Supplies located.',
        'HARVEST': 'Resources secured.',
        'INTERACT': 'Cache opened.'
      },
      'CODENAME_VINTAGE': {
        'SEARCH': 'Treasures unearthed from the past.',
        'HARVEST': 'Period materials gathered.',
        'INTERACT': 'Relic acquired.'
      },
      'CODENAME_DREAMSCAPE': {
        'SEARCH': 'Dream-touched artifacts shimmer.',
        'HARVEST': 'Ethereal essences gathered.',
        'INTERACT': 'Dream-space unlocked.'
      }
    };

    return flavors[currentCodec]?.[actionType] || 'Items gathered.';
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        maxWidth: '400px',
        zIndex: 2000,
        animation: 'slideIn 0.4s ease-out'
      }}
    >
      <div style={containerStyle as React.CSSProperties}>
        {/* Header */}
        <div
          style={{
            padding: '12px',
            borderBottom: currentCodec === 'CODENAME_CYBERPUNK' ? '1px solid rgba(0, 204, 255, 0.3)' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <div>
            <div style={getLootContainerStyle(currentCodec, actionType) as React.CSSProperties}>
              {getActionTitle()}
            </div>
            <div
              style={{
                fontSize: '10px',
                color: 'rgba(200, 200, 200, 0.6)',
                marginTop: '4px',
                fontStyle: 'italic'
              }}
            >
              {location}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(200, 200, 200, 0.7)',
              fontSize: '16px',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Flavor text */}
        <div
          style={{
            padding: '10px 12px',
            fontSize: '11px',
            color: 'rgba(200, 200, 200, 0.7)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
            fontStyle: 'italic',
            lineHeight: 1.4
          }}
        >
          {getFlavorText()}
        </div>

        {/* Items list */}
        <div
          style={{
            maxHeight: '300px',
            overflowY: 'auto',
            padding: '8px'
          }}
        >
          {lootItems.map((item, idx) => (
            <div
              key={idx}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onClick={() => handleItemClick(idx)}
              style={{
                background: selectedIndices.has(idx) 
                  ? 'rgba(139, 92, 246, 0.3)'
                  : getRarityBg(item.rarity),
                border: selectedIndices.has(idx)
                  ? '1px solid rgba(139, 92, 246, 0.6)'
                  : `1px solid ${getRarityColor(item.rarity)}`,
                borderRadius: '4px',
                padding: '8px',
                margin: '4px 0',
                cursor: 'grab',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.95';
                (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
              }}
            >
              <span style={{ color: getRarityColor(item.rarity), fontWeight: 600, fontSize: '12px' }}>
                {item.name}
              </span>
              <span
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  color: getRarityColor(item.rarity)
                }}
              >
                ×{item.quantity}
              </span>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div
          style={{
            padding: '10px',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            gap: '8px'
          }}
        >
          <button
            onClick={handleLootAll}
            style={{
              flex: 1,
              padding: '8px',
              background: 'rgba(139, 92, 246, 0.3)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              borderRadius: '3px',
              color: '#e6e6fa',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 92, 246, 0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(139, 92, 246, 0.3)';
            }}
          >
            💼 Loot All
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px',
              background: 'rgba(100, 100, 100, 0.2)',
              border: '1px solid rgba(100, 100, 100, 0.4)',
              borderRadius: '3px',
              color: '#aaaaaa',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(100, 100, 100, 0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(100, 100, 100, 0.2)';
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(450px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default LootOverlay;
