/**
 * Phase 44: Equipment Paper Doll Component
 *
 * Diegetic visual representation of the player's equipped gear
 * Changes aesthetic based on current narrative codec:
 * - Medieval: Hand-drawn sketch with charcoal markings
 * - Cyberpunk: Blue wireframe holographic schematic
 * - Noir: Physical description text on case file
 */

import React, { useMemo } from 'react';
import { themeManager } from '../services/themeManager';
import { getEchoDescriptions } from '../../engine/itemMutationEngine';
import type { NarrativeCodec } from '../services/themeManager';
import type { WorldState } from '../../engine/worldEngine';

interface EquipmentPaperDollProps {
  worldState?: WorldState;
  itemTemplates?: Record<string, any>;
  currentCodec?: NarrativeCodec;
  onItemClick?: (slot: string) => void;
}

interface EquipmentSlot {
  slot: string;
  itemId?: string;
  itemName?: string;
  echoes?: string[];
  genre?: string;
}

export default function EquipmentPaperDoll({
  worldState,
  itemTemplates = {},
  currentCodec,
  onItemClick
}: EquipmentPaperDollProps) {
  const codecName = currentCodec || (themeManager.getCodec() as NarrativeCodec);
  const player = worldState?.player;

  // Get equipped items
  const equippedSlots = useMemo<EquipmentSlot[]>(() => {
    if (!player?.equipment) return [];

    return [
      { slot: 'Head', itemId: player.equipment.head },
      { slot: 'Neck', itemId: player.equipment.neck },
      { slot: 'Chest', itemId: player.equipment.chest },
      { slot: 'Waist', itemId: player.equipment.waist },
      { slot: 'Back', itemId: player.equipment.back },
      { slot: 'Hands', itemId: player.equipment.hands },
      { slot: 'Legs', itemId: player.equipment.legs },
      { slot: 'Feet', itemId: player.equipment.feet },
      { slot: 'Main Hand', itemId: player.equipment.mainHand },
      { slot: 'Off Hand', itemId: player.equipment.offHand },
      { slot: 'Ring 1', itemId: player.equipment.ring1 },
      { slot: 'Ring 2', itemId: player.equipment.ring2 },
      { slot: 'Ring 3', itemId: player.equipment.ring3 },
      { slot: 'Ring 4', itemId: player.equipment.ring4 }
    ].map(slot => {
      if (!slot.itemId) return slot;

      const template = itemTemplates[slot.itemId];
      const itemInstance = player.inventory?.find(
        inv => inv.kind === 'unique' && inv.itemId === slot.itemId
      );

      const echoes = (itemInstance as any)?.metadata?.echoes
        ? getEchoDescriptions(itemInstance as any)
        : [];

      return {
        ...slot,
        itemName: template?.name || 'Unknown Item',
        echoes,
        genre: template?.genre || 'high-fantasy'
      };
    });
  }, [player?.equipment, player?.inventory, itemTemplates]);

  // Codec-specific styling
  const containerStyle = useMemo<React.CSSProperties>(() => {
    const base: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      padding: '12px',
      borderRadius: '6px',
      background: 'rgba(20, 20, 40, 0.5)',
      border: '1px solid rgba(139, 92, 246, 0.2)',
      backdropFilter: 'blur(2px)',
      fontSize: '12px'
    };

    if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        ...base,
        background: 'linear-gradient(135deg, rgba(244, 228, 188, 0.1), rgba(200, 180, 140, 0.05))',
        border: '1px solid rgba(139, 99, 45, 0.4)',
        fontFamily: '"Crimson Text", serif',
        color: 'rgba(200, 180, 140, 0.9)'
      };
    } else if (codecName === 'CODENAME_CYBERPUNK' || codecName === 'CODENAME_GLITCH') {
      return {
        ...base,
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6), rgba(0, 255, 255, 0.05))',
        border: '1px solid rgba(0, 255, 255, 0.4)',
        color: 'rgba(0, 255, 255, 0.8)',
        fontFamily: '"Courier Prime", monospace',
        letterSpacing: '0.5px',
        boxShadow: '0 0 8px rgba(0, 255, 255, 0.2)'
      };
    } else if (codecName === 'CODENAME_NOIR') {
      return {
        ...base,
        background: 'linear-gradient(135deg, rgba(100, 80, 60, 0.1), rgba(60, 50, 40, 0.1))',
        border: '2px solid rgba(100, 80, 60, 0.4)',
        color: 'rgba(150, 130, 110, 0.9)',
        fontFamily: '"Courier Prime", monospace',
        letterSpacing: '0.5px'
      };
    }

    return base;
  }, [codecName]);

  // Slot row styling
  const slotStyle = useMemo<React.CSSProperties>(() => {
    return {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      padding: '8px',
      borderRadius: '4px',
      background: 'rgba(30, 30, 50, 0.4)',
      border: '1px solid rgba(139, 92, 246, 0.15)',
      cursor: 'pointer',
      transition: 'all 0.2s ease-out',
      userSelect: 'none'
    };
  }, []);

  // Slot label styling
  const labelStyle = useMemo<React.CSSProperties>(() => {
    if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        fontWeight: 600,
        color: 'rgba(139, 99, 45, 0.8)',
        minWidth: '70px',
        fontStyle: 'italic'
      };
    } else if (codecName === 'CODENAME_NOIR') {
      return {
        fontWeight: 700,
        color: 'rgba(100, 80, 60, 0.9)',
        minWidth: '70px',
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        fontSize: '11px'
      };
    }

    return {
      fontWeight: 600,
      color: 'rgba(139, 92, 246, 0.7)',
      minWidth: '70px'
    };
  }, [codecName]);

  // Item content styling
  const itemContentStyle = useMemo<React.CSSProperties>(() => {
    return {
      flex: 1,
      marginLeft: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    };
  }, []);

  // Item name styling
  const itemNameStyle = useMemo<React.CSSProperties>(() => {
    if (codecName === 'CODENAME_CYBERPUNK' || codecName === 'CODENAME_GLITCH') {
      return {
        fontWeight: 700,
        color: 'rgba(0, 255, 255, 0.9)',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '1px'
      };
    } else if (codecName === 'CODENAME_MEDIEVAL') {
      return {
        fontWeight: 700,
        color: 'rgba(180, 140, 80, 0.9)',
        fontSize: '11px',
        fontStyle: 'italic'
      };
    }

    return {
      fontWeight: 700,
      color: 'rgba(220, 200, 180, 0.9)',
      fontSize: '11px'
    };
  }, [codecName]);

  // Echoes list styling
  const echoesStyle = useMemo<React.CSSProperties>(() => {
    return {
      fontSize: '9px',
      color: 'rgba(168, 85, 247, 0.7)',
      fontStyle: 'italic',
      marginTop: '2px',
      maxHeight: '40px',
      overflowY: 'auto',
      paddingRight: '2px'
    };
  }, []);

  return (
    <div style={containerStyle}>
      {/* Title */}
      <div style={{
        fontSize: '13px',
        fontWeight: 700,
        color: codecName === 'CODENAME_NOIR'
          ? 'rgba(100, 80, 60, 0.9)'
          : 'rgba(139, 92, 246, 0.8)',
        textAlign: 'center',
        textTransform: codecName === 'CODENAME_NOIR' ? 'uppercase' : 'none',
        letterSpacing: codecName === 'CODENAME_NOIR' ? '1px' : 'normal',
        marginBottom: '4px'
      }}>
        {codecName === 'CODENAME_MEDIEVAL' && '⚔️ Gear'}
        {codecName === 'CODENAME_CYBERPUNK' && '[EQUIPMENT_MANIFEST]'}
        {codecName === 'CODENAME_GLITCH' && '[GLYPH_MATRIX]'}
        {codecName === 'CODENAME_NOIR' && 'CASE FILE: ARMAMENTS'}
        {!['CODENAME_MEDIEVAL', 'CODENAME_CYBERPUNK', 'CODENAME_GLITCH', 'CODENAME_NOIR'].includes(codecName) && '⚙️ Equipment'}
      </div>

      {/* Equipment slots */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {equippedSlots.map(slot => (
          <div
            key={slot.slot}
            onClick={() => onItemClick?.(slot.slot)}
            style={slotStyle}
            onMouseEnter={e => {
              if (e.currentTarget && slot.itemId) {
                (e.currentTarget as HTMLElement).style.background =
                  codecName === 'CODENAME_CYBERPUNK' || codecName === 'CODENAME_GLITCH'
                    ? 'rgba(0, 255, 255, 0.1)'
                    : 'rgba(139, 92, 246, 0.15)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  codecName === 'CODENAME_CYBERPUNK' || codecName === 'CODENAME_GLITCH'
                    ? '0 0 8px rgba(0, 255, 255, 0.3)'
                    : '0 0 6px rgba(139, 92, 246, 0.2)';
              }
            }}
            onMouseLeave={e => {
              if (e.currentTarget) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(30, 30, 50, 0.4)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }
            }}
          >
            {/* Slot label */}
            <span style={labelStyle}>{slot.slot}</span>

            {/* Item info or empty state */}
            {slot.itemId ? (
              <div style={itemContentStyle}>
                <div style={itemNameStyle}>{slot.itemName}</div>
                {slot.echoes && slot.echoes.length > 0 && (
                  <div style={echoesStyle}>
                    {slot.echoes.map((echo, i) => (
                      <div key={i}>{echo}</div>
                    ))}
                  </div>
                )}
                {codecName === 'CODENAME_CYBERPUNK' && (
                  <div style={{
                    fontSize: '8px',
                    color: 'rgba(0, 200, 200, 0.5)',
                    marginTop: '2px'
                  }}>
                    [GENRE:{slot.genre.toUpperCase()}]
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                flex: 1,
                marginLeft: '12px',
                color: 'rgba(139, 92, 246, 0.3)',
                fontSize: '10px',
                fontStyle: 'italic'
              }}>
                {codecName === 'CODENAME_MEDIEVAL' && 'Empty slot'}
                {codecName === 'CODENAME_CYBERPUNK' && '[NO_DEVICE_EQUIPPED]'}
                {codecName === 'CODENAME_NOIR' && '[NONE ON FILE]'}
                {!['CODENAME_MEDIEVAL', 'CODENAME_CYBERPUNK', 'CODENAME_NOIR'].includes(codecName) && 'Empty'}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer: Resonance indicator */}
      <div style={{
        marginTop: '8px',
        paddingTop: '8px',
        borderTop: '1px solid rgba(139, 92, 246, 0.15)',
        fontSize: '9px',
        color: 'rgba(139, 92, 246, 0.5)',
        textAlign: 'center',
        fontStyle: 'italic'
      }}>
        {codecName === 'CODENAME_MEDIEVAL' && '⚡ Resonance syncs with world'}
        {codecName === 'CODENAME_CYBERPUNK' && '[CODEC_RESONANCE_ACTIVE]'}
        {codecName === 'CODENAME_NOIR' && '[matching evidence found]'}
        {!['CODENAME_MEDIEVAL', 'CODENAME_CYBERPUNK', 'CODENAME_NOIR'].includes(codecName) && 'Codec Resonance: Check items for bonuses'}
      </div>
    </div>
  );
}
