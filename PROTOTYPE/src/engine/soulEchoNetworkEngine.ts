/**
 * soulEchoNetworkEngine.ts - Phase 17: Soul Echo Network
 * 
 * Maps "Semantic Links" between historical events across different epochs.
 * Enables cross-generational lore discovery for the Soul Mirror Séance.
 * 
 * A sword forged in Epoch I might be rediscovered in Epoch III with new properties,
 * connecting the story threads across generations through "Soul Echoes".
 */

import type { WorldState } from './worldEngine';
import type { Event } from '../events/mutationLog';

/**
 * Represents a semantic connection between two historical events
 */
export interface SoulEcho {
  echoId: string;
  sourceEventId: string;          // Original event (e.g., "sword_forged")
  connectedEventId: string;       // Related event (e.g., "sword_rediscovered")
  sourceEpoch: number;
  connectedEpoch: number;
  connectionType: 'artifact' | 'npc' | 'location' | 'faction' | 'prophecy' | 'legacy';
  relevanceScore: number;         // 0.0 to 1.0 (how strongly connected)
  semanticBridge: string;         // Description of connection (e.g., "Same artifact across generations")
  narrativeWeight: number;        // 1-5: How important this connection is to the story
  isPrivate?: boolean;            // Phase 18: Personal/Private echoes don't sync to other players
  timestamp?: number;             // Phase 18: When this echo was created (for sync deduplication)
}

/**
 * Entry point for a historical event that can have soul echoes
 */
export interface EchoableEvent {
  eventId: string;
  eventText: string;
  epoch: number;
  deltaId: string;
  timestamp: number;
  eventType: string;              // e.g., "ARTIFACT_EVENT", "NPC_EVENT", "FACTION_EVENT"
  keywords: string[];             // Searchable terms (e.g., ["sword", "artifact", "forged"])
}

/**
 * Query result for related events
 */
export interface EchoQueryResult {
  primaryEvent: EchoableEvent;
  relatedEvents: Array<{
    event: EchoableEvent;
    echo: SoulEcho;
  }>;
  totalConnections: number;
}

// Global soul echo registry mapping events to their connected events
const soulEchoRegistry = new Map<string, SoulEcho[]>();

// Global echoable events registry for lookup
const echoableEventsRegistry = new Map<string, EchoableEvent>();

// Artifact tracking across epochs (item ID → appearances)
const artifactTimeline = new Map<string, EchoableEvent[]>();

/**
 * Record an echoable event from a chronicle delta
 */
export function recordEchoableEvent(
  event: EchoableEvent
): void {
  echoableEventsRegistry.set(event.eventId, event);

  // Initialize echo connections if not exists
  if (!soulEchoRegistry.has(event.eventId)) {
    soulEchoRegistry.set(event.eventId, []);
  }
}

/**
 * Create a semantic link between two events (bidirectional)
 */
export function linkSoulEchoes(
  sourceEventId: string,
  targetEventId: string,
  connectionType: 'artifact' | 'npc' | 'location' | 'faction' | 'prophecy' | 'legacy',
  semanticBridge: string,
  relevanceScore: number = 0.75,
  narrativeWeight: number = 3
): SoulEcho | null {
  const sourceEvent = echoableEventsRegistry.get(sourceEventId);
  const targetEvent = echoableEventsRegistry.get(targetEventId);

  if (!sourceEvent || !targetEvent) {
    return null;
  }

  const echo: SoulEcho = {
    echoId: `echo-${sourceEventId}-${targetEventId}-${Date.now()}`,
    sourceEventId,
    connectedEventId: targetEventId,
    sourceEpoch: sourceEvent.epoch,
    connectedEpoch: targetEvent.epoch,
    connectionType,
    relevanceScore: Math.min(Math.max(relevanceScore, 0), 1),
    semanticBridge,
    narrativeWeight: Math.max(1, Math.min(narrativeWeight, 5))
  };

  // Add bidirectional links
  if (!soulEchoRegistry.has(sourceEventId)) {
    soulEchoRegistry.set(sourceEventId, []);
  }
  soulEchoRegistry.get(sourceEventId)!.push(echo);

  // Reverse link
  const reverseEcho: SoulEcho = {
    ...echo,
    echoId: `echo-${targetEventId}-${sourceEventId}-${Date.now()}`,
    sourceEventId: targetEventId,
    connectedEventId: sourceEventId,
    sourceEpoch: targetEvent.epoch,
    connectedEpoch: sourceEvent.epoch
  };

  if (!soulEchoRegistry.has(targetEventId)) {
    soulEchoRegistry.set(targetEventId, []);
  }
  soulEchoRegistry.get(targetEventId)!.push(reverseEcho);

  return echo;
}

/**
 * Get all related historical events for a given event ID
 * (Primary function for Soul Mirror Séance lookups)
 */
export function getRelatedHistoricalEvents(eventId: string): EchoQueryResult | null {
  const primaryEvent = echoableEventsRegistry.get(eventId);
  if (!primaryEvent) {
    return null;
  }

  const echos = soulEchoRegistry.get(eventId) || [];
  const relatedEvents = echos
    .map(echo => ({
      event: echoableEventsRegistry.get(echo.connectedEventId),
      echo
    }))
    .filter(item => item.event !== undefined)
    .sort((a, b) => {
      // Sort by relevance score (highest first), then narrative weight
      const scoresDiff = b.echo.relevanceScore - a.echo.relevanceScore;
      if (scoresDiff !== 0) return scoresDiff;
      return b.echo.narrativeWeight - a.echo.narrativeWeight;
    });

  return {
    primaryEvent,
    relatedEvents: relatedEvents as Array<{ event: EchoableEvent; echo: SoulEcho }>,
    totalConnections: echos.length
  };
}

/**
 * Search for events matching specific criteria
 */
export function searchEchoableEvents(
  query: string,
  epochFilter?: number,
  connectionTypeFilter?: string
): EchoableEvent[] {
  const queryLower = query.toLowerCase();
  const results: EchoableEvent[] = [];

  for (const event of echoableEventsRegistry.values()) {
    // Filter by epoch if specified
    if (epochFilter !== undefined && event.epoch !== epochFilter) {
      continue;
    }

    // Check if query matches event text or keywords
    const textMatch = event.eventText.toLowerCase().includes(queryLower);
    const keywordMatch = event.keywords.some(k => k.toLowerCase().includes(queryLower));

    if (textMatch || keywordMatch) {
      results.push(event);
    }
  }

  return results;
}

/**
 * Track an artifact across epochs as it appears in events
 */
export function trackArtifactAppearance(
  artifactId: string,
  event: EchoableEvent
): void {
  if (!artifactTimeline.has(artifactId)) {
    artifactTimeline.set(artifactId, []);
  }

  artifactTimeline.get(artifactId)!.push(event);
}

/**
 * Get the "life story" of an artifact across all epochs
 */
export function getArtifactTimeline(artifactId: string): EchoableEvent[] {
  return (artifactTimeline.get(artifactId) || [])
    .sort((a, b) => a.epoch - b.epoch); // Chronological order
}

/**
 * Auto-link related events based on semantic similarity
 * Uses keyword matching to find natural narrative connections
 */
export function autoLinkSemanticEvents(maxRelevanceScore: number = 0.85): number {
  let linkCount = 0;
  const eventArray = Array.from(echoableEventsRegistry.values());

  for (let i = 0; i < eventArray.length; i++) {
    for (let j = i + 1; j < eventArray.length; j++) {
      const event1 = eventArray[i];
      const event2 = eventArray[j];

      // Skip if from same epoch (temporal dimension requires cross-epoch links)
      if (event1.epoch === event2.epoch) continue;

      // Calculate semantic similarity from keyword overlap
      const commonKeywords = event1.keywords.filter(k =>
        event2.keywords.some(k2 => k2.toLowerCase() === k.toLowerCase())
      );

      if (commonKeywords.length === 0) continue;

      // Relevance based on keyword overlap
      const maxKeywords = Math.max(event1.keywords.length, event2.keywords.length);
      const relevance = commonKeywords.length / maxKeywords;

      if (relevance > 0.3) { // Minimum 30% similarity
        const connectionType = detectConnectionType(event1, event2);
        const bridge = `Related through: ${commonKeywords.join(', ')}`;

        const echo = linkSoulEchoes(
          event1.eventId,
          event2.eventId,
          connectionType,
          bridge,
          Math.min(relevance, maxRelevanceScore),
          Math.ceil(relevance * 5) // Weight 1-5 based on strength
        );

        if (echo) linkCount++;
      }
    }
  }

  return linkCount;
}

/**
 * Detect connection type from event characteristics
 */
function detectConnectionType(
  event1: EchoableEvent,
  event2: EchoableEvent
): 'artifact' | 'npc' | 'location' | 'faction' | 'prophecy' | 'legacy' {
  const text1 = event1.eventText.toLowerCase();
  const text2 = event2.eventText.toLowerCase();
  const combined = text1 + text2;

  if (combined.includes('artifact') || combined.includes('item') || combined.includes('sword')) {
    return 'artifact';
  }
  if (combined.includes('npc') || combined.includes('character') || combined.includes('name')) {
    return 'npc';
  }
  if (combined.includes('location') || combined.includes('place') || combined.includes('realm')) {
    return 'location';
  }
  if (combined.includes('faction') || combined.includes('power') || combined.includes('control')) {
    return 'faction';
  }
  if (combined.includes('prophecy') || combined.includes('fate') || combined.includes('predicted')) {
    return 'prophecy';
  }

  return 'legacy';
}

/**
 * Get statistics about the soul echo network
 */
export function getSoulEchoNetworkStats(): {
  totalEvents: number;
  totalEchos: number;
  averageConnectionsPerEvent: number;
  artifactTimelineCount: number;
  connectionsByType: Record<string, number>;
} {
  const connectionsByType: Record<string, number> = {
    artifact: 0,
    npc: 0,
    location: 0,
    faction: 0,
    prophecy: 0,
    legacy: 0
  };

  let totalEchos = 0;
  for (const echos of soulEchoRegistry.values()) {
    totalEchos += echos.length;
    echos.forEach(echo => {
      connectionsByType[echo.connectionType] = (connectionsByType[echo.connectionType] || 0) + 1;
    });
  }

  return {
    totalEvents: echoableEventsRegistry.size,
    totalEchos: totalEchos / 2, // Divide by 2 since we store bidirectional
    averageConnectionsPerEvent: echoableEventsRegistry.size > 0
      ? (totalEchos / 2) / echoableEventsRegistry.size
      : 0,
    artifactTimelineCount: artifactTimeline.size,
    connectionsByType
  };
}

/**
 * Clear all soul echo data (for testing or new chronicle)
 */
export function clearSoulEchoNetwork(): void {
  soulEchoRegistry.clear();
  echoableEventsRegistry.clear();
  artifactTimeline.clear();
}

/**
 * Export soul echo network for persistence
 */
export function exportSoulEchoNetwork(): {
  events: Record<string, EchoableEvent>;
  echos: Array<{ sourceId: string; echo: SoulEcho }>;
  artifacts: Record<string, EchoableEvent[]>;
} {
  const echos: Array<{ sourceId: string; echo: SoulEcho }> = [];

  for (const [sourceId, sourceEchos] of soulEchoRegistry.entries()) {
    sourceEchos.forEach(echo => {
      echos.push({ sourceId, echo });
    });
  }

  return {
    events: Object.fromEntries(echoableEventsRegistry),
    echos,
    artifacts: Object.fromEntries(artifactTimeline)
  };
}

/**
 * Import soul echo network from persistence
 */
export function importSoulEchoNetwork(data: {
  events: Record<string, EchoableEvent>;
  echos: Array<{ sourceId: string; echo: SoulEcho }>;
  artifacts: Record<string, EchoableEvent[]>;
}): void {
  clearSoulEchoNetwork();

  // Restore events
  for (const [eventId, event] of Object.entries(data.events)) {
    echoableEventsRegistry.set(eventId, event);
  }

  // Restore echos
  for (const { sourceId, echo } of data.echos) {
    if (!soulEchoRegistry.has(sourceId)) {
      soulEchoRegistry.set(sourceId, []);
    }
    soulEchoRegistry.get(sourceId)!.push(echo);
  }

  // Restore artifact timelines
  for (const [artifactId, events] of Object.entries(data.artifacts)) {
    artifactTimeline.set(artifactId, events);
  }
}
/**
 * Phase 18: Check if a soul echo is syncable across players
 * (Private echoes are personal discoveries, not broadcast)
 */
export function isSyncable(echo: SoulEcho): boolean {
  // Private/personal echoes don't sync to other players
  if (echo.isPrivate === true) {
    return false;
  }

  // Prophecy and legacy echoes are always syncable (canonical)
  if (echo.connectionType === 'prophecy' || echo.connectionType === 'legacy') {
    return true;
  }

  // Default: syncable (shared discoveries)
  return true;
}

/**
 * Phase 18: Get all syncable soul echoes for P2P broadcast
 */
export function getSyncableSoulEchoes(): SoulEcho[] {
  const syncable: SoulEcho[] = [];

  for (const echos of soulEchoRegistry.values()) {
    for (const echo of echos) {
      if (isSyncable(echo)) {
        syncable.push(echo);
      }
    }
  }

  return syncable;
}