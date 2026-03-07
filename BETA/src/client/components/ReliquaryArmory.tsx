/**
 * ReliquaryArmory Component
 * 
 * Grid-based inventory management system for the Hero's Reliquary.
 * Features:
 * - Grid layout with rarity-based glow effects
 * - Equipment slots (Head, Chest, Arms, Legs, Trinket, MainHand, OffHand)
 * - Drag-and-drop support (future: full implementation)
 * - Item filtering by equipment slot
 * - Rarity color system integration
 * - Quantity indicators for stackable items
 * 
 * Phase 3: Diegetic inventory with visual hierarchy
 */

import React, { useState, useMemo } from 'react';
import type { PlayerState, InventoryItem } from '../../engine/worldEngine';
import { useHUDContext } from './PlayerHUDContainer';

export interface ReliquaryArmoryProps {
  player: PlayerState;
  onEquipItem?: (itemId: string, slot?: string) => void;
  onUnequipItem?: (slot: string) => void;
  onUseItem?: (itemId: string) => void;
  onItemHover?: (item: any) => void;
  onItemLeave?: () => void;
}

export type EquipmentSlotType = 
  | 'head' 
  | 'chest' 
  | 'arms' 
  | 'legs' 
  | 'feet'
  | 'trinket'
  | 'mainHand' 
  | 'offHand';

interface ItemTemplate {
  type: 'weapon' | 'armor' | 'consumable' | 'material' | 'relic' | 'trinket';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'artifact';
  slot?: EquipmentSlotType;
  statBonus?: Record<string, number>;
  stackable?: boolean;
  maxStack?: number;
  value?: number;
}

// Simplified item database
const ITEM_TEMPLATES: Record<string, ItemTemplate> = {
  'healing-potion-minor': {
    type: 'consumable',
    rarity: 'common',
    stackable: true,
    maxStack: 99
  },
  'healing-potion-major': {
    type: 'consumable',
    rarity: 'uncommon',
    stackable: true,
    maxStack: 25
  },
  'stamina-tonic': {
    type: 'consumable',
    rarity: 'uncommon',
    stackable: true,
    maxStack: 25
  },
  'rare-herb': {
    type: 'material',
    rarity: 'uncommon',
    stackable: true,
    maxStack: 99
  },
  'rusty-sword': {
    type: 'weapon',
    rarity: 'common',
    slot: 'mainHand',
    stackable: false,
    statBonus: { str: 1 }
  },
  'steel-sword': {
    type: 'weapon',
    rarity: 'uncommon',
    slot: 'mainHand',
    stackable: false,
    statBonus: { str: 2, dex: 1 }
  },
  'dragon-bane-sword': {
    type: 'weapon',
    rarity: 'legendary',
    slot: 'mainHand',
    stackable: false,
    statBonus: { str: 4, int: 2 }
  },
  'steel-buckler': {
    type: 'armor',
    rarity: 'uncommon',
    slot: 'offHand',
    stackable: false
  },
  'iron-breastplate': {
    type: 'armor',
    rarity: 'uncommon',
    slot: 'chest',
    stackable: false
  },
  'crown-of-ages': {
    type: 'armor',
    rarity: 'epic',
    slot: 'head',
    stackable: false,
    statBonus: { int: 3, cha: 2 }
  },
  'amulet-of-protection': {
    type: 'trinket',
    rarity: 'rare',
    slot: 'trinket',
    stackable: false
  },
};

const EQUIPMENT_SLOT_NAMES: Record<EquipmentSlotType, string> = {
  head: 'Head',
  chest: 'Chest',
  arms: 'Arms',
  legs: 'Legs',
  feet: 'Feet',
  trinket: 'Trinket',
  mainHand: 'Main Hand',
  offHand: 'Off Hand',
};

export const ReliquaryArmory: React.FC<ReliquaryArmoryProps> = ({
  player,
  onEquipItem,
  onUnequipItem,
  onUseItem,
  onItemHover,
  onItemLeave,
}) => {
  const { theme } = useHUDContext();
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlotType | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  const inventory = player.inventory || [];
  const equipment = player.equipment || {};

  // Get rarity color with glow
  const getRarityStyle = (rarity: string) => {
    const rarityColors = {
      common: { color: theme.colors.rarity.common, glow: `0 0 4px ${theme.colors.rarity.common}44` },
      uncommon: { color: theme.colors.rarity.uncommon, glow: `0 0 8px ${theme.colors.rarity.uncommon}66` },
      rare: { color: theme.colors.rarity.rare, glow: `0 0 12px ${theme.colors.rarity.rare}88` },
      epic: { color: theme.colors.rarity.epic, glow: `0 0 16px ${theme.colors.rarity.epic}aa` },
      legendary: { color: theme.colors.rarity.legendary, glow: `0 0 20px ${theme.colors.rarity.legendary}cc` },
      artifact: { color: '#ff00ff', glow: `0 0 24px #ff00ffee` },
    };
    return rarityColors[rarity as keyof typeof rarityColors] || rarityColors.common;
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    color: theme.colors.text,
    height: '100%',
    overflow: 'auto',
  };

  const sectionStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    fontFamily: theme.fonts.heading,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  };

  // =========================================================================
  // EQUIPMENT SLOTS
  // =========================================================================

  const equipmentGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  };

  const slotStyle = (slotType: EquipmentSlotType, isSelected: boolean): React.CSSProperties => {
    const isEquipped = Object.values(equipment).includes((equipment as any)[slotType]);
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      aspectRatio: '1',
      backgroundColor: isSelected ? theme.colors.primary : theme.colors.secondary,
      border: isSelected ? `2px solid ${theme.colors.accent}` : `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      fontSize: '10px',
      fontWeight: 600,
      color: isEquipped ? theme.colors.success : theme.colors.textSecondary,
      textAlign: 'center',
      padding: '4px',
      position: 'relative',
    };
  };

  const renderEquipmentSlots = () => {
    const slots: EquipmentSlotType[] = ['head', 'chest', 'mainHand', 'offHand', 'arms', 'legs', 'feet', 'trinket'];

    return (
      <div style={equipmentGridStyle}>
        {slots.map((slot) => {
          const equippedItemId = (equipment as any)?.[slot];
          const item = inventory.find((i) => i.itemId === equippedItemId);
          const template = ITEM_TEMPLATES[equippedItemId] || { rarity: 'common', type: 'material', stackable: false };

          return (
            <div
              key={slot}
              style={slotStyle(slot, selectedSlot === slot)}
              onClick={() => setSelectedSlot(selectedSlot === slot ? null : slot)}
              onMouseEnter={() => setHoveredItem(equippedItemId || null)}
              onMouseLeave={() => setHoveredItem(null)}
              title={EQUIPMENT_SLOT_NAMES[slot]}
            >
              {equippedItemId ? (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div
                    style={{
                      width: '80%',
                      height: '80%',
                      backgroundColor: getRarityStyle(template.rarity).color,
                      borderRadius: '3px',
                      boxShadow: getRarityStyle(template.rarity).glow,
                      opacity: 0.8,
                    }}
                  />
                </div>
              ) : (
                <div style={{ opacity: 0.5 }}>{EQUIPMENT_SLOT_NAMES[slot]}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // =========================================================================
  // INVENTORY GRID
  // =========================================================================

  const inventoryGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(48px, 1fr))',
    gap: '6px',
    padding: '8px',
    backgroundColor: theme.colors.primary,
    borderRadius: '4px',
    minHeight: '200px',
  };

  const itemSlotStyle = (rarity: string, isHovered: boolean): React.CSSProperties => {
    const rarityStyle = getRarityStyle(rarity);
    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      aspectRatio: '1',
      backgroundColor: theme.colors.secondary,
      border: `2px solid ${rarityStyle.color}`,
      borderRadius: '4px',
      cursor: 'pointer',
      transition: 'all 0.2s',
      boxShadow: isHovered ? rarityStyle.glow : 'none',
      position: 'relative',
      padding: '4px',
      fontSize: '10px',
      fontWeight: 600,
      color: theme.colors.textSecondary,
    };
  };

  const quantityBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '0px',
    right: '0px',
    backgroundColor: theme.colors.accent,
    color: theme.colors.primary,
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '9px',
    fontWeight: 700,
    fontFamily: theme.fonts.mono,
  };

  const filteredInventory =
    selectedSlot && selectedSlot !== 'trinket'
      ? inventory.filter((item) => {
          const template = ITEM_TEMPLATES[item.itemId] || {};
          return (template as ItemTemplate).slot === selectedSlot;
        })
      : inventory;

  const renderInventoryGrid = () => (
    <div style={inventoryGridStyle}>
      {filteredInventory.length === 0 ? (
        <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: theme.colors.textSecondary, padding: '20px' }}>
          {selectedSlot ? `No items for ${EQUIPMENT_SLOT_NAMES[selectedSlot]}` : 'Inventory empty'}
        </div>
      ) : (
        filteredInventory.map((item, idx) => {
          const template = ITEM_TEMPLATES[item.itemId] || { rarity: 'common', type: 'material', stackable: false };
          const isHovered = hoveredItem === item.itemId;
          const isStackable = (template as ItemTemplate).stackable;

          return (
            <div
              key={`${item.itemId}-${idx}`}
              style={itemSlotStyle(template.rarity, isHovered)}
              onClick={() => {
                if ((template as ItemTemplate).type === 'consumable') {
                  onUseItem?.(item.itemId);
                } else if (selectedSlot) {
                  onEquipItem?.(item.itemId, selectedSlot);
                }
              }}
              onMouseEnter={() => {
                setHoveredItem(item.itemId);
                if (onItemHover) {
                  const quantity = 'quantity' in item ? item.quantity : 1;
                  onItemHover({
                    itemId: item.itemId,
                    name: item.itemId.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
                    rarity: template.rarity,
                    type: template.type,
                    description: `A ${template.rarity} ${template.type}`,
                    statBonus: (template as ItemTemplate).statBonus,
                    quantity: quantity,
                    stackable: isStackable,
                    maxStack: (template as ItemTemplate).maxStack,
                    value: (template as ItemTemplate).value || 0,
                  });
                }
              }}
              onMouseLeave={() => {
                setHoveredItem(null);
                if (onItemLeave) {
                  onItemLeave();
                }
              }}
              title={item.itemId}
            >
              <div
                style={{
                  width: '60%',
                  height: '60%',
                  backgroundColor: getRarityStyle(template.rarity).color,
                  borderRadius: '2px',
                  opacity: 0.7,
                }}
              />
              {isStackable && 'quantity' in item && item.quantity && item.quantity > 1 && (
                <div style={quantityBadgeStyle}>{item.quantity}</div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // =========================================================================
  // STATS SECTION
  // =========================================================================

  const statsTableStyle: React.CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  };

  const statsRowStyle: React.CSSProperties = {
    borderBottom: `1px solid ${theme.colors.border}`,
  };

  const statsCellStyle: React.CSSProperties = {
    padding: '6px 8px',
    textAlign: 'left',
    color: theme.colors.textSecondary,
  };

  const statsValueStyle: React.CSSProperties = {
    ...statsCellStyle,
    textAlign: 'right',
    fontWeight: 700,
    color: theme.colors.accent,
    fontFamily: theme.fonts.mono,
  };

  // Calculate total carried weight/value
  const totalValue = inventory.reduce((sum, item) => {
    const template = ITEM_TEMPLATES[item.itemId] || {};
    return sum + ((template as ItemTemplate).stackable ? 1 : 1);
  }, 0);

  return (
    <div style={containerStyle}>
      {/* EQUIPMENT SLOTS */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>⚔️ Equipment</div>
        {renderEquipmentSlots()}
      </div>

      {/* INVENTORY GRID */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>🎒 Inventory {selectedSlot ? `- ${EQUIPMENT_SLOT_NAMES[selectedSlot]}` : ''}</div>
        {renderInventoryGrid()}
      </div>

      {/* INVENTORY STATS */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>📊 Stats</div>
        <table style={statsTableStyle}>
          <tbody>
            <tr style={statsRowStyle}>
              <td style={statsCellStyle}>Total Slots</td>
              <td style={statsValueStyle}>{totalValue} / 20</td>
            </tr>
            <tr style={statsRowStyle}>
              <td style={statsCellStyle}>Gold</td>
              <td style={statsValueStyle}>{player.gold || 0}</td>
            </tr>
            <tr style={statsRowStyle}>
              <td style={statsCellStyle}>Equipped</td>
              <td style={statsValueStyle}>{Object.keys(equipment).length}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ReliquaryArmory;
