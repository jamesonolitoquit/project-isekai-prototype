/**
 * M38 Task 4: Beta Global Header Component
 * 
 * Reactive telemetry display showing:
 * - Live chaos/paradox levels
 * - Peer count (multiplayer diagnostics)
 * - Faction dominance indicators
 * - Macro event severity
 * - Combat status
 */

import React, { useState, useEffect } from 'react';
import type { WorldState } from '../../engine/worldEngine';

export interface BetaGlobalHeaderProps {
  state: WorldState;
  consensusDiagnostics?: {
    activeProposals: number;
    averageLatency: number;
    peerCount: number;
  };
  macroEventDiagnostics?: {
    activeCount: number;
    avgSeverity: number;
  };
  onExportDebug?: () => void;
  onOpenWeaverSettings?: () => void;
  onOpenArchitectForge?: () => void; // Phase 4 Task 5
}

export const BetaGlobalHeader: React.FC<BetaGlobalHeaderProps> = ({
  state,
  consensusDiagnostics,
  macroEventDiagnostics,
  onExportDebug,
  onOpenWeaverSettings,
  onOpenArchitectForge
}) => {
  // =========================================================================
  // STATE
  // =========================================================================

  const [cumulativeChaos, setCumulativeChaos] = useState(0);
  const paradoxLevel = state.paradoxLevel || 0;
  const chaos = (state as any).chaos || 0;
  const inCombat = state.player?.inCombat ?? false;
  // Trade state subscription deferred to future iteration (requires consensus diagnostics integration)
  const isInTrade = false;

  // Animate chaos level changes
  useEffect(() => {
    setCumulativeChaos((prev) => {
      const target = chaos;
      const diff = target - prev;
      if (Math.abs(diff) < 1) return target;
      return prev + (diff > 0 ? 1 : -1);
    });
  }, [chaos]);

  // =========================================================================
  // RENDER
  // =========================================================================

  const chaosIntensity = Math.max(0, Math.min(100, cumulativeChaos));
  const paradoxIntensity = Math.max(0, Math.min(100, paradoxLevel));

  // Chaos color gradient: blue → purple → red
  const getChaosColor = (intensity: number) => {
    if (intensity < 33) return '#3b82f6'; // blue
    if (intensity < 66) return '#a855f7'; // purple
    return '#ef4444'; // red
  };

  // Paradox color gradient: green → yellow → red
  const getParadoxColor = (intensity: number) => {
    if (intensity < 33) return '#10b981'; // green
    if (intensity < 66) return '#f59e0b'; // amber
    return '#dc2626'; // red
  };

  // Latency color gradient: green → yellow → red
  const getLatencyColor = (latency: number) => {
    if (latency < 100) return '#10b981';
    if (latency < 300) return '#f59e0b';
    return '#dc2626';
  };

  return (
    <div
      style={{
        position: 'relative',
        borderBottom: '2px solid #4f2783',
        backgroundColor: 'rgba(13, 13, 26, 0.98)',
        backdropFilter: 'blur(10px)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        zIndex: 998,
        // M39 Task 5: Chaos-driven visual corruption
        animation: chaosIntensity > 80 ? 'glitch 0.15s linear infinite' : 'none',
        filter: chaosIntensity > 66 ? `brightness(${1 - chaosIntensity * 0.005}) saturate(${1 + chaosIntensity * 0.02})` : 'none'
      }}
    >
      {/* M39 Task 5: Chaos static overlay */}
      {chaosIntensity > 50 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 800 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='800' height='60' fill='%23fff' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
            opacity: (chaosIntensity - 50) * 0.02,
            pointerEvents: 'none'
          }}
        />
      )}

      {/* LEFT: Telemetry Status */}
      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        {/* Chaos Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#999',
              minWidth: '50px'
            }}
          >
            CHAOS
          </span>
          <div
            style={{
              width: '120px',
              height: '24px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid #444',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${chaosIntensity}%`,
                height: '100%',
                backgroundColor: getChaosColor(chaosIntensity),
                transition: 'width 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
              }}
            >
              {Math.round(chaosIntensity)}%
            </div>
          </div>
        </div>

        {/* Paradox Meter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#999',
              minWidth: '55px'
            }}
          >
            PARADOX
          </span>
          <div
            style={{
              width: '120px',
              height: '24px',
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              border: '1px solid #444',
              borderRadius: '4px',
              overflow: 'hidden',
              position: 'relative'
            }}
          >
            <div
              style={{
                width: `${paradoxIntensity}%`,
                height: '100%',
                backgroundColor: getParadoxColor(paradoxIntensity),
                transition: 'width 0.2s ease'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '9px',
                fontWeight: 'bold',
                color: '#fff',
                textShadow: '0 0 4px rgba(0, 0, 0, 0.8)'
              }}
            >
              {Math.round(paradoxIntensity)}%
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Status Indicators */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '10px', position: 'relative', zIndex: 1 }}>
        {/* Combat Status */}
        {inCombat && (
          <div
            style={{
              padding: '4px 8px',
              backgroundColor: '#dc2626',
              borderRadius: '3px',
              color: '#fff',
              fontWeight: 'bold',
              animation: 'pulse 1s infinite'
            }}
          >
            ⚔️ IN COMBAT
          </div>
        )}

        {/* Trade Status */}
        {isInTrade && (
          <div
            style={{
              padding: '4px 8px',
              backgroundColor: '#f59e0b',
              borderRadius: '3px',
              color: '#000',
              fontWeight: 'bold'
            }}
          >
            💱 TRADING
          </div>
        )}

        {/* Macro Events */}
        {macroEventDiagnostics && macroEventDiagnostics.activeCount > 0 && (
          <div
            style={{
              padding: '4px 8px',
              backgroundColor: 'rgba(168, 85, 247, 0.3)',
              border: '1px solid #a855f7',
              borderRadius: '3px',
              color: '#c084fc'
            }}
          >
            ⚠️ {macroEventDiagnostics.activeCount} Event
            {macroEventDiagnostics.activeCount > 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* RIGHT: Multiplayer Diagnostics */}
      {consensusDiagnostics && (
        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            fontSize: '10px',
            paddingLeft: '12px',
            borderLeft: '1px solid #333',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ color: '#a78bfa' }}>
            👥 {consensusDiagnostics.peerCount} peer
            {consensusDiagnostics.peerCount === 1 ? '' : 's'}
          </div>
          <div
            style={{
              color: getLatencyColor(consensusDiagnostics.averageLatency)
            }}
          >
            🗗 {Math.round(consensusDiagnostics.averageLatency)}ms
          </div>
          {consensusDiagnostics.activeProposals > 0 && (
            <div style={{ color: '#c084fc' }}>
              ⚡ {consensusDiagnostics.activeProposals} proposal
              {consensusDiagnostics.activeProposals === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {/* Phase 4 Task 3: AI Weaver Settings Button */}
      {onOpenWeaverSettings && (
        <button
          onClick={onOpenWeaverSettings}
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid #a78bfa',
            color: '#d8b4fe',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            position: 'relative',
            zIndex: 1,
            marginLeft: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.2)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(139, 92, 246, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(139, 92, 246, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="Configure AI providers (Gemini, Groq, Ollama)"
        >
          ✦ AI Weaver
        </button>
      )}

      {/* Phase 4 Task 5: Architect's Forge Button */}
      {onOpenArchitectForge && (
        <button
          onClick={onOpenArchitectForge}
          style={{
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            border: '1px solid #d8b4fe',
            color: '#f3e8ff',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            position: 'relative',
            zIndex: 1,
            marginLeft: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.2)';
            e.currentTarget.style.boxShadow = '0 0 10px rgba(168, 85, 247, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="Live world structure mutation - locations, biomes, factions"
        >
          ⚙ Architect's Forge
        </button>
      )}

      {/* M41 Task 3: Debug Export Button */}
      {onExportDebug && (
        <button
          onClick={onExportDebug}
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            color: '#fbbf24',
            padding: '6px 12px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 500,
            transition: 'all 0.2s ease',
            position: 'relative',
            zIndex: 1,
            marginLeft: '8px'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.2)';
            e.currentTarget.style.boxShadow = '0 0 8px rgba(245, 158, 11, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(245, 158, 11, 0.1)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          title="Export current world state as JSON"
        >
          🐜 Debug
        </button>
      )}

      {/* CSS for pulse animation + M39 Task 5: Glitch effect */}
      <style>
        {`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          
          @keyframes glitch {
            0% { transform: translate(0); }
            20% { transform: translate(-2px, 2px); }
            40% { transform: translate(-2px, -2px); }
            60% { transform: translate(2px, 2px); }
            80% { transform: translate(2px, -2px); }
            100% { transform: translate(0); }
          }
        `}
      </style>
    </div>
  );
};

export default BetaGlobalHeader;
