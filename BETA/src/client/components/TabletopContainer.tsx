/**
 * Phase 48-UI + Phase 8: Tabletop Container - Immersive 3-Column Grid Layout with EventBus Integration
 * 
 * Phase 30 UI: Tabletop Container
 * Phase 34 Extension: Particle profile integration with active codec theme
 * Phase 37 Extension: Tactile Board Integration with Dice Altar and Action Tray
 * Phase 43 Extension: Diegetic Character Sheet in tactical sidebar
 * Phase 44 Extension: Equipment Paper Doll with echo imprinting display
 * Phase 48-UI Extension: Fixed-viewport grid layout with no-scroll design
 * Phase 8 Extension: EventBus integration, Perception filtering, Causal lock display
 * 
 * The "Living Board Game" aesthetic:
 * - Left Wing (300px): Character Sheet - Shows skills, proficiencies, ancestry, causal locks
 * - Center (Fluid): The Game Board - Main playing surface with 3D perspective, perception-filtered NPCs
 * - Right Wing (320px): Tactical Repository - Dice Altar + Action Tray + Study Mode overlay
 * 
 * Creates the visual effect of a miniature world on a physical table, with lighting
 * that simulates overhead illumination on a wooden/stone surface.
 * 
 * Phase 8 Features:
 * - EventBus synchronization (1.5s tick heartbeat)
 * - Perception-based NPC visibility filtering
 * - Causal lock countdown display
 * - Study Mode time-lapse overlay with vitals decay
 * - UI notifications for major events (death, epoch, paradox)
 * - Real-time state hash verification
 * - Tick rate monitoring for performance diagnostics
 */

import React, { useMemo, useState, useEffect } from 'react';
import styles from './TabletopContainer.module.css';
import ParticleSurface from './ParticleSurface';
import DiceAltar from './DiceAltar';
import { CollapsiblePanel } from './CollapsiblePanel';
import { themeManager } from '../services/themeManager';
import { useEngineIntegration, useCausalLockCountdown } from '../hooks/useEngineIntegration';
import { useEventBusSync, useTickRateMonitor, useCausalLockMonitor } from '../hooks/useEventBusSync';
import { UIPerceptionManager } from '../managers/UIPerceptionManager';
import type { WorldState, PlayerState } from '../../engine/worldEngine';
import type { WorldController } from '../../types/engines';
import type { ParticleProfile } from '../services/themeManager';
import type { EventBus } from '../../engine/EventBus';
import type { CoreAttributes, Vessel, VitalStats, MaximumVitals, StatusEffect } from '../../types';

const DEFAULT_ATTRIBUTE_VALUE = 10;

const clampValue = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildAttributesFromStats = (stats?: PlayerState['stats']): CoreAttributes => {
  // Support both lowercase keys (legacy engine) and uppercase keys (characterCreation.ts)
  const s = stats as any;
  const agility = s?.agi ?? s?.AGI ?? DEFAULT_ATTRIBUTE_VALUE;
  const intelligence = s?.int ?? s?.INT ?? DEFAULT_ATTRIBUTE_VALUE;
  const constitution = s?.end ?? s?.CON ?? DEFAULT_ATTRIBUTE_VALUE;
  const charisma = s?.cha ?? s?.CHA ?? DEFAULT_ATTRIBUTE_VALUE;
  const perceptionValue = s?.perception ?? s?.PER ?? DEFAULT_ATTRIBUTE_VALUE;

  return {
    STR: s?.str ?? s?.STR ?? DEFAULT_ATTRIBUTE_VALUE,
    DEX: agility,
    AGI: agility,
    CON: constitution,
    INT: intelligence,
    WIS: s?.wis ?? s?.WIS ?? intelligence,
    CHA: charisma,
    PER: perceptionValue,
  };
};

const buildVitalsFromPlayer = (player: PlayerState): { vitals: VitalStats; maximumVitals: MaximumVitals } => {
  const stats = player.stats as any;
  // Support both lowercase keys (legacy) and uppercase keys (characterCreation.ts)
  const constitution = stats?.end ?? stats?.CON ?? DEFAULT_ATTRIBUTE_VALUE;
  const wisdom = stats?.wis ?? stats?.WIS ?? stats?.int ?? stats?.INT ?? DEFAULT_ATTRIBUTE_VALUE;
  const maximumVitals: MaximumVitals = {
    maxVigor: 50 + constitution * 2,
    maxNourishment: 100,
    maxSanity: 50 + wisdom * 3,
  };

  const vitals: VitalStats = {
    vigor: clampValue(Math.min(maximumVitals.maxVigor, 100), 0, maximumVitals.maxVigor),
    nourishment: maximumVitals.maxNourishment,
    sanity: clampValue(Math.min(maximumVitals.maxSanity, 100), 0, maximumVitals.maxSanity),
  };

  return { vitals, maximumVitals };
};

const createPlayerVessel = (player: PlayerState, worldTick: number = 0): Vessel => {
  const attributes = buildAttributesFromStats(player.stats);
  const { vitals, maximumVitals } = buildVitalsFromPlayer(player);
  const baseStamina = player.maxHp ?? 100;
  const statusEffects: StatusEffect[] = (player.statusEffects || []).map((effectId) => ({
    id: effectId,
    name: effectId,
    type: 'buff',
    duration: 0,
    description: `Legacy status effect ${effectId}`,
  }));

  return {
    id: player.id || 'player',
    playerId: player.id,
    name: player.name || 'Wanderer',
    level: player.level ?? 1,
    experience: player.experience ?? player.xp ?? 0,
    attributes,
    healthPoints: player.hp ?? player.maxHp ?? 100,
    maxHealthPoints: player.maxHp ?? 100,
    stamina: baseStamina,
    maxStamina: baseStamina,
    vitals,
    maximumVitals,
    injuries: [],
    ancestry: player.race || 'Human',
    talent: player.archetype || 'unknown',
    gender: 'non-binary',
    createdAtTick: worldTick,
    isAlive: true,
    vesselTier: 'standard',
    statusEffects,
  } as Vessel;
};

// ─── Tactical Resolution Bridge ───────────────────────────────────────────────
// Bridges the 3D Dice Altar with the WorldController combat action pipeline.
// Appears only when combat is active. Player selects an action → dice resolve → event dispatched.
const COMBAT_ACTIONS = [
  { id: 'attack', label: '⚔️ Attack', dc: 12, color: '#ef4444' },
  { id: 'defend', label: '🛡️ Defend', dc: 8, color: '#60a5fa' },
  { id: 'cast', label: '✨ Cast Spell', dc: 15, color: '#c084fc' },
  { id: 'flee', label: '💨 Flee', dc: 10, color: '#fbbf24' },
];

function TacticalBridge({ worldState, controller }: { worldState: any; controller?: WorldController }) {
  const [pending, setPending] = React.useState<string | null>(null);
  const [lastResolution, setLastResolution] = React.useState<{ label: string; roll: number; dc: number; success: boolean } | null>(null);

  // Watch the last event in worldState for a roll result matching our pending action
  const prevEventsLen = React.useRef<number>(0);

  React.useEffect(() => {
    const events: any[] = worldState?.events || [];
    if (events.length === prevEventsLen.current) return;
    prevEventsLen.current = events.length;

    if (!pending) return;
    // Find latest roll event
    const rollEvent = [...events].reverse().find((e: any) => e?.payload?.roll !== undefined);
    if (!rollEvent) return;

    const action = COMBAT_ACTIONS.find(a => a.id === pending);
    if (!action) return;

    const total: number = rollEvent.payload.roll?.total ?? rollEvent.payload.roll?.d20Roll ?? 10;
    const success = total >= action.dc;

    setLastResolution({ label: action.label, roll: total, dc: action.dc, success });
    setPending(null);

    // Dispatch a combat action event via the WorldController if available
    if (controller && typeof (controller as any).submitPlayerAction === 'function') {
      (controller as any).submitPlayerAction({ type: pending, roll: total, success });
    } else if (controller && typeof (controller as any).processAction === 'function') {
      (controller as any).processAction({ type: 'PLAYER_ACTION', subtype: pending, roll: total, success });
    }
  }, [worldState?.events, pending, controller]);

  const handleAction = (actionId: string) => {
    setPending(actionId);
    setLastResolution(null);
  };

  return (
    <div style={{
      padding: '0.6rem 0.75rem',
      background: 'linear-gradient(180deg, rgba(239,68,68,0.08), rgba(10,5,20,0.3))',
      borderBottom: '1px solid rgba(248,113,113,0.2)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#f87171', fontWeight: 700, marginBottom: '0.5rem' }}>
        ⚔️ Tactical Tray
      </div>

      {/* Resolution feedback */}
      {lastResolution && (
        <div style={{
          marginBottom: '0.5rem',
          padding: '0.35rem 0.5rem',
          background: lastResolution.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          border: `1px solid ${lastResolution.success ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.35)'}`,
          borderRadius: '4px',
          fontSize: '0.72rem',
          color: lastResolution.success ? '#86efac' : '#fca5a5',
          textAlign: 'center',
        }}>
          {lastResolution.label}: <strong>{lastResolution.roll}</strong> vs DC {lastResolution.dc} — {lastResolution.success ? '✓ SUCCESS' : '✗ FAIL'}
        </div>
      )}

      {/* Pending state feedback */}
      {pending && (
        <div style={{
          marginBottom: '0.5rem',
          padding: '0.3rem 0.5rem',
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '4px',
          fontSize: '0.7rem',
          color: '#fde68a',
          textAlign: 'center',
          fontStyle: 'italic',
        }}>
          🎲 Rolling for {COMBAT_ACTIONS.find(a => a.id === pending)?.label ?? pending}…
        </div>
      )}

      {/* Action buttons */}
      {!pending && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
          {COMBAT_ACTIONS.map(action => (
            <button key={action.id}
              onClick={() => handleAction(action.id)}
              style={{
                padding: '0.35rem 0.4rem',
                background: `${action.color}18`,
                border: `1px solid ${action.color}55`,
                borderRadius: '4px',
                color: action.color,
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = `${action.color}30`;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${action.color}44`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = `${action.color}18`;
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

interface TabletopContainerProps {
  children: React.ReactNode;
  worldState?: WorldState;
  hideParticleSurface?: boolean;
  controller?: WorldController;
  eventBus?: EventBus;           // Phase 8: EventBus for tick synchronization
}

interface TabletopState {
  isProcessing: boolean;
  hasDeathNotification: boolean;
  hasEpochNotification: boolean;
  showCausalLockOverlay: boolean;
  showStudyModeOverlay: boolean;
  showDebugInfo: boolean;
}

export default function TabletopContainer({
  children,
  worldState,
  hideParticleSurface = false,
  controller,
  eventBus,
}: TabletopContainerProps) {
  const [state, setState] = useState<TabletopState>({
    isProcessing: false,
    hasDeathNotification: false,
    hasEpochNotification: false,
    showCausalLockOverlay: false,
    showStudyModeOverlay: false,
    showDebugInfo: false,
  });

  // Hover-to-Insight: track hovered vessel slot for right-panel tooltip
  const [hoveredSlot, setHoveredSlot] = useState<{ slot: string; itemId: string | undefined } | null>(null);

  // Phase 8: Subscribe to EventBus for real-time updates
  const engineState = useEngineIntegration({
    eventBus: eventBus || null,
    filterMutationTypes: ['death_event', 'epoch_transition', 'causal_lock'],
    notificationTimeout: 5000,
    onCausalLockUpdate: () => {
      setState(prev => ({ ...prev, showCausalLockOverlay: true }));
    },
    onMajorEvent: (type) => {
      if (type === 'vessel_death') {
        setState(prev => ({ ...prev, hasDeathNotification: true }));
        setTimeout(() => setState(prev => ({ ...prev, hasDeathNotification: false })), 3000);
      } else if (type === 'epoch_transition') {
        setState(prev => ({ ...prev, hasEpochNotification: true }));
        setTimeout(() => setState(prev => ({ ...prev, hasEpochNotification: false })), 5000);
      }
    },
  });

  // Phase 8: Monitor causal locks with countdown
  const displayLocks = useCausalLockCountdown(
    engineState.causalLocks,
    engineState.lastEventTick
  );

  // Phase 8: Monitor tick rate for performance
  const tickMonitor = useTickRateMonitor(eventBus || null);

  // Phase 8: Monitor causal lock expiration
  const lockMonitor = useCausalLockMonitor(eventBus || null);

  // Derive particle profile from active codec theme
  const particleProfile = useMemo<ParticleProfile | undefined>(() => {
    const codecName = themeManager.getCodec();
    const codecDef = themeManager.getCodecDefinition(codecName);
    return codecDef.particleProfile;
  }, []);

  // Phase 8: Calculate perception filter for player
  const perceptionFilter = useMemo(() => {
    if (!worldState?.player) return null;

    const playerVessel = createPlayerVessel(worldState.player, worldState.tick ?? 0);
    return UIPerceptionManager.calculatePlayerPerception(
      playerVessel,
      [],
      false
    );
  }, [worldState?.player, worldState?.tick]);

  // Handler for ChronosStudyUI time-skip submission
  const handleStudySubmit = async (durationTicks: number, studyType: 'rest' | 'study' | 'meditate') => {
    if (!controller) {
      console.warn('[TabletopContainer] No controller available for study submission');
      return;
    }

    setState(prev => ({ ...prev, isProcessing: true, showStudyModeOverlay: true }));
    try {
      // Execute batch ticks with quiet mode enabled
      const result = (controller as any).executeBatchTicks?.(durationTicks, true);
      console.log('[TabletopContainer] Study completed:', result.summary);
    } catch (err) {
      console.error('[TabletopContainer] Error during study:', err);
    } finally {
      setState(prev => ({ ...prev, isProcessing: false, showStudyModeOverlay: false }));
    }
  };

  // Phase 8: Toggle debug info display
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '~' || e.key === '`') {
        setState(prev => ({ ...prev, showDebugInfo: !prev.showDebugInfo }));
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <div className={styles.tabletopOuter}>
      {/* Outer container: simulates the physical table surface */}
      <div className={styles.tabletopSurface}>
        {/* Phase 32/34: Particle surface layer with theme-driven profile */}
        {!hideParticleSurface && (
          <ParticleSurface 
            particleProfile={particleProfile}
            worldState={{
              paradoxLevel: worldState?.paradoxLevel ?? 0,
              spiritDensity: 0.5, // Default spirit density
              isInCombat: false, // TODO: Derive from combat state
            }}
          />
        )}
        
        {/* Phase 8: Death notification overlay */}
        {state.hasDeathNotification && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(139, 0, 0, 0.9)',
              color: '#ff6b6b',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              zIndex: 1000,
              animation: 'fadeInOut 3s ease-in-out',
            }}
          >
            Your vessel has been destroyed!
          </div>
        )}

        {/* Phase 8: Epoch transition notification */}
        {state.hasEpochNotification && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: 'rgba(25, 118, 210, 0.9)',
              color: '#64b5f6',
              padding: '2rem',
              borderRadius: '8px',
              textAlign: 'center',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              zIndex: 1000,
              animation: 'fadeInOut 5s ease-in-out',
            }}
          >
            A new epoch has begun!
          </div>
        )}
        
        {/* Phase 48-UI: 3-Column Grid Layout */}
        <div className={styles.tabletopGrid}>
          {/* LEFT WING: Hero Sanctum (280px) */}
          <div className={styles.leftWing}>
            <div style={{
              display: 'flex', flexDirection: 'column', gap: '12px',
              padding: '12px', height: '100%', overflow: 'hidden',
            }}>
              {/* Avatar + Name + Level */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(79,39,131,0.5))',
                  border: '2px solid rgba(139,92,246,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem', flexShrink: 0,
                  boxShadow: '0 0 12px rgba(139,92,246,0.2)',
                }}>
                  {worldState?.player?.race === 'Elf' ? '🧝' : worldState?.player?.race === 'Dwarf' ? '⛏️' : '🧙'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.9rem', fontWeight: 700, color: '#e2d4f0',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {worldState?.player?.name || 'Wanderer'}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'rgba(167,139,250,0.7)' }}>
                    Lv {worldState?.player?.level ?? 1} {worldState?.player?.archetype || worldState?.player?.race || 'Adventurer'}
                  </div>
                </div>
              </div>

              {/* HP / MP / Grit Bars */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                {[
                  { label: '❤ HP', current: worldState?.player?.hp ?? 0, max: worldState?.player?.maxHp ?? 100, color: '#ef4444', bgColor: 'rgba(239,68,68,0.15)' },
                  { label: '💙 MP', current: worldState?.player?.mp ?? 0, max: worldState?.player?.maxMp ?? 100, color: '#60a5fa', bgColor: 'rgba(96,165,250,0.15)' },
                  { label: '⚡ Grit', current: worldState?.player?.grit ?? 0, max: worldState?.player?.maxGrit ?? 100, color: '#fbbf24', bgColor: 'rgba(251,191,36,0.15)' },
                ].map(bar => (
                  <div key={bar.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', color: 'rgba(200,180,220,0.6)', minWidth: '44px', fontWeight: 600 }}>{bar.label}</span>
                    <div style={{
                      flex: 1, height: '12px', background: bar.bgColor,
                      borderRadius: '3px', overflow: 'hidden', position: 'relative',
                      border: `1px solid ${bar.color}30`,
                    }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, (bar.current / Math.max(1, bar.max)) * 100)}%`,
                        background: `linear-gradient(90deg, ${bar.color}cc, ${bar.color})`,
                        borderRadius: '3px', transition: 'width 0.4s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.6rem', color: 'rgba(200,180,220,0.5)', minWidth: '46px', textAlign: 'right' }}>
                      {bar.current}/{bar.max}
                    </span>
                  </div>
                ))}
              </div>

              {/* Equipment Slots Grid - 14-Slot "Vessel" Matrix */}
              <div style={{ flexShrink: 0 }}>
                <h3 style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(200,180,220,0.45)', margin: '0 0 6px 0' }}>Vessel</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '3px' }}>
                  {/* Column 1: Aetheric & Resonance */}
                  {[
                    { slot: 'Head', icon: '👑', id: worldState?.player?.equipment?.head },
                    { slot: 'Neck', icon: '⛓️', id: worldState?.player?.equipment?.neck },
                    { slot: 'Ring 1', icon: '💍', id: worldState?.player?.equipment?.ring1 },
                    { slot: 'Ring 2', icon: '💎', id: worldState?.player?.equipment?.ring2 },
                  ].map(eq => (
                    <div key={eq.slot}
                      onMouseEnter={() => setHoveredSlot({ slot: eq.slot, itemId: eq.id })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '3px 4px',
                      background: hoveredSlot?.slot === eq.slot ? 'rgba(139,92,246,0.28)' : eq.id ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.06)',
                      border: `1px solid ${hoveredSlot?.slot === eq.slot ? 'rgba(139,92,246,0.7)' : eq.id ? 'rgba(139,92,246,0.3)' : 'rgba(139,92,246,0.12)'}`,
                      borderRadius: '3px', cursor: 'pointer',
                      fontSize: '0.6rem', color: eq.id ? '#d8b4fe' : 'rgba(139,92,246,0.3)',
                      minHeight: '36px', justifyContent: 'center',
                      boxShadow: hoveredSlot?.slot === eq.slot ? '0 0 8px rgba(139,92,246,0.5)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '0.75rem' }}>{eq.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                        {eq.id ? eq.id.replace(/_/g, ' ').substring(0, 8) : '—'}
                      </span>
                    </div>
                  ))}
                  
                  {/* Column 2: Physical Core */}
                  {[
                    { slot: 'Chest', icon: '🧥', id: worldState?.player?.equipment?.chest },
                    { slot: 'Waist', icon: '🪡', id: worldState?.player?.equipment?.waist },
                    { slot: 'Legs', icon: '👖', id: worldState?.player?.equipment?.legs },
                    { slot: 'Feet', icon: '👢', id: worldState?.player?.equipment?.feet },
                  ].map(eq => (
                    <div key={eq.slot}
                      onMouseEnter={() => setHoveredSlot({ slot: eq.slot, itemId: eq.id })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '3px 4px',
                      background: hoveredSlot?.slot === eq.slot ? 'rgba(59,130,246,0.28)' : eq.id ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.06)',
                      border: `1px solid ${hoveredSlot?.slot === eq.slot ? 'rgba(59,130,246,0.7)' : eq.id ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.12)'}`,
                      borderRadius: '3px', cursor: 'pointer',
                      fontSize: '0.6rem', color: eq.id ? '#93c5fd' : 'rgba(59,130,246,0.3)',
                      minHeight: '36px', justifyContent: 'center',
                      boxShadow: hoveredSlot?.slot === eq.slot ? '0 0 8px rgba(59,130,246,0.5)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '0.75rem' }}>{eq.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                        {eq.id ? eq.id.replace(/_/g, ' ').substring(0, 8) : '—'}
                      </span>
                    </div>
                  ))}
                  
                  {/* Column 3: Martial & Resonance */}
                  {[
                    { slot: 'Back', icon: '🎒', id: worldState?.player?.equipment?.back },
                    { slot: 'Hands', icon: '🧤', id: worldState?.player?.equipment?.hands },
                    { slot: 'Ring 3', icon: '🔮', id: worldState?.player?.equipment?.ring3 },
                    { slot: 'Ring 4', icon: '✨', id: worldState?.player?.equipment?.ring4 },
                    { slot: 'M.Hand', icon: '⚔️', id: worldState?.player?.equipment?.mainHand },
                    { slot: 'O.Hand', icon: '🛡️', id: worldState?.player?.equipment?.offHand },
                  ].map(eq => (
                    <div key={eq.slot}
                      onMouseEnter={() => setHoveredSlot({ slot: eq.slot, itemId: eq.id })}
                      onMouseLeave={() => setHoveredSlot(null)}
                      style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px',
                      padding: '3px 4px',
                      background: hoveredSlot?.slot === eq.slot ? 'rgba(249,115,22,0.28)' : eq.id ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.06)',
                      border: `1px solid ${hoveredSlot?.slot === eq.slot ? 'rgba(249,115,22,0.7)' : eq.id ? 'rgba(249,115,22,0.3)' : 'rgba(249,115,22,0.12)'}`,
                      borderRadius: '3px', cursor: 'pointer',
                      fontSize: '0.6rem', color: eq.id ? '#fdba74' : 'rgba(249,115,22,0.3)',
                      minHeight: '36px', justifyContent: 'center',
                      boxShadow: hoveredSlot?.slot === eq.slot ? '0 0 8px rgba(249,115,22,0.5)' : 'none',
                      transition: 'all 0.15s',
                    }}>
                      <span style={{ fontSize: '0.75rem' }}>{eq.icon}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%', textAlign: 'center' }}>
                        {eq.id ? eq.id.replace(/_/g, ' ').substring(0, 8) : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Hover-to-Insight Panel */}
              {hoveredSlot && (
                <div style={{
                  flexShrink: 0,
                  padding: '0.5rem 0.6rem',
                  background: 'rgba(10,5,20,0.7)',
                  border: '1px solid rgba(139,92,246,0.4)',
                  borderRadius: '5px',
                  boxShadow: '0 0 12px rgba(139,92,246,0.25)',
                  fontSize: '0.72rem',
                  color: 'rgba(200,180,220,0.9)',
                  lineHeight: 1.50,
                  animation: 'fadeIn 0.12s ease',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                    <span style={{ fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                      {hoveredSlot.slot}
                    </span>
                    <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.45)', fontFamily: 'monospace' }}>slot</span>
                  </div>
                  {hoveredSlot.itemId ? (
                    <>
                      <div style={{ color: '#e9d5ff', fontWeight: 600, marginBottom: '0.2rem' }}>
                        {hoveredSlot.itemId.replace(/_/g, ' ')}
                      </div>
                      <div style={{ color: 'rgba(200,180,220,0.5)', fontStyle: 'italic', fontSize: '0.68rem' }}>
                        Resonance imprint detected. Aetheric signature stable.
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'rgba(167,139,250,0.35)', fontStyle: 'italic', fontSize: '0.68rem' }}>
                      Historical Slot Fragment — awaiting imprint
                    </div>
                  )}
                </div>
              )}

              {/* Active Talents (max 3 tags) */}
              {(worldState?.player?.equippedAbilities || []).length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <h3 style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(200,180,220,0.45)', margin: '0 0 6px 0' }}>Active Talents</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {(worldState?.player?.equippedAbilities || []).slice(0, 3).map((aid: string) => (
                      <span key={aid} style={{
                        fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px',
                        background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
                        color: '#c084fc', whiteSpace: 'nowrap',
                      }}>
                        ✦ {aid.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {(worldState?.player?.equippedAbilities || []).length > 3 && (
                      <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.5)', alignSelf: 'center' }}
                        title={(worldState?.player?.equippedAbilities || []).slice(3).join(', ')}>
                        +{(worldState?.player?.equippedAbilities || []).length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Active Buffs/Debuffs (icons only, max 4) */}
              {(worldState?.player?.statusEffects || []).length > 0 && (
                <div style={{ flexShrink: 0 }}>
                  <h3 style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'rgba(200,180,220,0.45)', margin: '0 0 6px 0' }}>Status</h3>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {(worldState?.player?.statusEffects || []).slice(0, 4).map((eff: string) => (
                      <span key={eff} style={{
                        width: '24px', height: '24px', borderRadius: '4px',
                        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', color: '#d8b4fe', cursor: 'default',
                      }} title={eff}>
                        💫
                      </span>
                    ))}
                    {(worldState?.player?.statusEffects || []).length > 4 && (
                      <span style={{ fontSize: '0.6rem', color: 'rgba(167,139,250,0.5)', alignSelf: 'center' }}>
                        +{(worldState?.player?.statusEffects || []).length - 4}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Causal Locks (Phase 8) */}
              {displayLocks.length > 0 && state.showCausalLockOverlay && (
                <div style={{
                  padding: '0.4rem',
                  border: '1px solid rgba(255, 69, 0, 0.4)',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(255, 69, 0, 0.08)',
                  fontSize: '0.72rem', flexShrink: 0,
                }}>
                  <h4 style={{ margin: '0 0 4px 0', color: '#ff6b6b', fontSize: '0.65rem', textTransform: 'uppercase' }}>Causal Locks</h4>
                  {displayLocks.map(lock => (
                    <div key={lock.soulId} style={{ marginBottom: '4px' }}>
                      <div style={{ fontSize: '0.68rem', color: 'rgba(200,180,220,0.7)' }}>{lock.sessionName}</div>
                      <div style={{
                        height: '3px', backgroundColor: '#333', borderRadius: '2px',
                        overflow: 'hidden', marginTop: '2px',
                      }}>
                        <div style={{ height: '100%', backgroundColor: '#ff6b6b', width: `${lock.progressPercent}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Gold display */}
              {worldState?.player?.gold !== undefined && (
                <div style={{
                  marginTop: 'auto', paddingTop: '8px',
                  borderTop: '1px solid rgba(79,39,131,0.2)',
                  fontSize: '0.72rem', color: '#fbbf24',
                  display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                }}>
                  💰 {worldState.player.gold} Gold
                </div>
              )}
            </div>
          </div>

          {/* CENTER WING: Game Board (Fluid) */}
          <div className={styles.centerWing}>
            {/* Main 3D board perspective container */}
            <div className={styles.gameBoardPerspective}>
              <div className={styles.gameBoardContent}>
                {children}
              </div>
            </div>
            
            {/* Phase 8: Perception info debug overlay (toggle with ~) */}
            {state.showDebugInfo && perceptionFilter && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '1rem',
                  right: '1rem',
                  backgroundColor: 'rgba(0, 0, 0, 0.8)',
                  color: '#00ff00',
                  padding: '0.5rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  maxWidth: '200px',
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #00ff00',
                  zIndex: 100,
                }}
              >
                <div>PER: {perceptionFilter.playerPerception}</div>
                <div>WIS: {perceptionFilter.playerWisdom}</div>
                <div>Lag Mult: {(perceptionFilter.lagMultiplier * 100).toFixed(1)}%</div>
                <div style={{ marginTop: '0.5rem', borderTop: '1px solid #00ff00' }}>
                  Tick Rate: {tickMonitor.tickRate.toFixed(2)} Hz
                </div>
                <div>Latency: {tickMonitor.averageLatency.toFixed(0)}ms</div>
                <div>Connection: {engineState.isConnected ? 'OK' : 'LOST'}</div>
              </div>
            )}
          </div>

          {/* RIGHT WING: Tactical Repository (320px) */}
          <div className={styles.rightWing}>
            {/* Tactical Bridge removed in Phase 8 — combat actions now live near the dice tray */}

            {/* ─── Collapsible Panels: Lore & Logs ─── */}
            <div style={{ overflowY: 'auto', borderTop: '1px solid rgba(79, 39, 131, 0.3)', flex: 1, minHeight: 0 }}>

              {/* Inventory */}
              <CollapsiblePanel title="Inventory" icon="🎒" defaultOpen={false} persistKey="inv"
                badge={(worldState?.player?.inventory || []).length || undefined}>
                {(worldState?.player?.inventory || []).length === 0 ? (
                  <p style={{ color: 'rgba(200,180,220,0.4)', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>Empty</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {(worldState?.player?.inventory || []).slice(0, 3).map((item: any) => {
                      const rarityColor: Record<string, string> = { common: '#d8b4fe', rare: '#60a5fa', legendary: '#fbbf24', epic: '#f472b6' };
                      return (
                        <div key={item.id ?? item.name} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '0.2rem 0.4rem', background: 'rgba(139,92,246,0.07)', borderRadius: '4px',
                          fontSize: '0.72rem', border: '1px solid rgba(139,92,246,0.1)',
                        }}
                          title={item.description || item.name}
                        >
                          <span style={{ color: rarityColor[item.rarity] || '#d8b4fe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.icon ?? '📦'} {item.name}</span>
                          {(item.quantity ?? item.count ?? 0) > 1 && (
                            <span style={{ color: 'rgba(167,139,250,0.7)', fontSize: '0.65rem', flexShrink: 0, marginLeft: '0.3rem' }}>×{item.quantity ?? item.count}</span>
                          )}
                        </div>
                      );
                    })}
                    {(worldState?.player?.inventory || []).length > 3 && (
                      <span style={{ fontSize: '0.65rem', color: 'rgba(167,139,250,0.6)', cursor: 'pointer', textAlign: 'right', paddingTop: '0.1rem' }}
                        title="Open full inventory"
                      >View all {(worldState?.player?.inventory || []).length} items →</span>
                    )}
                  </div>
                )}
              </CollapsiblePanel>

              {/* Arcane Arts — magical abilities */}
              <CollapsiblePanel title="Arcane Arts" icon="🔮" defaultOpen={false} persistKey="arcane"
                accentColor="rgba(147, 51, 234, 0.4)"
                badge={(worldState?.player?.unlockedAbilities || []).filter((a: string) => !worldState?.player?.equippedAbilities?.includes(a)).length || undefined}>
                {(() => {
                  const allAbilities = worldState?.player?.unlockedAbilities || [];
                  const equipped = worldState?.player?.equippedAbilities || [];
                  // Arcane = abilities that aren't in the equipped martial pool (heuristic: contains magic/arcane/spell keywords or ID)
                  const arcane = allAbilities.filter((a: string) => /magi|spell|arcane|fire|ice|heal|dark|light|summon|ward|enchant/i.test(a));
                  return arcane.length === 0 ? (
                    <p style={{ color: 'rgba(200,180,220,0.4)', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>No arcane arts learned</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {arcane.slice(0, 2).map((aid: string) => {
                        const isEquipped = equipped.includes(aid);
                        return (
                          <div key={aid} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.2rem 0.4rem', background: isEquipped ? 'rgba(147,51,234,0.12)' : 'rgba(139,92,246,0.05)',
                            borderRadius: '4px', fontSize: '0.72rem', border: `1px solid ${isEquipped ? 'rgba(147,51,234,0.35)' : 'rgba(139,92,246,0.1)'}`,
                          }}>
                            <span style={{ color: isEquipped ? '#c084fc' : 'rgba(200,180,220,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              ✨ {aid.replace(/_/g, ' ')}
                            </span>
                            {isEquipped && <span style={{ fontSize: '0.6rem', color: '#86efac', flexShrink: 0 }}>SLOTTED</span>}
                          </div>
                        );
                      })}
                      {arcane.length > 2 && (
                        <span style={{ fontSize: '0.65rem', color: 'rgba(167,139,250,0.6)', cursor: 'pointer', textAlign: 'right' }}
                          title="View all arcane arts"
                        >+{arcane.length - 2} more →</span>
                      )}
                    </div>
                  );
                })()}
              </CollapsiblePanel>

              {/* Martial Arts — physical combat abilities */}
              <CollapsiblePanel title="Martial Arts" icon="⚔️" defaultOpen={false} persistKey="martial"
                accentColor="rgba(239, 68, 68, 0.3)">
                {(() => {
                  const allAbilities = worldState?.player?.unlockedAbilities || [];
                  const equipped = worldState?.player?.equippedAbilities || [];
                  const martial = allAbilities.filter((a: string) => /strike|slash|block|parry|bash|kick|charge|counter|rage|fury|cleave|thrust/i.test(a));
                  return martial.length === 0 ? (
                    <p style={{ color: 'rgba(200,180,220,0.4)', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>No martial arts learned</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {martial.slice(0, 2).map((aid: string) => {
                        const isEquipped = equipped.includes(aid);
                        return (
                          <div key={aid} style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '0.2rem 0.4rem', background: isEquipped ? 'rgba(239,68,68,0.08)' : 'rgba(139,92,246,0.05)',
                            borderRadius: '4px', fontSize: '0.72rem', border: `1px solid ${isEquipped ? 'rgba(239,68,68,0.25)' : 'rgba(139,92,246,0.1)'}`,
                          }}>
                            <span style={{ color: isEquipped ? '#fca5a5' : 'rgba(200,180,220,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              🗡️ {aid.replace(/_/g, ' ')}
                            </span>
                            {isEquipped && <span style={{ fontSize: '0.6rem', color: '#86efac', flexShrink: 0 }}>SLOTTED</span>}
                          </div>
                        );
                      })}
                      {martial.length > 2 && (
                        <span style={{ fontSize: '0.65rem', color: 'rgba(167,139,250,0.6)', cursor: 'pointer', textAlign: 'right' }}
                          title="View all martial arts"
                        >+{martial.length - 2} more →</span>
                      )}
                    </div>
                  );
                })()}
              </CollapsiblePanel>

              {/* Passive Skills */}
              <CollapsiblePanel title="Skills" icon="📘" defaultOpen={false} persistKey="skills"
                badge={(worldState?.player?.unlockedSkills || []).length || undefined}>
                {(worldState?.player?.unlockedSkills || []).length === 0 ? (
                  <p style={{ color: 'rgba(200,180,220,0.4)', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>No skills unlocked</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {(worldState?.player?.unlockedSkills || []).slice(0, 3).map((sid: string) => (
                      <div key={sid} style={{
                        padding: '0.2rem 0.4rem', background: 'rgba(139,92,246,0.05)',
                        borderRadius: '4px', fontSize: '0.72rem', color: '#d8b4fe',
                        border: '1px solid rgba(139,92,246,0.1)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        ◈ {sid.replace(/_/g, ' ')}
                      </div>
                    ))}
                    {(worldState?.player?.unlockedSkills || []).length > 3 && (
                      <span style={{ fontSize: '0.65rem', color: 'rgba(167,139,250,0.6)', cursor: 'pointer', textAlign: 'right' }}
                        title="View all skills"
                      >+{(worldState?.player?.unlockedSkills || []).length - 3} more →</span>
                    )}
                  </div>
                )}
              </CollapsiblePanel>

              {/* Quests & Journal */}
              <CollapsiblePanel title="Quests & Journal" icon="📜" defaultOpen={false} persistKey="quests"
                badge={worldState?.player?.quests ? Object.keys(worldState.player.quests).length : undefined}>
                {!worldState?.player?.quests || Object.keys(worldState.player.quests).length === 0 ? (
                  <p style={{ color: 'rgba(200,180,220,0.4)', fontSize: '0.78rem', fontStyle: 'italic', margin: 0 }}>No active quests</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {Object.entries(worldState.player.quests).slice(0, 2).map(([qid, qs]: [string, any]) => {
                      const def = (worldState?.quests || []).find((q: any) => q.id === qid);
                      const statusColor: Record<string, string> = { active: '#86efac', none: '#fbbf24', completed: '#6ee7b7', failed: '#f87171' };
                      return (
                        <div key={qid} style={{
                          padding: '0.2rem 0.4rem', background: 'rgba(139,92,246,0.05)',
                          borderRadius: '4px', border: '1px solid rgba(139,92,246,0.1)',
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.72rem', color: '#d8b4fe', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{def?.title || qid}</span>
                            <span style={{ fontSize: '0.58rem', color: statusColor[qs.status] || '#aaa', textTransform: 'capitalize', fontWeight: 600, flexShrink: 0, marginLeft: '0.3rem' }}>{qs.status}</span>
                          </div>
                          {qs.progress !== undefined && (
                            <div style={{ height: '2px', background: 'rgba(79,39,131,0.4)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.15rem' }}>
                              <div style={{ height: '100%', width: `${Math.min(100, (qs.progress / (qs.required ?? 1)) * 100)}%`, background: 'linear-gradient(90deg, #8b5cf6, #c084fc)', borderRadius: '2px' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {Object.keys(worldState.player.quests).length > 2 && (
                      <span style={{ fontSize: '0.65rem', color: 'rgba(167,139,250,0.6)', cursor: 'pointer', textAlign: 'right' }}
                        title="View quest journal"
                      >+{Object.keys(worldState.player.quests).length - 2} more quests →</span>
                    )}
                  </div>
                )}
              </CollapsiblePanel>

              {/* Status Effects (only when present) */}
              {(worldState?.player?.statusEffects || []).length > 0 && (
                <CollapsiblePanel title="Status Effects" icon="💫" defaultOpen={true} persistKey="status">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {(worldState?.player?.statusEffects || []).map((eff: string) => (
                      <span key={eff} style={{
                        fontSize: '0.72rem', background: 'rgba(139,92,246,0.15)',
                        border: '1px solid rgba(139,92,246,0.3)', borderRadius: '4px',
                        padding: '0.15rem 0.45rem', color: '#d8b4fe',
                      }} title={eff}>
                        {eff}
                      </span>
                    ))}
                  </div>
                </CollapsiblePanel>
              )}

              {/* System Controls */}
              <CollapsiblePanel title="System" icon="⚙️" defaultOpen={false} persistKey="system">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {[
                    { label: '💾 Save', key: 'save' },
                    { label: '🔄 Reload', key: 'reload' },
                    { label: '⚙️ Settings', key: 'settings' },
                    { label: '❓ Help', key: 'help' },
                  ].map(btn => (
                    <button key={btn.key} onClick={() => console.log(`[System] ${btn.key} requested`)}
                      style={{
                        padding: '0.2rem 0.45rem', textAlign: 'center', flex: '1 1 45%',
                        background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.15)',
                        borderRadius: '4px', color: '#c084fc', fontSize: '0.68rem', cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.15)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(139,92,246,0.06)')}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </CollapsiblePanel>

            </div>

            {/* Phase 8: UI Notifications stack */}
            {engineState.notifications.length > 0 && (
              <div style={{
                position: 'fixed',
                bottom: '2rem',
                right: '1rem',
                maxWidth: '300px',
                zIndex: 999,
              }}>
                {engineState.notifications.map(notification => (
                  <div
                    key={notification.id}
                    style={{
                      backgroundColor: notification.type === 'death' ? '#8b0000' : '#1976d2',
                      color: notification.type === 'death' ? '#ff6b6b' : '#64b5f6',
                      padding: '1rem',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                      fontSize: '0.9rem',
                    }}
                    onClick={() => engineState.dismissNotification(notification.id)}
                  >
                    {notification.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Atmospheric overlays */}
      <div className={styles.vignetteOverlay} />
      
      {/* CSS animations */}
      <style>{`
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

