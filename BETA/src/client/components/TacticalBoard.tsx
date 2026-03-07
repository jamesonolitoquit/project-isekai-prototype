/**
 * TacticalBoard.tsx — Phase 45: Living Tactical Board
 * 
 * Renders a 64x64px isometric grid overlay on the tabletop.
 * Each tile can be searched, harvested, or destroyed.
 * Supports codec-aware material styling and tile-specific environmental particles.
 */

import React, { useState, useRef, useEffect } from 'react';
import type { Location, WorldState } from '../../engine/worldEngine';
import type { NarrativeCodec } from '../services/themeManager';

interface TacticalBoardProps {
  worldState: WorldState;
  currentCodec: NarrativeCodec;
  onTileSelect?: (location: Location, tileX: number, tileY: number) => void;
  onTileAction?: (action: 'SEARCH' | 'HARVEST' | 'INTERACT', location: Location, tileX: number, tileY: number) => void;
  cameraRotation?: number; // 0-360 degrees for board rotation
  scale?: number; // Zoom level
}

/**
 * Codec-specific tile material styling
 */
const getTileMaterial = (codec: NarrativeCodec, biome: string) => {
  const codecMap: Record<string, string> = {
    'CODENAME_MEDIEVAL': 'medieval',
    'CODENAME_CYBERPUNK': 'cyber',
    'CODENAME_NOIR': 'noir',
    'CODENAME_GLITCH': 'glitch',
    'CODENAME_STORYBOOK': 'fantasy',
    'default': 'default'
  };

  const mappedCodec = codecMap[codec] || 'default';
  const materials: Record<string, Record<string, any>> = {
    'medieval': {
      'forest': { fill: '#2d5016', stroke: '#1a3d0f', pattern: '🌲', material: 'Wood & Soil' },
      'cave': { fill: '#4a4a4a', stroke: '#2a2a2a', pattern: '🪨', material: 'Stone Cavern' },
      'village': { fill: '#8b7355', stroke: '#6b5344', pattern: '🏘️', material: 'Wooden Palisade' },
      'corrupted': { fill: '#3d1a3d', stroke: '#2a0a2a', pattern: '☠️', material: 'Cursed Ground' },
      'shrine': { fill: '#d4af37', stroke: '#a0860f', pattern: '✨', material: 'Sacred Stone' },
      'maritime': { fill: '#1e4d8b', stroke: '#0f2d5b', pattern: '⚓', material: 'Sandy Shore' },
      'mountain': { fill: '#6b5d5d', stroke: '#4a4a4a', pattern: '⛰️', material: 'Rock Face' },
      'plains': { fill: '#8b9d3d', stroke: '#6b7d1d', pattern: '🌾', material: 'Grassland' }
    },
    'cyber': {
      'forest': { fill: '#00ff41', stroke: '#00cc34', pattern: '▲', material: 'Neon Data Grove' },
      'cave': { fill: '#0a0a4a', stroke: '#050520', pattern: '◆', material: 'Void Nexus' },
      'village': { fill: '#00ccff', stroke: '#0099cc', pattern: '◾', material: 'Cyan Grid' },
      'corrupted': { fill: '#ff0080', stroke: '#cc0066', pattern: '✕', material: 'Glitch Zone' },
      'shrine': { fill: '#ffff00', stroke: '#cccc00', pattern: '◈', material: 'Golden Nexus' },
      'maritime': { fill: '#0080ff', stroke: '#0066cc', pattern: '◢', material: 'Liquid Crystal' },
      'mountain': { fill: '#cccccc', stroke: '#999999', pattern: '▲', material: 'Chrome Peak' },
      'plains': { fill: '#00ff88', stroke: '#00cc66', pattern: '▪', material: 'Neon Field' }
    },
    'noir': {
      'forest': { fill: '#2a2a2a', stroke: '#1a1a1a', pattern: '◆', material: 'Dark Woods' },
      'cave': { fill: '#1a1a1a', stroke: '#0f0f0f', pattern: '▓', material: 'Pitch Black' },
      'village': { fill: '#4a4a4a', stroke: '#3a3a3a', pattern: '■', material: 'Rain-Soaked City' },
      'corrupted': { fill: '#660000', stroke: '#440000', pattern: '×', material: 'Blood Stain' },
      'shrine': { fill: '#8a7a6a', stroke: '#6a5a4a', pattern: '●', material: 'Stone Temple' },
      'maritime': { fill: '#3a6a8a', stroke: '#2a4a6a', pattern: '≈', material: 'Misty Harbor' },
      'mountain': { fill: '#5a5a5a', stroke: '#3a3a3a', pattern: '△', material: 'Granite Ridge' },
      'plains': { fill: '#6a6a6a', stroke: '#4a4a4a', pattern: '‧', material: 'Asphalt Desert' }
    },
    'glitch': {
      'forest': { fill: '#00ff00', stroke: '#00aa00', pattern: '▲', material: 'Pixelated Wood' },
      'cave': { fill: '#1a1a5a', stroke: '#0f0f3a', pattern: '▓', material: 'Digital Void' },
      'village': { fill: '#ffff00', stroke: '#aaaa00', pattern: '▬', material: 'Glitch Town' },
      'corrupted': { fill: '#ff00ff', stroke: '#cc00cc', pattern: '▮', material: 'Purple Corruption' },
      'shrine': { fill: '#ff00ff', stroke: '#ff0000', pattern: '◆', material: 'Fractured Sacred' },
      'maritime': { fill: '#00ffff', stroke: '#00aaaa', pattern: '≈', material: 'Cyan Waters' },
      'mountain': { fill: '#ffaaff', stroke: '#cc00ff', pattern: 'Λ', material: 'Neon-Topped Peak' },
      'plains': { fill: '#00ff00', stroke: '#00cc00', pattern: '▪', material: 'Green Grid' }
    },
    'fantasy': {
      'forest': { fill: '#228b22', stroke: '#1a6b1a', pattern: '🌲', material: 'Enchanted Woods' },
      'cave': { fill: '#4a3d5c', stroke: '#3a2d4c', pattern: '≈', material: 'Mystical Cavern' },
      'village': { fill: '#9daa6b', stroke: '#7d8a4b', pattern: '▪', material: 'Fantasy Settlement' },
      'corrupted': { fill: '#8b008b', stroke: '#6b006b', pattern: '✕', material: 'Magical Corruption' },
      'shrine': { fill: '#ffd700', stroke: '#ffaa00', pattern: '✦', material: 'Arcane Shrine' },
      'maritime': { fill: '#4169e1', stroke: '#1e3a8a', pattern: '⚓', material: 'Mystical Strait' },
      'mountain': { fill: '#8b7d6b', stroke: '#6b5d4b', pattern: '▲', material: 'Wizard Peak' },
      'plains': { fill: '#daa520', stroke: '#cd853f', pattern: '✦', material: 'Golden Field' }
    },
    'default': {
      'forest': { fill: '#228b22', stroke: '#1a6b1a', pattern: '▲', material: 'Forest' },
      'cave': { fill: '#4a4a4a', stroke: '#2a2a2a', pattern: '◆', material: 'Cave' },
      'village': { fill: '#9daa6b', stroke: '#7d8a4b', pattern: '▪', material: 'Village' },
      'corrupted': { fill: '#8b008b', stroke: '#6b006b', pattern: '✕', material: 'Corrupted' },
      'shrine': { fill: '#ffd700', stroke: '#ffaa00', pattern: '✦', material: 'Shrine' },
      'maritime': { fill: '#4169e1', stroke: '#1e3a8a', pattern: '≈', material: 'Maritime' },
      'mountain': { fill: '#8b7d6b', stroke: '#6b5d4b', pattern: '▲', material: 'Mountain' },
      'plains': { fill: '#daa520', stroke: '#cd853f', pattern: '●', material: 'Plains' }
    }
  };

  return materials[mappedCodec][biome] || materials['default']['plains'];
};

/**
 * Get nearby locations as tiles for the tactical board
 */
function getTacticalTiles(worldState: WorldState): Array<Location & { tileX: number; tileY: number }> {
  const locations = worldState.locations || [];
  
  // Convert location coordinates to tile grid
  return locations.slice(0, 25).map((loc, idx) => ({
    ...loc,
    tileX: (loc.x || idx % 5) / 200, // Normalized to 5x5 grid
    tileY: (loc.y || Math.floor(idx / 5)) / 200
  }));
}

/**
 * Draw isometric tile at screen position
 */
function drawIsometricTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tileSize: number,
  fill: string,
  stroke: string,
  pattern: string,
  isSelected: boolean,
  isHovered: boolean
) {
  // Isometric diamond shape: 2:1 ratio
  const halfWidth = tileSize / 2;
  const halfHeight = tileSize / 4;

  ctx.beginPath();
  ctx.moveTo(x, y - halfHeight); // Top
  ctx.lineTo(x + halfWidth, y); // Right
  ctx.lineTo(x, y + halfHeight); // Bottom
  ctx.lineTo(x - halfWidth, y); // Left
  ctx.closePath();

  // Fill with base color
  ctx.fillStyle = isSelected ? '#ffcc00' : (isHovered ? '#ffff88' : fill);
  ctx.fill();

  // Stroke
  ctx.strokeStyle = isSelected ? '#ffaa00' : stroke;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  // Pattern text (biome indicator)
  ctx.fillStyle = isSelected ? '#000000' : 'rgba(255, 255, 255, 0.4)';
  ctx.font = `8px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(pattern, x, y);

  // Scar indicator if applicable
  if (isSelected && pattern !== '░') {
    ctx.fillStyle = 'rgba(255, 200, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(x + halfWidth * 0.6, y - halfHeight * 0.6, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const TacticalBoard: React.FC<TacticalBoardProps> = ({
  worldState,
  currentCodec,
  onTileSelect,
  onTileAction,
  cameraRotation = 0,
  scale = 1
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTile, setSelectedTile] = useState<{ tileX: number; tileY: number } | null>(null);
  const [hoveredTile, setHoveredTile] = useState<{ tileX: number; tileY: number } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const tiles = getTacticalTiles(worldState);
  const tileSize = 64 * scale;

  /**
   * Render the isometric grid
   * Phase 45-A2: Painter's Algorithm - sort tiles by (row + col) to eliminate Z-fighting
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = 'rgba(10, 10, 20, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Phase 45-A2: Sort tiles by depth (row + col) - Painter's Algorithm to prevent Z-fighting
    const sortedTileIndices = tiles
      .map((_, idx) => idx)
      .sort((a, b) => {
        const rowA = a % 5;
        const colA = Math.floor(a / 5);
        const rowB = b % 5;
        const colB = Math.floor(b / 5);
        return (rowA + colA) - (rowB + colB);
      });

    // First pass: Draw all base tiles
    sortedTileIndices.forEach((idx) => {
      const tile = tiles[idx];
      const row = idx % 5;
      const col = Math.floor(idx / 5);

      // Isometric projection: convert grid coords to screen coords
      const screenX = centerX + (row - col) * (tileSize / 2) * Math.cos(cameraRotation * Math.PI / 180);
      const screenY = centerY + (row + col) * (tileSize / 4);

      const material = getTileMaterial(currentCodec, tile.biome || 'plains');
      const isSelected = selectedTile?.tileX === row && selectedTile?.tileY === col;
      const isHovered = hoveredTile?.tileX === row && hoveredTile?.tileY === col;

      drawIsometricTile(
        ctx,
        screenX,
        screenY,
        tileSize,
        material.fill,
        material.stroke,
        material.pattern,
        isSelected,
        isHovered
      );
    });

    // Second pass: Draw status overlays (Scar/Selection layers) with 2px translateZ simulation
    ctx.save();
    ctx.shadowBlur = 2;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    
    sortedTileIndices.forEach((idx) => {
      const isSelected = selectedTile?.tileX === (idx % 5) && selectedTile?.tileY === Math.floor(idx / 5);
      const isHovered = hoveredTile?.tileX === (idx % 5) && hoveredTile?.tileY === Math.floor(idx / 5);
      
      if (isSelected || isHovered) {
        const row = idx % 5;
        const col = Math.floor(idx / 5);
        const screenX = centerX + (row - col) * (tileSize / 2) * Math.cos(cameraRotation * Math.PI / 180);
        const screenY = centerY + (row + col) * (tileSize / 4);
        
        const halfWidth = tileSize / 2;
        const halfHeight = tileSize / 4;
        
        // Draw selection highlight with depth illusion
        ctx.fillStyle = isSelected ? 'rgba(255, 255, 0, 0.3)' : 'rgba(255, 255, 136, 0.2)';
        ctx.beginPath();
        ctx.moveTo(screenX, screenY - halfHeight);
        ctx.lineTo(screenX + halfWidth, screenY);
        ctx.lineTo(screenX, screenY + halfHeight);
        ctx.lineTo(screenX - halfWidth, screenY);
        ctx.closePath();
        ctx.fill();
      }
    });
    
    ctx.restore();
  }, [tiles, currentCodec, cameraRotation, scale, selectedTile, hoveredTile]);

  /**
   * Handle mouse move for hover and rotation preview
   */
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Simple hover detection (approximate)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let nearestTile: { tileX: number; tileY: number } | null = null;
    let minDist = Infinity;

    tiles.forEach((_, idx) => {
      const row = idx % 5;
      const col = Math.floor(idx / 5);
      const screenX = centerX + (row - col) * (tileSize / 2);
      const screenY = centerY + (row + col) * (tileSize / 4);

      const dist = Math.sqrt((x - screenX) ** 2 + (y - screenY) ** 2);
      if (dist < tileSize * 0.3 && dist < minDist) {
        minDist = dist;
        nearestTile = { tileX: row, tileY: col };
      }
    });

    setHoveredTile(nearestTile);
  };

  /**
   * Handle tile selection and context menu
   */
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Left click: select tile
    if (e.button === 0) {
      if (hoveredTile) {
        setSelectedTile(hoveredTile);
        const selectedTileData = tiles[hoveredTile.tileY * 5 + hoveredTile.tileX];
        onTileSelect?.(selectedTileData, hoveredTile.tileX, hoveredTile.tileY);
      }
    }
    // Right click: context menu
    else if (e.button === 2) {
      e.preventDefault();
      if (hoveredTile) {
        setContextMenu({ x: e.clientX, y: e.clientY });
      }
    }
  };

  /**
   * Handle spatial action selection
   */
  const handleAction = (action: 'SEARCH' | 'HARVEST' | 'INTERACT') => {
    if (selectedTile) {
      const selectedTileData = tiles[selectedTile.tileY * 5 + selectedTile.tileX];
      onTileAction?.(action, selectedTileData, selectedTile.tileX, selectedTile.tileY);
    }
    setContextMenu(null);
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: 'radial-gradient(ellipse at center, rgba(40,30,60,0.3) 0%, rgba(10,10,20,0.6) 100%)',
      borderRadius: '8px',
      overflow: 'hidden'
    }}>
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          cursor: hoveredTile ? 'pointer' : 'default'
        }}
        onMouseMove={handleMouseMove}
        onClick={handleCanvasClick}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Context menu for spatial actions */}
      {contextMenu && selectedTile && (
        <div
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            background: 'rgba(20, 10, 40, 0.95)',
            border: '2px solid rgba(139, 92, 246, 0.5)',
            borderRadius: '4px',
            padding: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onMouseLeave={() => setContextMenu(null)}
        >
          <button
            onClick={() => handleAction('SEARCH')}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              margin: '4px 0',
              background: 'rgba(139, 92, 246, 0.3)',
              border: '1px solid rgba(139, 92, 246, 0.5)',
              color: '#e6e6fa',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            🔍 Search
          </button>
          <button
            onClick={() => handleAction('HARVEST')}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              margin: '4px 0',
              background: 'rgba(34, 139, 34, 0.3)',
              border: '1px solid rgba(34, 139, 34, 0.5)',
              color: '#e6e6fa',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            ⛏️ Harvest
          </button>
          <button
            onClick={() => handleAction('INTERACT')}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px',
              margin: '4px 0',
              background: 'rgba(184, 134, 11, 0.3)',
              border: '1px solid rgba(184, 134, 11, 0.5)',
              color: '#e6e6fa',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }}
          >
            🔧 Interact
          </button>
        </div>
      )}

      {/* Tile info display */}
      {selectedTile && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(10, 10, 20, 0.8)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '11px',
            color: '#e6e6fa',
            backdropFilter: 'blur(4px)',
            maxWidth: '200px'
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>
            {tiles[selectedTile.tileY * 5 + selectedTile.tileX]?.name || 'Unknown Tile'}
          </div>
          <div style={{ opacity: 0.8 }}>
            {tiles[selectedTile.tileY * 5 + selectedTile.tileX]?.description || '...'}
          </div>
        </div>
      )}
    </div>
  );
};

export default TacticalBoard;
