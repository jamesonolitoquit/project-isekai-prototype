import React, { useMemo } from 'react';
import styles from '../../styles/diegetic.module.css';

interface InventoryPanelProps {
  state?: any;
  onPickupItem?: (itemId: string, quantity: number) => void;
  onDropItem?: (itemId: string, quantity: number) => void;
  onEquipItem?: (itemId: string) => void;
  onUnequipItem?: (slot: string) => void;
  onUseItem?: (itemId: string) => void;
}

// Simplified item database (would normally load from items.json)
const ITEM_TEMPLATES: Record<string, any> = {
  'healing-potion-minor': { name: 'Minor Healing Potion', type: 'consumable', rarity: 'common', color: '#ffcccc' },
  'healing-potion-major': { name: 'Major Healing Potion', type: 'consumable', rarity: 'rare', color: '#ff9999' },
  'stamina-tonic': { name: 'Stamina Tonic', type: 'consumable', rarity: 'uncommon', color: '#ccffcc' },
  'rare-herb': { name: 'Rare Luminous Herb', type: 'material', rarity: 'uncommon', color: '#ffff99' },
  'iron-ore': { name: 'Iron Ore', type: 'material', rarity: 'common', color: '#999999' },
  'copper-ingot': { name: 'Copper Ingot', type: 'material', rarity: 'common', color: '#cc9966' },
  'morph-essence': { name: 'Beastkin Essence', type: 'material', rarity: 'uncommon', color: '#ff99ff' },
  'rusty-sword': { name: 'Rusty Iron Sword', type: 'weapon', rarity: 'common', color: '#999999', slot: 'mainHand' },
  'steel-sword': { name: 'Steel Longsword', type: 'weapon', rarity: 'uncommon', color: '#ccccff', slot: 'mainHand' },
  'steel-buckler': { name: 'Steel Buckler', type: 'armor', rarity: 'uncommon', color: '#aaaaaa', slot: 'offHand' },
  'iron-breastplate': { name: 'Iron Breastplate', type: 'armor', rarity: 'uncommon', color: '#777777', slot: 'chest' },
  'leather-boots': { name: 'Leather Boots', type: 'armor', rarity: 'common', color: '#8b6914', slot: 'feet' },
};

export default function InventoryPanel({ state, onPickupItem, onDropItem, onEquipItem, onUseItem }: InventoryPanelProps) {
  const inventory = Array.isArray(state?.player?.inventory) ? state.player.inventory : [];
  const equipment = state?.player?.equipment || {};
  const gold = state?.player?.gold ?? 0;

  const categorizedInventory = useMemo(() => {
    const categories: Record<string, any[]> = {
      consumable: [],
      weapon: [],
      armor: [],
      material: [],
      other: []
    };

    inventory.forEach((item: any) => {
      const template = ITEM_TEMPLATES[item.itemId] || { name: item.itemId, type: 'other', rarity: 'common' };
      const category = template.type || 'other';
      if (!categories[category]) categories[category] = [];
      categories[category].push({ ...item, template });
    });

    return categories;
  }, [inventory]);

  const renderItem = (item: any, idx: number) => {
    const template = item.template || ITEM_TEMPLATES[item.itemId];
    if (!template) return null;

    const rarityColor: Record<string, string> = {
      common: '#888888',
      uncommon: '#22aa22',
      rare: '#2222ff',
      epic: '#cc22cc',
    };

    const isEquipped = Object.values(equipment).includes(item.itemId);

    return (
      <div
        key={idx}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px',
          backgroundColor: isEquipped ? '#3d2b1f' : '#2a1f3d',
          borderLeft: `3px solid ${rarityColor[template.rarity] || '#888'}`,
          borderRadius: 2,
          marginBottom: 4,
          fontSize: 12,
          color: '#d4af37',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', color: '#f5deb3' }}>{template.name}</div>
          <div style={{ fontSize: 11, opacity: 0.6, color: '#999' }}>
            {template.type} {template.rarity && `(${template.rarity})`}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 30, textAlign: 'center', fontWeight: 'bold', color: '#d4af37' }}>
            {item.quantity}x
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {template.type === 'consumable' && (
              <button
                onClick={() => onUseItem?.(item.itemId)}
                style={{ 
                  fontSize: 11, 
                  padding: 4, 
                  backgroundColor: '#8b7355',
                  color: '#f5deb3',
                  border: 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Use
              </button>
            )}
            {(template.type === 'weapon' || template.type === 'armor') && (
              <button
                onClick={() => onEquipItem?.(item.itemId)}
                style={{
                  fontSize: 11,
                  padding: 4,
                  backgroundColor: isEquipped ? '#6b5d3f' : '#8b7355',
                  color: isEquipped ? '#ffff99' : '#f5deb3',
                  border: isEquipped ? '1px solid #ffff99' : 'none',
                  borderRadius: 2,
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {isEquipped ? 'Unequip' : 'Equip'}
              </button>
            )}
            <button
              onClick={() => onDropItem?.(item.itemId, 1)}
              style={{ 
                fontSize: 11, 
                padding: 4, 
                backgroundColor: '#5a3a3a',
                color: '#ff9999',
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Drop
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className={`${styles.panelWood} ${styles.elevation2}`}
      style={{ 
        padding: '12px',
        fontSize: '13px',
        transform: 'translateZ(20px)',
        transformStyle: 'preserve-3d',
      }}
    >
      <h3 className={styles.panelWoodHeader} style={{ marginTop: 0 }}>🎒 Inventory</h3>

      <div style={{ marginBottom: 12, padding: 8, borderRadius: 4 }}>
        <div style={{ color: '#8b7355', fontWeight: 'bold' }}><strong>💰 Gold:</strong> {gold}</div>
        <div style={{ fontSize: 11, opacity: 0.8, color: '#c9a961' }}>
          Total Items: {inventory.reduce((sum: number, item: any) => sum + item.quantity, 0)}
        </div>
      </div>

      {/* Equipment Slots */}
      <div style={{ marginBottom: 12, paddingTop: 8 }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#d4af37', fontSize: '14px', fontWeight: 'bold' }}>⚔️ Equipped</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {['mainHand', 'offHand', 'chest', 'head', 'feet', 'accessory'].map((slot) => {
            const itemId = (equipment as any)[slot];
            const template = itemId ? ITEM_TEMPLATES[itemId] : null;
            return (
              <div
                key={slot}
                style={{
                  padding: 8,
                  backgroundColor: itemId ? '#2a1f3d' : '#3a2f1a',
                  borderRadius: 4,
                  border: itemId ? '1px solid #d4af37' : '1px solid #8b7355',
                  minHeight: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  color: '#d4af37'
                }}
              >
                <div style={{ fontSize: 10, opacity: 0.6, marginBottom: 4, color: '#999' }}>
                  {slot}
                </div>
                {template ? (
                  <div style={{ fontWeight: 'bold', fontSize: 11, color: '#d4af37' }}>{template.name}</div>
                ) : (
                  <div style={{ opacity: 0.5, fontSize: 11, color: '#666' }}>Empty</div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Inventory Categories */}
      {['consumable', 'weapon', 'armor', 'material'].map((category) => {
        const items = categorizedInventory[category] || [];
        if (items.length === 0) return null;

        const categoryLabels: Record<string, string> = {
          consumable: '🧪 Consumables',
          weapon: '⚔️ Weapons',
          armor: '🛡️ Armor',
          material: '🔨 Materials',
        };

        return (
          <div key={category} style={{ marginBottom: 12 }}>
            <h4 style={{ margin: '8px 0 4px 0', color: '#d4af37', fontSize: '13px' }}>{categoryLabels[category] || category}</h4>
            <div style={{ borderLeft: '3px solid #8b7355', paddingLeft: 8 }}>
              {items.map((item: any, idx: number) => renderItem(item, idx))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
