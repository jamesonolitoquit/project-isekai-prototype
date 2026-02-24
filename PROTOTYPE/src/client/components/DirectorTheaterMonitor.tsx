/**
 * M44-D5: Director Theater Monitor UI
 * 
 * Real-time telemetry dashboard for Director GM showing:
 * - World Tension heatmap (faction control by location)
 * - Economic Hotspots (high-price-volatility areas)
 * - Active Causal Weather Rules (what's driving current weather)
 * - Player Activity Map (where players are concentrated)
 * - Macro event countdown (next scheduled events)
 * 
 * Integrates with existing DirectorConsole as secondary panel.
 */

import React, { useState, useEffect } from 'react';
import type { WorldState } from '../../engine/worldEngine';
import { getFactionWarfareEngine } from '../../engine/factionWarfareEngine';
import { getMarketEngine } from '../../engine/marketEngine';
import { getCausalWeatherEngine } from '../../engine/causalWeatherEngine';
import { liveOpsEngine } from '../../engine/liveOpsEngine';

export interface TheaterMetrics {
  worldTension: Map<string, number>; // locationId → tension 0-1
  economicHotspots: Array<{ locationId: string; volatility: number; priceMultiplier: number }>;
  activeWeatherRules: Array<{ locationId: string; weather: string; cause: string }>;
  playerConcentration: Map<string, number>; // locationId → player count
  macroEventCountdown: Array<{ eventId: string; eventName: string; ticksRemaining: number; severity: number }>;
  consensusHealth: number; // 0-1
  overallWorldTension: number; // Average across all locations
}

/**
 * M44-D5: Theater Monitor - collects real-time telemetry
 */
export class DirectorTheaterMonitor {
  /**
   * M44-D5: Collect all theater metrics from engines
   */
  static collectMetrics(worldState: WorldState, playerLocations: Map<string, string[]>): TheaterMetrics {
    const factionEngine = getFactionWarfareEngine();
    const marketEngine = getMarketEngine();
    const weatherEngine = getCausalWeatherEngine();

    // World Tension: faction contention by location
    const worldTension = new Map<string, number>();
    const locationIds = (worldState.locations || []).map(l => l.id);
    let totalTension = 0;

    for (const locId of locationIds) {
      const warZone = factionEngine.getWarZoneStatus(locId);
      const tension = warZone.contentionLevel || 0;
      worldTension.set(locId, tension);
      totalTension += tension;
    }

    const overallWorldTension = locationIds.length > 0 ? totalTension / locationIds.length : 0;

    // Economic Hotspots: locations with high price volatility
    const economicHotspots: Array<{ locationId: string; volatility: number; priceMultiplier: number }> = [];
    const marketRules = marketEngine.getAllFactionPricingRules();

    for (const locId of locationIds) {
      const warZone = factionEngine.getWarZoneStatus(locId);
      const dominantFaction = warZone.currentDominant as any;

      if (dominantFaction && marketRules.find(r => r.factionId === dominantFaction)) {
        // Calculate price volatility (simple: based on tax rate + price modifiers)
        const rule = marketRules.find(r => r.factionId === dominantFaction);
        const volatility = rule?.baseTaxRate || 0.15;
        const priceMultiplier = marketEngine.getItemPriceMultiplier('luxury', dominantFaction);

        if (volatility > 0.1) {
          economicHotspots.push({ locationId: locId, volatility, priceMultiplier });
        }
      }
    }

    // Active Weather Rules
    const activeWeathers = weatherEngine.getActiveWeathers();
    const activeWeatherRules: Array<{ locationId: string; weather: string; cause: string }> = [];

    for (const [locId, weather] of activeWeathers) {
      activeWeatherRules.push({
        locationId: locId,
        weather: weather.current,
        cause: weather.causedBy,
      });
    }

    // Player Concentration
    const playerConcentration = new Map<string, number>();
    for (const [locId, players] of playerLocations) {
      playerConcentration.set(locId, players.length);
    }

    // Macro Event Countdown
    const scheduledEvents = liveOpsEngine.getScheduledEvents();
    const macroEventCountdown = scheduledEvents
      .map(evt => ({
        eventId: evt.scheduleId,
        eventName: evt.eventName,
        ticksRemaining: Math.max(0, evt.scheduledFireTick - (worldState.tick || 0)),
        severity: evt.severity,
      }))
      .sort((a, b) => a.ticksRemaining - b.ticksRemaining)
      .slice(0, 5); // Top 5 upcoming events

    // Consensus Health (mock: would pull from multiplayerEngine)
    const consensusHealth = 0.95; // Placeholder

    return {
      worldTension,
      economicHotspots,
      activeWeatherRules,
      playerConcentration,
      macroEventCountdown,
      consensusHealth,
      overallWorldTension,
    };
  }

  /**
   * M44-D5: Format metrics for display
   */
  static formatMetricsForDisplay(metrics: TheaterMetrics): string {
    let output = '';

    output += '\n╔════════════════════════════════════════╗\n';
    output += '║       DIRECTOR THEATER MONITOR         ║\n';
    output += '╚════════════════════════════════════════╝\n\n';

    output += '📊 WORLD TENSION\n';
    output += `Overall: ${(metrics.overallWorldTension * 100).toFixed(1)}%\n`;
    for (const [loc, tension] of metrics.worldTension.entries()) {
      const bar = '█'.repeat(Math.floor(tension * 20)) + '░'.repeat(20 - Math.floor(tension * 20));
      output += `  ${loc.padEnd(15)} [${bar}] ${(tension * 100).toFixed(0)}%\n`;
    }

    output += '\n💰 ECONOMIC HOTSPOTS\n';
    if (metrics.economicHotspots.length > 0) {
      for (const spot of metrics.economicHotspots) {
        output += `  ${spot.locationId}: ×${spot.priceMultiplier.toFixed(2)} multiplier (${(spot.volatility * 100).toFixed(1)}% tax)\n`;
      }
    } else {
      output += '  [Stable markets]\n';
    }

    output += '\n🌦️  ACTIVE WEATHER RULES\n';
    if (metrics.activeWeatherRules.length > 0) {
      for (const rule of metrics.activeWeatherRules) {
        output += `  ${rule.locationId}: ${rule.weather} (${rule.cause})\n`;
      }
    } else {
      output += '  [No active causal weather]\n';
    }

    output += '\n👥 PLAYER CONCENTRATION\n';
    if (metrics.playerConcentration.size > 0) {
      for (const [loc, count] of metrics.playerConcentration) {
        if (count > 0) {
          output += `  ${loc}: ${count} player${count !== 1 ? 's' : ''}\n`;
        }
      }
    } else {
      output += '  [No players in world]\n';
    }

    output += '\n⏰ MACRO EVENT COUNTDOWN\n';
    if (metrics.macroEventCountdown.length > 0) {
      for (const evt of metrics.macroEventCountdown) {
        const severity = '█'.repeat(Math.min(10, Math.floor(evt.severity / 10)));
        output += `  [${evt.ticksRemaining}t] ${evt.eventName} ${severity}\n`;
      }
    } else {
      output += '  [No scheduled events]\n';
    }

    output += `\n🔗 CONSENSUS: ${(metrics.consensusHealth * 100).toFixed(1)}%\n`;

    return output;
  }
}

/**
 * M44-D5: React component for Theater Monitor
 */
export const DirectorTheaterPanel: React.FC<{
  worldState: WorldState;
  playerLocations: Map<string, string[]>;
  isExpanded?: boolean;
}> = ({ worldState, playerLocations, isExpanded = true }) => {
  const [metrics, setMetrics] = useState<TheaterMetrics | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      const newMetrics = DirectorTheaterMonitor.collectMetrics(worldState, playerLocations);
      setMetrics(newMetrics);
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 1000); // Update every tick

    return () => clearInterval(interval);
  }, [worldState, playerLocations]);

  if (!metrics || !isExpanded) return null;

  return (
    <div
      style={{
        background: '#1a1a1a',
        border: '2px solid #0099ff',
        borderRadius: '4px',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: '1.4',
        color: '#0099ff',
        maxHeight: '400px',
        overflow: 'auto',
      }}
    >
      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
        {DirectorTheaterMonitor.formatMetricsForDisplay(metrics)}
      </pre>
    </div>
  );
};
