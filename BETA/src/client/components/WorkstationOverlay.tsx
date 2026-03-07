/**
 * WorkstationOverlay.tsx - Phase 46: Diegetic Workstations
 * 
 * 3D-transformed overlay for interacting with crafting stations.
 * Supports "Blind Fusing" mechanic for discovering new recipes.
 * Codec-aware styling for visual immersion.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { NarrativeCodec } from '../services/themeManager';
import type { StackableItem } from '../../engine/worldEngine';

export interface WorkstationOverlayProps {
  isOpen: boolean;
  stationType: 'smithing' | 'alchemy' | 'weaving' | 'artifice' | 'terminal';
  quality: 'rusted' | 'standard' | 'masterwork' | 'legendary';
  bonusToRoll?: number;
  discoveryChance?: number;
  currentCodec: NarrativeCodec;
  playerInventory?: StackableItem[];
  onClose: () => void;
  onBlindFuse: (items: StackableItem[]) => void;
}

export const WorkstationOverlay: React.FC<WorkstationOverlayProps> = ({
  isOpen,
  stationType,
  quality,
  bonusToRoll = 0,
  discoveryChance = 0.1,
  currentCodec,
  playerInventory = [],
  onClose,
  onBlindFuse
}) => {
  const [fusingItems, setFusingItems] = useState<StackableItem[]>([]);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Get station metadata based on codec
  const getStationMetadata = () => {
    const metadata: Record<NarrativeCodec, { title: string; description: string; icon: string }> = {
      'CODENAME_MEDIEVAL': {
        title: 'Smithing Anvil',
        description: 'A weathered anvil rings as you approach. The metalsmith\'s spirit lingers here.',
        icon: '🔨'
      },
      'CODENAME_CYBERPUNK': {
        title: 'Hardware Terminal',
        description: 'Neon displays flicker. This node pulses with raw processing power.',
        icon: '⚙️'
      },
      'CODENAME_NOIR': {
        title: 'Workshop Counter',
        description: 'A worn table under a single bare bulb. Time to get to work.',
        icon: '🪑'
      },
      'CODENAME_GLITCH': {
        title: 'Fragment Processor',
        description: 'Reality warps around this strange machine. Something exists here... and elsewhere.',
        icon: '◆'
      },
      'CODENAME_STORYBOOK': {
        title: 'Enchantment Circle',
        description: 'Arcane runes shimmer. This is a place of great magic.',
        icon: '✨'
      },
      'CODENAME_MINIMAL': {
        title: 'Clean Workbench',
        description: 'Simple. Functional. Everything has its place.',
        icon: '■'
      },
      'CODENAME_SOLARPUNK': {
        title: 'Green Garden Workshop',
        description: 'Living plants grow around the workspace. Nature and craft intertwine.',
        icon: '🌿'
      },
      'CODENAME_VOIDSYNC': {
        title: 'Void Interface',
        description: 'You sense something vast. Something ancient. It watches your craft.',
        icon: '●'
      },
      'CODENAME_OVERLAND': {
        title: 'Caravan Workstation',
        description: 'Well-traveled merchants have scrawled recipes here over centuries.',
        icon: '🛤️'
      },
      'CODENAME_VINTAGE': {
        title: 'Steampunk Forge',
        description: 'Brass gears turn methodically. Steam hisses from forgotten pipes.',
        icon: '⚡'
      },
      'CODENAME_DREAMSCAPE': {
        title: 'Twilight Atelier',
        description: 'The air shimmers between sleep and waking. Imagination becomes substance here.',
        icon: '🌙'
      }
    };

    return metadata[currentCodec] || metadata['CODENAME_MEDIEVAL'];
  };

  // Get station styling based on codec
  const getStationStyle = (): React.CSSProperties => {
    const styles: Record<NarrativeCodec, React.CSSProperties> = {
      'CODENAME_MEDIEVAL': {
        backgroundColor: '#3d2817',
        border: '4px solid #8b7355',
        boxShadow: '0 8px 20px rgba(139, 115, 85, 0.5), inset 0 1px 0px rgba(255,255,255,0.1)',
        color: '#f5deb3',
        fontFamily: 'Georgia, serif'
      },
      'CODENAME_CYBERPUNK': {
        backgroundColor: '#0a0a0a',
        border: '2px solid #00ff41',
        boxShadow: '0 0 20px rgba(0, 255, 65, 0.4), inset 0 0 20px rgba(0, 255, 65, 0.1)',
        color: '#00ff41',
        fontFamily: 'monospace',
        textShadow: '0 0 10px rgba(0, 255, 65, 0.5)'
      },
      'CODENAME_NOIR': {
        backgroundColor: '#2a2a2a',
        border: '3px dashed #8a7a6a',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.7)',
        color: '#d3d3d3',
        fontFamily: 'Courier New, monospace',
        textTransform: 'uppercase',
        letterSpacing: '2px'
      },
      'CODENAME_GLITCH': {
        backgroundColor: '#1a001a',
        border: '2px solid #ff00ff',
        boxShadow: '0 0 15px rgba(255, 0, 255, 0.6), 2px 2px 0px #ff00ff, -2px -2px 0px #00ffff',
        color: '#ff00ff',
        fontFamily: 'monospace',
        textShadow: '2px 2px 0px #00ffff'
      },
      'CODENAME_STORYBOOK': {
        backgroundColor: '#8b6914',
        border: '4px solid #d4af37',
        boxShadow: '0 8px 20px rgba(212, 175, 55, 0.3), inset 0 0 15px rgba(212, 175, 55, 0.1)',
        color: '#fff8dc',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic'
      },
      'CODENAME_MINIMAL': {
        backgroundColor: '#f5f5f5',
        border: '1px solid #999999',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        color: '#333333',
        fontFamily: 'Arial, sans-serif'
      },
      'CODENAME_SOLARPUNK': {
        backgroundColor: '#1a5c3a',
        border: '3px solid #00b050',
        boxShadow: '0 0 20px rgba(0, 176, 80, 0.3), inset 0 1px 0px rgba(255,255,255,0.2)',
        color: '#d4f1d4',
        fontFamily: 'Verdana, sans-serif'
      },
      'CODENAME_VOIDSYNC': {
        backgroundColor: '#001a33',
        border: '2px solid #6600ff',
        boxShadow: '0 0 20px rgba(102, 0, 255, 0.4), inset 0 0 20px rgba(102, 0, 255, 0.05)',
        color: '#cc99ff',
        fontFamily: 'monospace'
      },
      'CODENAME_OVERLAND': {
        backgroundColor: '#4a3a2a',
        border: '3px solid #8b6914',
        boxShadow: '0 4px 12px rgba(139, 105, 20, 0.3)',
        color: '#deb887',
        fontFamily: 'Georgia, serif'
      },
      'CODENAME_VINTAGE': {
        backgroundColor: '#3a3a2a',
        border: '3px solid #cd853f',
        boxShadow: '0 4px 15px rgba(205, 133, 63, 0.3)',
        color: '#f5deb3',
        fontFamily: 'Georgia, serif'
      },
      'CODENAME_DREAMSCAPE': {
        backgroundColor: '#2a1a4a',
        border: '2px solid #b19cd9',
        boxShadow: '0 0 20px rgba(177, 156, 217, 0.3), inset 0 1px 10px rgba(200, 150, 255, 0.1)',
        color: '#e6ccff',
        fontFamily: 'Georgia, serif',
        fontStyle: 'italic'
      }
    };

    return styles[currentCodec] || styles['CODENAME_MEDIEVAL'];
  };

  const getQualityColor = (): string => {
    const colors: Record<string, string> = {
      'rusted': '#8b4513',
      'standard': '#a9a9a9',
      'masterwork': '#daa520',
      'legendary': '#ffd700'
    };
    return colors[quality] || '#a9a9a9';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dropZoneRef.current) {
      dropZoneRef.current.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    }
  };

  const handleDragLeave = () => {
    if (dropZoneRef.current) {
      dropZoneRef.current.style.backgroundColor = '';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleDragLeave();
    
    const itemId = e.dataTransfer.getData('itemId');
    const item = playerInventory?.find(i => i.itemId === itemId && i.kind === 'stackable') as StackableItem | undefined;
    
    if (item && fusingItems.length < 5) {
      setFusingItems([...fusingItems, item]);
    }
  };

  const handleRemoveItem = (index: number) => {
    setFusingItems(fusingItems.filter((_, i) => i !== index));
  };

  const handleSynthesize = () => {
    if (fusingItems.length >= 2 && fusingItems.length <= 5) {
      onBlindFuse(fusingItems);
      setFusingItems([]);
    }
  };

  const stationMeta = getStationMetadata();
  const stationStyle = getStationStyle();
  const qualityColor = getQualityColor();

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2100,
        perspective: '1200px'
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)'
        }}
        onClick={onClose}
      />

      {/* 3D Workstation Panel */}
      <div
        style={{
          ...stationStyle,
          position: 'relative',
          zIndex: 2101,
          width: '600px',
          maxHeight: '500px',
          padding: '30px',
          borderRadius: '8px',
          transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg)',
          animation: 'slideInCenter 0.4s ease-out',
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px',
            paddingBottom: '15px',
            borderBottom: `2px solid ${qualityColor}`
          }}
        >
          <div>
            <div
              style={{
                fontSize: '28px',
                marginRight: '10px',
                display: 'inline-block'
              }}
            >
              {stationMeta.icon}
            </div>
            <div style={{ display: 'inline-block' }}>
              <h2
                style={{
                  margin: '0 0 5px 0',
                  fontSize: '20px',
                  fontWeight: 'bold'
                }}
              >
                {stationMeta.title}
              </h2>
              <div
                style={{
                  fontSize: '12px',
                  opacity: 0.8,
                  color: qualityColor
                }}
              >
                {quality.toUpperCase()} QUALITY
                {bonusToRoll! > 0 && ` • +${bonusToRoll} TO ROLLS`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              fontSize: '24px',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = '0.7';
            }}
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div
          style={{
            marginBottom: '20px',
            fontSize: '13px',
            opacity: 0.85,
            fontStyle: 'italic'
          }}
        >
          {stationMeta.description}
        </div>

        {/* Blind Fusing Zone */}
        <div style={{ marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 'bold',
              marginBottom: '10px',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}
          >
            Blind Fusing Chamber
          </div>

          {/* Drop Zone */}
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: '2px dashed',
              borderColor: qualityColor,
              borderRadius: '6px',
              padding: '15px',
              minHeight: '80px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              alignItems: 'flex-start',
              alignContent: 'flex-start',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              transition: 'background-color 0.2s'
            }}
          >
            {fusingItems.length === 0 && (
              <div
                style={{
                  width: '100%',
                  textAlign: 'center',
                  opacity: 0.5,
                  padding: '20px 0'
                }}
              >
                Drag 2-5 items here to fuse
              </div>
            )}

            {fusingItems.map((item, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  border: `1px solid ${qualityColor}`,
                  borderRadius: '4px',
                  padding: '6px 10px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  userSelect: 'none'
                }}
                onClick={() => handleRemoveItem(index)}
                title="Click to remove"
              >
                <span>{item.itemId}</span>
                <span style={{ opacity: 0.6 }}>×</span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontSize: '11px',
              marginTop: '8px',
              opacity: 0.6
            }}
          >
            {fusingItems.length}/5 items selected
            {discoveryChance && discoveryChance > 0 && (
              <> • Discovery chance: {Math.round(discoveryChance * 100)}%</>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '10px',
            marginTop: '20px'
          }}
        >
          <button
            onClick={handleSynthesize}
            disabled={fusingItems.length < 2 || fusingItems.length > 5}
            style={{
              flex: 1,
              padding: '10px 15px',
              backgroundColor: fusingItems.length >= 2 && fusingItems.length <= 5 ? qualityColor : '#666666',
              color: fusingItems.length >= 2 && fusingItems.length <= 5 ? '#000000' : '#999999',
              border: `1px solid ${qualityColor}`,
              borderRadius: '4px',
              cursor: fusingItems.length >= 2 && fusingItems.length <= 5 ? 'pointer' : 'not-allowed',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '12px',
              letterSpacing: '1px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              if (fusingItems.length >= 2 && fusingItems.length <= 5) {
                (e.target as HTMLElement).style.opacity = '0.8';
              }
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = '1';
            }}
          >
            ⚡ Synthesize
          </button>

          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '10px 15px',
              backgroundColor: 'transparent',
              color: 'inherit',
              border: `1px solid ${qualityColor}`,
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              fontSize: '12px',
              letterSpacing: '1px',
              transition: 'all 0.2s',
              opacity: 0.7
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = '0.7';
            }}
          >
            Close
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideInCenter {
          from {
            opacity: 0;
            transform: perspective(1000px) rotateX(10deg) rotateY(0deg) scale(0.95);
          }
          to {
            opacity: 1;
            transform: perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1);
          }
        }
      `}</style>
    </div>
  );
};
