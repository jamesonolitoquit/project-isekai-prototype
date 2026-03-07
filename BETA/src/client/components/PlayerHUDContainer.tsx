/**
 * PlayerHUDContainer Component
 * 
 * Main HUD container for the Hero's Reliquary system.
 * Features:
 * - Persistent overlay HUD with vitals bar
 * - Windowing system for Inventory, Quests, Character Sheet, etc.
 * - State-managed open/close animations via framer-motion
 * - Future-proof architecture for adding new windows
 * - Theme-aware styling
 * 
 * Phase 1 & 2: Implement core windowing infrastructure + HeroicVitalsBar
 * 
 * Window Types (extensible enum):
 * - 'inventory': Inventory management
 * - 'quests': Quest journal
 * - 'character': Character stats and allocation
 * - 'skills': Skill/ability management (future)
 * - 'crafting': Crafting & forging (future)
 * - 'map': World map (future)
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { WorldState, PlayerState } from '../../engine/worldEngine';
import { usePlayerTheme, type ThemeId } from '../hooks/usePlayerTheme';
import HeroicVitalsBar from './HeroicVitalsBar';
import CharacterSheet from './CharacterSheet';
import QuestJournal from './QuestJournal';
import ReliquaryArmory from './ReliquaryArmory';
import SkillTree from './SkillTree';
import SkillHotbar from './SkillHotbar';
import TargetFrame from './TargetFrame';
import FloatingItemTooltip, { type ItemTooltipData } from './FloatingItemTooltip';
import NotificationOverlay from './NotificationOverlay';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HUDWindowType = 
  | 'inventory' 
  | 'quests' 
  | 'character' 
  | 'skills' 
  | 'crafting' 
  | 'map'
  | string; // Allow extensibility

export interface HUDWindowConfig {
  type: HUDWindowType;
  isOpen: boolean;
  position?: { x: number; y: number }; // For draggable windows (future)
  size?: { width: number; height: number };
  minimized?: boolean;
}

export interface PlayerHUDContainerProps {
  player: PlayerState;
  worldState: WorldState;
  playerThemeId?: ThemeId | string;
  vitalsPosition?: 'top' | 'bottom';
  onWindowToggle?: (windowType: HUDWindowType, isOpen: boolean) => void;
  onPerformAction?: (action: any) => void;
  // Optional component renderers for extensibility
  renderCustomWindow?: (
    windowType: HUDWindowType,
    window: HUDWindowConfig,
    onClose: () => void
  ) => React.ReactNode;
  // Compact mode for mobile/small screens
  compactMode?: boolean;
}

export interface HUDContextValue {
  activeWindows: Map<HUDWindowType, HUDWindowConfig>;
  toggleWindow: (windowType: HUDWindowType) => void;
  closeWindow: (windowType: HUDWindowType) => void;
  openWindow: (windowType: HUDWindowType) => void;
  theme: ReturnType<typeof usePlayerTheme>;
  player: PlayerState;
  worldState: WorldState;
  onPerformAction?: (action: any) => void;
}

// ============================================================================
// HUD CONTEXT FOR WINDOW COMPONENTS
// ============================================================================

export const HUDContext = React.createContext<HUDContextValue | null>(null);

export function useHUDContext(): HUDContextValue {
  const context = React.useContext(HUDContext);
  if (!context) {
    throw new Error('useHUDContext must be used within PlayerHUDContainer');
  }
  return context;
}

// ============================================================================
// WINDOW CONTAINER WRAPPER
// ============================================================================

interface WindowWrapperProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  theme: ReturnType<typeof usePlayerTheme>;
  size?: { width: number; height: number };
  minimized?: boolean;
}

const WindowWrapper: React.FC<WindowWrapperProps> = ({
  title,
  isOpen,
  onClose,
  children,
  theme,
  size,
  minimized = false,
}) => {
  if (!isOpen) return null;

  const windowStyle: React.CSSProperties = {
    position: 'fixed',
    top: '80px',
    right: '20px',
    width: size?.width || 400,
    height: minimized ? 'auto' : (size?.height || 500),
    backgroundColor: theme.colors.background,
    border: `2px solid ${theme.colors.accent}`,
    borderRadius: '4px',
    boxShadow: theme.shadows.heavy,
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999,
    fontFamily: theme.fonts.primary,
    animation: 'window-slide-in 0.3s ease-out',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: theme.colors.primary,
    borderBottom: `1px solid ${theme.colors.border}`,
    cursor: 'move',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontFamily: theme.fonts.heading,
    letterSpacing: '0.5px',
  };

  const closeButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: theme.colors.textAccent,
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    transition: 'color 0.2s',
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'auto',
    padding: '12px',
  };

  return (
    <div style={windowStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>{title}</span>
        <button
          style={closeButtonStyle}
          onClick={onClose}
          onMouseEnter={(e) => {
            (e.target as HTMLElement).style.color = theme.colors.warning;
          }}
          onMouseLeave={(e) => {
            (e.target as HTMLElement).style.color = theme.colors.textAccent;
          }}
        >
          ✕
        </button>
      </div>
      {!minimized && <div style={contentStyle}>{children}</div>}
    </div>
  );
};

// ============================================================================
// PLACEHOLDER WINDOW COMPONENTS
// ============================================================================

const InventoryWindowContent: React.FC<{ theme: ReturnType<typeof usePlayerTheme> }> = ({ theme }) => (
  <div style={{ color: theme.colors.text, fontSize: '14px' }}>
    <p>🎒 Inventory Management (Phase 3)</p>
    <p style={{ fontSize: '12px', color: theme.colors.textSecondary }}>
      Implement parchment-style grid with rarity borders.
    </p>
  </div>
);

// ============================================================================
// MAIN CONTAINER COMPONENT
// ============================================================================

export const PlayerHUDContainer: React.FC<PlayerHUDContainerProps> = ({
  player,
  worldState,
  playerThemeId,
  vitalsPosition = 'top',
  onWindowToggle,
  onPerformAction,
  renderCustomWindow,
  compactMode = false,
}) => {
  const theme = usePlayerTheme(playerThemeId);

  // Window management state
  const [activeWindows, setActiveWindows] = useState<Map<HUDWindowType, HUDWindowConfig>>(
    new Map()
  );

  // Item tooltip state
  const [hoveredItem, setHoveredItem] = useState<ItemTooltipData | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  // Window control functions
  const toggleWindow = useCallback(
    (windowType: HUDWindowType) => {
      setActiveWindows((prev) => {
        const newMap = new Map(prev);
        const window = newMap.get(windowType);

        if (window) {
          const newWindow = { ...window, isOpen: !window.isOpen };
          newMap.set(windowType, newWindow);
          onWindowToggle?.(windowType, newWindow.isOpen);
        } else {
          const newWindow: HUDWindowConfig = { type: windowType, isOpen: true };
          newMap.set(windowType, newWindow);
          onWindowToggle?.(windowType, true);
        }

        return newMap;
      });
    },
    [onWindowToggle]
  );

  const closeWindow = useCallback((windowType: HUDWindowType) => {
    setActiveWindows((prev) => {
      const newMap = new Map(prev);
      const window = newMap.get(windowType);
      if (window) {
        newMap.set(windowType, { ...window, isOpen: false });
        onWindowToggle?.(windowType, false);
      }
      return newMap;
    });
  }, [onWindowToggle]);

  const openWindow = useCallback((windowType: HUDWindowType) => {
    setActiveWindows((prev) => {
      const newMap = new Map(prev);
      const window = newMap.get(windowType);
      if (window) {
        newMap.set(windowType, { ...window, isOpen: true });
        onWindowToggle?.(windowType, true);
      } else {
        const newWindow: HUDWindowConfig = { type: windowType, isOpen: true };
        newMap.set(windowType, newWindow);
        onWindowToggle?.(windowType, true);
      }
      return newMap;
    });
  }, [onWindowToggle]);

  // Context value
  const contextValue = useMemo<HUDContextValue>(
    () => ({
      activeWindows,
      toggleWindow,
      closeWindow,
      openWindow,
      theme,
      player,
      worldState,
      onPerformAction,
    }),
    [activeWindows, toggleWindow, closeWindow, openWindow, theme, player, worldState, onPerformAction]
  );

  // Render window based on type
  const renderWindow = (windowType: HUDWindowType, windowConfig: HUDWindowConfig) => {
    if (!windowConfig.isOpen) return null;

    // Allow custom window rendering
    if (renderCustomWindow) {
      const custom = renderCustomWindow(windowType, windowConfig, () => closeWindow(windowType));
      if (custom) return custom;
    }

    // Default windows
    let title = '';
    let content: React.ReactNode = null;

    switch (windowType) {
      case 'inventory':
        title = 'Reliquary Armory';
        content = (
          <ReliquaryArmory
            player={player}
            onEquipItem={(itemId, slot) => {
              onPerformAction?.({
                type: 'EQUIP_ITEM',
                payload: { itemId, slot }
              });
            }}
            onUnequipItem={(slot) => {
              onPerformAction?.({
                type: 'UNEQUIP_ITEM',
                payload: { slot }
              });
            }}
            onUseItem={(itemId) => {
              onPerformAction?.({
                type: 'USE_ITEM',
                payload: { itemId }
              });
            }}
            onItemHover={(item) => {
              setHoveredItem(item as ItemTooltipData);
              setTooltipVisible(true);
            }}
            onItemLeave={() => {
              setTooltipVisible(false);
            }}
          />
        );
        break;
      case 'quests':
        title = 'Quest Journal';
        content = (
          <QuestJournal
            player={player}
            quests={worldState.quests || []}
            onCompleteQuest={(questId) => {
              onPerformAction?.({
                type: 'COMPLETE_QUEST',
                payload: { questId }
              });
            }}
            onAbandonQuest={(questId) => {
              onPerformAction?.({
                type: 'ABANDON_QUEST',
                payload: { questId }
              });
            }}
          />
        );
        break;
      case 'character':
        title = 'Character Sheet';
        content = (
          <CharacterSheet
            player={player}
            onAllocatePoints={(statName, points) => {
              onPerformAction?.({
                type: 'ALLOCATE_STAT',
                payload: { stat: statName, points }
              });
            }}
          />
        );
        break;
      case 'skills':
        title = 'Constellation';
        content = (
          <SkillTree
            player={player}
            unlockedSkills={player?.unlockedSkills || []}
            availableSkillPoints={player?.skillPoints || 0}
            onLearnSkill={(skillId) => {
              onPerformAction?.({
                type: 'LEARN_SKILL',
                payload: { skillId }
              });
            }}
          />
        );
        break;
      default:
        title = windowType.charAt(0).toUpperCase() + windowType.slice(1);
        content = <div style={{ color: theme.colors.text }}>Window: {windowType}</div>;
    }

    return (
      <WindowWrapper
        key={windowType}
        title={title}
        isOpen={windowConfig.isOpen}
        onClose={() => closeWindow(windowType)}
        theme={theme}
        size={windowConfig.size}
        minimized={windowConfig.minimized}
      >
        {content}
      </WindowWrapper>
    );
  };

  return (
    <HUDContext.Provider value={contextValue}>
      <div style={{ fontFamily: theme.fonts.primary }}>
        {/* Persistent Vitals Bar */}
        <HeroicVitalsBar
          player={player}
          worldState={worldState}
          playerThemeId={playerThemeId}
          position={vitalsPosition}
          compact={compactMode}
        />

        {/* Target Status Frame */}
        <TargetFrame state={worldState} />

        {/* Persistent Skill Hotbar */}
        <SkillHotbar
          player={player}
          worldState={worldState}
          onCastSkill={(abilityId) => {
            onPerformAction?.({
              type: 'USE_ABILITY',
              payload: { abilityId }
            });
          }}
        />

        {/* Target Frame (Phase 8: Real-time target display) */}
        <TargetFrame 
          state={worldState} 
          isDiegetic={!compactMode}
        />

        {/* Notification Overlay (Phase 8: Toast notifications) */}
        <NotificationOverlay 
          events={[] as any[]} 
          maxNotifications={compactMode ? 3 : 5}
          toastDuration={4000}
        />

        {/* Render all open windows */}
        {Array.from(activeWindows.entries()).map(([windowType, windowConfig]) =>
          renderWindow(windowType, windowConfig)
        )}

        {/* Floating Item Tooltip */}
        <FloatingItemTooltip
          item={hoveredItem}
          visible={tooltipVisible}
          player={player}
        />

        {/* Floating Action Menu (Future: Keyboard shortcuts, mouse clicks) */}
        <FloatingActionMenu theme={theme} toggleWindow={toggleWindow} compactMode={compactMode} />
      </div>
    </HUDContext.Provider>
  );
};

// ============================================================================
// FLOATING ACTION MENU
// ============================================================================

interface FloatingActionMenuProps {
  theme: ReturnType<typeof usePlayerTheme>;
  toggleWindow: (windowType: HUDWindowType) => void;
  compactMode: boolean;
}

const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({
  theme,
  toggleWindow,
  compactMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: compactMode ? '12px' : '20px',
    right: compactMode ? '12px' : '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    zIndex: 998,
  };

  const buttonStyle: React.CSSProperties = {
    width: compactMode ? '36px' : '44px',
    height: compactMode ? '36px' : '44px',
    borderRadius: '50%',
    backgroundColor: theme.colors.accent,
    border: `2px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: compactMode ? '14px' : '16px',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s',
    boxShadow: theme.shadows.medium,
  };

  const actionButtons = [
    { label: 'INV', type: 'inventory' as HUDWindowType },
    { label: 'QST', type: 'quests' as HUDWindowType },
    { label: 'CHR', type: 'character' as HUDWindowType },
    { label: 'SKL', type: 'skills' as HUDWindowType },
  ];

  return (
    <div style={containerStyle}>
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {actionButtons.map((button) => (
            <button
              key={button.type}
              style={buttonStyle}
              onClick={() => {
                toggleWindow(button.type);
              }}
              title={button.label}
            >
              {button.label}
            </button>
          ))}
        </div>
      )}

      {/* Toggle Button */}
      <button
        style={{
          ...buttonStyle,
          backgroundColor: isExpanded ? theme.colors.warning : theme.colors.accent,
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        title={isExpanded ? 'Close Menu' : 'Open Menu'}
      >
        {isExpanded ? '✕' : '☰'}
      </button>
    </div>
  );
};

export default PlayerHUDContainer;
