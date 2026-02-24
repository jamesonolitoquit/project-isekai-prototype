/**
 * Phase 3 Task 6: Multi-Save Slot Manager
 * 
 * Manages multiple save slots (slots 1-5) with slot listing/metadata
 * Allows quick-save to current slot, load from any slot, delete slots
 */

import React, { useState, useEffect, useMemo } from 'react';
import type { WorldState } from '../../engine/worldEngine';

export interface SaveSlotMetadata {
  slot: number;
  name: string;
  characterName?: string;
  tick: number;
  timestamp: number;
  location?: string;
  level?: number;
  size: number; // Bytes
  isValid: boolean;
  lastSaved?: Date;
}

export interface MultiSavePanelProps {
  /**
   * Current world state
   */
  state: WorldState;

  /**
   * Callback to perform a save to specific slot
   */
  onSaveToSlot?: (slot: number, slotName: string) => Promise<boolean>;

  /**
   * Callback to load from specific slot
   */
  onLoadFromSlot?: (slot: number) => Promise<WorldState | null>;

  /**
   * Callback to delete a slot
   */
  onDeleteSlot?: (slot: number) => Promise<boolean>;

  /**
   * Callback for status messages
   */
  onStatusChange?: (message: string) => void;
}

const MAX_SLOTS = 5;
const SAVE_SLOTS_KEY = 'luxfier_save_slots';

/**
 * Get metadata for all save slots
 */
function getSlotMetadata(): SaveSlotMetadata[] {
  const slots: SaveSlotMetadata[] = [];

  for (let i = 1; i <= MAX_SLOTS; i++) {
    const slotKey = `luxfier_save_slot_${i}`;
    const slotData = localStorage.getItem(slotKey);

    if (slotData) {
      try {
        const save = JSON.parse(slotData);
        slots.push({
          slot: i,
          name: save.name || `Save Slot ${i}`,
          characterName: save.stateSnapshot?.player?.name,
          tick: save.tick || 0,
          timestamp: save.timestamp || 0,
          location: save.stateSnapshot?.player?.location,
          level: save.stateSnapshot?.player?.level,
          size: slotData.length,
          isValid: true,
          lastSaved: new Date(save.timestamp || 0)
        });
      } catch (err) {
        slots.push({
          slot: i,
          name: `Save Slot ${i} (Corrupted)`,
          tick: 0,
          timestamp: 0,
          size: slotData.length,
          isValid: false
        });
      }
    } else {
      slots.push({
        slot: i,
        name: `Save Slot ${i} (Empty)`,
        tick: 0,
        timestamp: 0,
        size: 0,
        isValid: false
      });
    }
  }

  return slots;
}

/**
 * MultiSavePanel Component
 */
export const MultiSavePanel: React.FC<MultiSavePanelProps> = ({
  state,
  onSaveToSlot,
  onLoadFromSlot,
  onDeleteSlot,
  onStatusChange
}) => {
  const [slots, setSlots] = useState<SaveSlotMetadata[]>(getSlotMetadata());
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [customSlotName, setCustomSlotName] = useState('');

  // Refresh slot metadata
  const refreshSlots = () => {
    setSlots(getSlotMetadata());
  };

  useEffect(() => {
    refreshSlots();
  }, []);

  const handleSaveToSlot = async (slot: number) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const slotName = customSlotName.trim() || `Auto-save ${new Date().toLocaleTimeString()}`;
      const success = await onSaveToSlot?.(slot, slotName);

      if (success) {
        onStatusChange?.(`💾 Saved to Slot ${slot}`);
        setCustomSlotName('');
        refreshSlots();
      } else {
        onStatusChange?.(`❌ Failed to save to Slot ${slot}`);
      }
    } catch (err) {
      onStatusChange?.(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadFromSlot = async (slot: number) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const result = await onLoadFromSlot?.(slot);
      if (result) {
        onStatusChange?.(`📂 Loaded from Slot ${slot}`);
        setSelectedSlot(null);
      } else {
        onStatusChange?.(`❌ Failed to load from Slot ${slot}`);
      }
    } catch (err) {
      onStatusChange?.(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSlot = async (slot: number) => {
    if (!confirm(`Delete Save Slot ${slot}? This cannot be undone.`)) {
      return;
    }

    if (isLoading) return;
    setIsLoading(true);

    try {
      const success = await onDeleteSlot?.(slot);
      if (success) {
        onStatusChange?.(`🗑️ Deleted Slot ${slot}`);
        refreshSlots();
        setSelectedSlot(null);
      } else {
        onStatusChange?.(`❌ Failed to delete Slot ${slot}`);
      }
    } catch (err) {
      onStatusChange?.(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalSize = slots.reduce((sum, s) => sum + s.size, 0);
  const totalSizeKb = (totalSize / 1024).toFixed(2);

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        border: '1px solid #6366f1',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '12px'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#a78bfa' }}>
          💾 Multi-Save Manager
        </h3>
        <div style={{ fontSize: '11px', color: '#9ca3af' }}>
          Total Size: <span style={{ color: '#fbbf24' }}>{totalSizeKb} KB</span>
          {' '} | Slots: <span style={{ color: '#c084fc' }}>{slots.filter(s => s.isValid).length}/{MAX_SLOTS}</span>
        </div>
      </div>

      {/* Quick Save Input */}
      {selectedSlot && (
        <div
          style={{
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid #6366f1',
            borderRadius: '4px'
          }}
        >
          <label style={{ display: 'block', marginBottom: '8px', color: '#a78bfa', fontSize: '11px', fontWeight: 'bold' }}>
            Save Name (Optional):
          </label>
          <input
            type="text"
            value={customSlotName}
            onChange={(e) => setCustomSlotName(e.target.value)}
            placeholder={`Save Slot ${selectedSlot}`}
            style={{
              width: '100%',
              padding: '6px',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid #374151',
              color: '#e0e0e0',
              borderRadius: '4px',
              fontFamily: 'monospace',
              marginBottom: '8px',
              fontSize: '11px'
            }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => handleSaveToSlot(selectedSlot)}
              disabled={isLoading}
              style={{
                flex: 1,
                padding: '6px',
                backgroundColor: '#10b981',
                border: '1px solid #059669',
                color: '#fff',
                borderRadius: '4px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '11px'
              }}
            >
              {isLoading ? '⏳' : '💾'} Save to Slot {selectedSlot}
            </button>
            <button
              onClick={() => setSelectedSlot(null)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'transparent',
                border: '1px solid #374151',
                color: '#9ca3af',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Slot List */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '8px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}
      >
        {slots.map((slot) => (
          <div
            key={slot.slot}
            onClick={() => {
              if (slot.isValid) {
                setSelectedSlot(selectedSlot === slot.slot ? null : slot.slot);
              }
            }}
            style={{
              padding: '12px',
              backgroundColor: selectedSlot === slot.slot ? 'rgba(167, 139, 250, 0.15)' : 'rgba(0, 0, 0, 0.2)',
              border: selectedSlot === slot.slot ? '1px solid #a78bfa' : '1px solid #374151',
              borderRadius: '4px',
              cursor: slot.isValid ? 'pointer' : 'default',
              opacity: slot.isValid ? 1 : 0.6,
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
              <div>
                <span style={{ color: '#a78bfa', fontWeight: 'bold' }}>Slot {slot.slot}</span>
                {slot.isValid && (
                  <>
                    <div style={{ color: '#e0e0e0', fontSize: '11px', marginTop: '4px' }}>
                      {slot.characterName && <span>👤 {slot.characterName} </span>}
                      <span style={{ color: '#9ca3af' }}>LV{slot.level || 1}</span>
                      {slot.location && <span style={{ color: '#9ca3af' }}> @ {slot.location}</span>}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '10px', marginTop: '4px' }}>
                      Tick {slot.tick} | {slot.lastSaved?.toLocaleString()} | {(slot.size / 1024).toFixed(2)} KB
                    </div>
                  </>
                )}
                {!slot.isValid && (
                  <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '4px' }}>
                    {slot.name}
                  </div>
                )}
              </div>

              {slot.isValid && selectedSlot === slot.slot && (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLoadFromSlot(slot.slot);
                    }}
                    disabled={isLoading}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#3b82f6',
                      border: '1px solid #1e40af',
                      color: '#fff',
                      borderRadius: '3px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    📂 Load
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSlot(slot.slot);
                    }}
                    disabled={isLoading}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#ef4444',
                      border: '1px solid #b91c1c',
                      color: '#fff',
                      borderRadius: '3px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    🗑️ Delete
                  </button>
                </div>
              )}
            </div>

            {!slot.isValid && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedSlot(slot.slot);
                }}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: 'rgba(100, 116, 139, 0.3)',
                  border: '1px solid #6366f1',
                  color: '#a78bfa',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '11px'
                }}
              >
                💾 Save to Slot {slot.slot}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{ marginTop: '12px', padding: '8px', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderLeft: '2px solid #6366f1', fontSize: '10px', color: '#d1d5db' }}>
        💡 <strong>Save Management:</strong> Up to 5 game saves. Click a slot to view details and save/load/delete.
      </div>
    </div>
  );
};

export default MultiSavePanel;
