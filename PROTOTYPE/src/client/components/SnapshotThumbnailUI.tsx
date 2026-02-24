/**
 * M63-C: Snapshot Thumbnail UI Component
 * 
 * Displays checkpoint snapshots with:
 * - Visual thumbnail preview (epoch, tick, location, NPC positions)
 * - Note system for labeling snapshots
 * - Quick-load functionality
 * - Metadata display (time, entities, world state)
 */

import React, { useState } from 'react';

/**
 * Snapshot data structure
 */
export interface SnapshotData {
  id: string;
  epochId: string;
  tickCount: number;
  timestamp: number;
  playerLocation: { x: number; y: number };
  npcPositions: Array<{ name: string; faction: string; x: number; y: number }>;
  worldState: {
    paradoxLevel: number;
    activeMacroEvent: string | null;
    factionStatuses: Record<string, number>;
  };
  userNote: string;
  preview?: {
    mapImage?: string;  // Base64 encoded preview
    npcCount: number;
    factionCount: number;
    eventActive: boolean;
  };
}

/**
 * Snapshot Thumbnail Component
 */
export interface SnapshotThumbnailProps {
  snapshot: SnapshotData;
  onSelect: (snapshot: SnapshotData) => void;
  onDelete: (snapshotId: string) => void;
  onUpdateNote: (snapshotId: string, note: string) => void;
  isSelected?: boolean;
}

export const SnapshotThumbnail: React.FC<SnapshotThumbnailProps> = ({
  snapshot,
  onSelect,
  onDelete,
  onUpdateNote,
  isSelected = false
}) => {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [newNote, setNewNote] = useState(snapshot.userNote);

  const handleSaveNote = () => {
    onUpdateNote(snapshot.id, newNote);
    setIsEditingNote(false);
  };

  const containerStyle: React.CSSProperties = {
    border: isSelected ? '2px solid #FFD700' : '1px solid #444',
    borderRadius: '8px',
    padding: '12px',
    backgroundColor: '#1a1a2e',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    margin: '8px',
    minWidth: '280px',
    position: 'relative'
  };

  const previewStyle: React.CSSProperties = {
    width: '100%',
    height: '140px',
    backgroundColor: '#0f0f1e',
    borderRadius: '6px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#888',
    position: 'relative',
    overflow: 'hidden'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
    fontSize: '13px'
  };

  const metadataStyle: React.CSSProperties = {
    fontSize: '11px',
    color: '#aaa',
    marginBottom: '6px',
    display: 'flex',
    gap: '12px'
  };

  const noteStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#ccc',
    fontStyle: 'italic',
    marginBottom: '8px',
    maxHeight: '40px',
    overflow: 'hidden',
    whiteSpace: 'pre-wrap'
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginTop: '8px'
  };

  const buttonStyle = (color: string): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: '11px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: color,
    color: '#000',
    fontWeight: 'bold',
    transition: 'opacity 0.2s ease'
  });

  const getNPCMarkers = () => {
    return snapshot.npcPositions.slice(0, 3).map((npc, idx) => {
      const colors: Record<string, string> = {
        'kingdom': '#FF6B6B',
        'merchants': '#4ECDC4',
        'outlaws': '#95E1D3',
        'scholar': '#FFE66D'
      };
      const color = colors[npc.faction] || '#888';
      return (
        <div
          key={idx}
          style={{
            position: 'absolute',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: color,
            left: `${(npc.x % 100) * 1.4}%`,
            top: `${(npc.y % 100) * 1.4}%`,
            opacity: 0.8
          }}
        />
      );
    });
  };

  const paradoxColor = snapshot.worldState.paradoxLevel > 200 
    ? '#FF6B6B' 
    : snapshot.worldState.paradoxLevel > 100 
      ? '#FFE66D' 
      : '#4ECDC4';

  return (
    <div
      style={containerStyle}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#FFD700';
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1f1f3a';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isSelected ? '#FFD700' : '#444';
        (e.currentTarget as HTMLDivElement).style.backgroundColor = '#1a1a2e';
      }}
    >
      {/* Preview Thumbnail */}
      <div style={previewStyle} onClick={() => onSelect(snapshot)}>
        {snapshot.preview?.mapImage ? (
          <img
            src={snapshot.preview.mapImage}
            alt="Snapshot preview"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            {/* Grid background */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(1px solid #333), linear-gradient(90deg, 1px solid #333)',
                backgroundSize: '20px 20px',
                opacity: 0.3
              }}
            />
            {/* NPC position markers */}
            {getNPCMarkers()}
            {/* Player location marker */}
            <div
              style={{
                position: 'absolute',
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#FFD700',
                left: `${(snapshot.playerLocation.x % 100) * 1.4}%`,
                top: `${(snapshot.playerLocation.y % 100) * 1.4}%`,
                border: '2px solid #FFA500',
                zIndex: 10
              }}
            />
            {/* Event indicator */}
            {snapshot.worldState.activeMacroEvent && (
              <div
                style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#FF6B6B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#000'
                }}
              >
                ⚠
              </div>
            )}
          </div>
        )}
      </div>

      {/* Header: Epoch + Tick */}
      <div style={headerStyle}>
        <span style={{ color: '#FFD700' }}>
          Epoch {snapshot.epochId} · T{snapshot.tickCount}
        </span>
        <span style={{ fontSize: '11px', color: '#888' }}>
          {new Date(snapshot.timestamp).toLocaleDateString()}
        </span>
      </div>

      {/* Metadata: NPCs, Factions, Paradox */}
      <div style={metadataStyle}>
        <span>👥 {snapshot.npcPositions.length} NPCs</span>
        <span>🏰 {Object.keys(snapshot.worldState.factionStatuses).length} Factions</span>
        <span style={{ color: paradoxColor }}>🌀 Paradox {snapshot.worldState.paradoxLevel}</span>
      </div>

      {/* User Note */}
      {isEditingNote ? (
        <div style={{ marginBottom: '8px' }}>
          <textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter snapshot note..."
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: '#0a0a14',
              border: '1px solid #FFD700',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '11px',
              fontFamily: 'monospace',
              minHeight: '50px',
              resize: 'vertical'
            }}
            maxLength={200}
          />
          <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>
            {newNote.length}/200
          </div>
        </div>
      ) : (
        <>
          {newNote && (
            <div style={noteStyle} onClick={() => setIsEditingNote(true)}>
              📝 {newNote}
            </div>
          )}
          {!newNote && (
            <div
              style={{
                fontSize: '11px',
                color: '#666',
                fontStyle: 'italic',
                marginBottom: '8px',
                cursor: 'pointer'
              }}
              onClick={() => setIsEditingNote(true)}
            >
              Click to add note...
            </div>
          )}
        </>
      )}

      {/* Action Buttons */}
      <div style={buttonGroupStyle}>
        {isEditingNote ? (
          <>
            <button
              onClick={handleSaveNote}
              style={{
                ...buttonStyle('#4ECDC4'),
                flex: 1
              }}
            >
              ✓ Save
            </button>
            <button
              onClick={() => {
                setNewNote(snapshot.userNote);
                setIsEditingNote(false);
              }}
              style={{
                ...buttonStyle('#666'),
                flex: 1
              }}
            >
              ✕ Cancel
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onSelect(snapshot)}
              style={{
                ...buttonStyle('#FFD700'),
                flex: 1
              }}
            >
              ⏱ Load
            </button>
            <button
              onClick={() => setIsEditingNote(true)}
              style={{
                ...buttonStyle('#888'),
                flex: 1
              }}
            >
              ✏ Note
            </button>
            <button
              onClick={() => onDelete(snapshot.id)}
              style={{
                ...buttonStyle('#FF6B6B'),
                flex: 1
              }}
            >
              🗑
            </button>
          </>
        )}
      </div>
    </div>
  );
};

/**
 * Snapshot Gallery Component - Display multiple snapshots
 */
export interface SnapshotGalleryProps {
  snapshots: SnapshotData[];
  onSelect: (snapshot: SnapshotData) => void;
  onDelete: (snapshotId: string) => void;
  onUpdateNote: (snapshotId: string, note: string) => void;
  selectedSnapshotId?: string;
}

export const SnapshotGallery: React.FC<SnapshotGalleryProps> = ({
  snapshots,
  onSelect,
  onDelete,
  onUpdateNote,
  selectedSnapshotId
}) => {
  const [sortBy, setSortBy] = useState<'recent' | 'tickCount' | 'paradox'>('recent');
  const [filterFaction, setFilterFaction] = useState<string | null>(null);

  const sortedSnapshots = [...snapshots].sort((a, b) => {
    switch (sortBy) {
      case 'recent':
        return b.timestamp - a.timestamp;
      case 'tickCount':
        return b.tickCount - a.tickCount;
      case 'paradox':
        return b.worldState.paradoxLevel - a.worldState.paradoxLevel;
      default:
        return 0;
    }
  });

  const filteredSnapshots = filterFaction
    ? sortedSnapshots.filter((s) =>
        Object.keys(s.worldState.factionStatuses).includes(filterFaction)
      )
    : sortedSnapshots;

  const galleryStyle: React.CSSProperties = {
    backgroundColor: '#0a0a14',
    borderRadius: '8px',
    padding: '16px',
    border: '1px solid #333'
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
    borderBottom: '1px solid #333',
    paddingBottom: '12px'
  };

  const controlsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '12px'
  };

  const selectStyle: React.CSSProperties = {
    padding: '6px 10px',
    backgroundColor: '#1a1a2e',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer'
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0'
  };

  return (
    <div style={galleryStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ margin: 0, color: '#FFD700' }}>
          📸 World Snapshots ({filteredSnapshots.length})
        </h3>
        <div style={controlsStyle}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={selectStyle}
          >
            <option value="recent">Sort: Recent</option>
            <option value="tickCount">Sort: Tick Count</option>
            <option value="paradox">Sort: Paradox Level</option>
          </select>
          <select
            value={filterFaction || ''}
            onChange={(e) => setFilterFaction(e.target.value || null)}
            style={selectStyle}
          >
            <option value="">Filter: All Factions</option>
            {Array.from(
              new Set(
                snapshots.flatMap((s) => Object.keys(s.worldState.factionStatuses))
              )
            ).map((faction) => (
              <option key={faction} value={faction}>
                Filter: {faction}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Snapshots Grid */}
      <div style={containerStyle}>
        {filteredSnapshots.length > 0 ? (
          filteredSnapshots.map((snapshot) => (
            <div key={snapshot.id} style={{ flex: '0 1 calc(50% - 4px)' }}>
              <SnapshotThumbnail
                snapshot={snapshot}
                onSelect={onSelect}
                onDelete={onDelete}
                onUpdateNote={onUpdateNote}
                isSelected={selectedSnapshotId === snapshot.id}
              />
            </div>
          ))
        ) : (
          <div
            style={{
              textAlign: 'center',
              color: '#666',
              padding: '40px',
              width: '100%'
            }}
          >
            No snapshots matching filter criteria
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * M63-C Snapshot System - Key Exports:
 * 
 * Features:
 * - Visual thumbnail preview (map grid + NPC positions + player marker)
 * - Event indicators (⚠ for active macro events)
 * - Paradox level color coding (red/yellow/blue)
 * - User note system (up to 200 chars)
 * - Quick-load functionality
 * - Sort by: Recent, Tick Count, Paradox Level
 * - Filter by: Active faction
 * 
 * Integration:
 * - AscensionProtocolView can save/load snapshots
 * - Export snapshots with notes for sharing
 * - Create checkpoints before dangerous events
 * - Review world state history with thumbnails
 */
