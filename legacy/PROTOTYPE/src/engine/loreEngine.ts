/**
 * M33: Lore Engine - Shared Lore Propagation (The "Whispering Weave")
 * 
 * Purpose: Enable communities to hear news of other player journeys through a
 * "Rumor Exchange" system. Hard Canon events from Player A's chronicle can be
 * "leaked" to Player B's session if they're playing the same World Template,
 * even in disconnected world-lines.
 * 
 * Mechanism:
 * - When a Hard Canon event is logged, it's broadcasted to a shared rumor ledger
 * - Other connected sessions can query this ledger for "heard rumors"
 * - NPCs react to rumors with dialogue updates
 * - This creates a sense of shared world history despite separate playthroughs
 */

import type { NPC } from './worldEngine';
import type { Event } from '../events/mutationLog';

/**
 * M33: A "heard" rumor from another player's chronicle
 */
export interface Rumor {
  id: string;
  source: {
    playerName: string;
    chronicleId: string;
    worldTemplateId: string;
    epochId: string;
  };
  content: {
    title: string;
    description: string;
    eventType: string; // Hard Canon event type
    magnitude?: number; // 1-100: impact/notability
    timestamp: number; // When the rumor was logged
  };
  propagatedAt: number; // When this rumor entered the ledger
  reliability?: number; // 0-100: How believable this rumor is
  hearingHistory?: Array<{
    sessionId: string;
    heardAt: number;
    reactionNpcs?: string[]; // Which NPCs reacted to this
  }>;
}

/**
 * M33: Hard Canon event eligible for rumor propagation
 */
export interface HardCanonEvent extends Event {
  name?: string; // User-friendly event name (may be different from 'type')
  magnitude?: number; // 1-100 relevance for propagation
  isPublic?: boolean; // True = should propagate to other sessions
  rumorTitle?: string; // Sensationalized title for rumor
}

/**
 * M33: Global rumor ledger (shared across all sessions for a world template)
 */
interface RumorLedger {
  worldTemplateId: string;
  rumors: Map<string, Rumor>;
  lastCleanupTick?: number;
}

/**
 * M33: Rumor Registry - maps world templates to their rumor ledgers
 */
const RUMOR_REGISTRIES: Map<string, RumorLedger> = new Map();

/**
 * M33: Get or create a rumor ledger for a world template
 */
function getOrCreateRumorLedger(worldTemplateId: string): RumorLedger {
  if (!RUMOR_REGISTRIES.has(worldTemplateId)) {
    RUMOR_REGISTRIES.set(worldTemplateId, {
      worldTemplateId,
      rumors: new Map(),
      lastCleanupTick: Date.now()
    });
  }
  return RUMOR_REGISTRIES.get(worldTemplateId)!;
}

/**
 * M33: Log a Hard Canon event as a rumor (propagates to other sessions)
 * Called when a significant game event occurs
 */
export function propagateHardCanonEvent(
  event: HardCanonEvent,
  playerName: string,
  chronicleId: string,
  worldTemplateId: string,
  epochId: string
): Rumor {
  const ledger = getOrCreateRumorLedger(worldTemplateId);

  const eventTitle = event.rumorTitle || event.name || event.type || 'Unknown Event';

  const rumor: Rumor = {
    id: `rumor_${event.id}_${Date.now()}`,
    source: {
      playerName,
      chronicleId,
      worldTemplateId,
      epochId
    },
    content: {
      title: eventTitle,
      description: `${playerName} was involved in: ${eventTitle}`,
      eventType: event.type,
      magnitude: event.magnitude || 50,
      timestamp: Date.now()
    },
    propagatedAt: Date.now(),
    reliability: Math.max(50, event.magnitude ? event.magnitude / 2 : 50),
    hearingHistory: []
  };

  ledger.rumors.set(rumor.id, rumor);

  console.log(
    `[LoReEngine] Hard Canon "${rumor.content.title}" propagated to global ledger`
  );

  return rumor;
}

/**
 * M33: Query rumor ledger for a session
 * Returns rumors that haven't been "heard" yet in this session
 */
export function getUnheardRumors(
  worldTemplateId: string,
  sessionId: string,
  maxResults: number = 5
): Rumor[] {
  const ledger = getOrCreateRumorLedger(worldTemplateId);

  const unheard = Array.from(ledger.rumors.values())
    .filter(rumor => {
      // Filter out rumors already heard in this session
      const heardInSession = rumor.hearingHistory?.some(h => h.sessionId === sessionId);
      return !heardInSession;
    })
    // Sort by magnitude and recency
    .sort((a, b) => {
      const aMagnitude = a.content.magnitude || 50;
      const bMagnitude = b.content.magnitude || 50;
      return bMagnitude - aMagnitude || b.propagatedAt - a.propagatedAt;
    })
    .slice(0, maxResults);

  return unheard;
}

/**
 * M33: Mark a rumor as "heard" in a session
 * Optionally track which NPCs reacted to it
 */
export function markRumorAsHeard(
  worldTemplateId: string,
  rumorId: string,
  sessionId: string,
  reactingNpcs?: string[]
): boolean {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumor = ledger.rumors.get(rumorId);

  if (!rumor) {
    return false;
  }

  if (!rumor.hearingHistory) {
    rumor.hearingHistory = [];
  }

  rumor.hearingHistory.push({
    sessionId,
    heardAt: Date.now(),
    reactionNpcs: reactingNpcs
  });

  // Bump reliability after it's been corroborated in multiple sessions
  const uniqueSessions = new Set(rumor.hearingHistory.map(h => h.sessionId));
  rumor.reliability = Math.min(
    100,
    (rumor.reliability || 50) + uniqueSessions.size * 5
  );

  return true;
}

/**
 * M33: Generate NPC dialogue reaction to a heard rumor
 * Can be used to update NPC dialogue when they "hear" about distant events
 */
export function generateRumorReactionDialogue(npc: NPC, rumor: Rumor): string {
  const reactions: Record<string, string[]> = {
    combat: [
      `I heard tales of a great battle involving ${rumor.source.playerName}...`,
      `Whispers of combat echo from the ${rumor.source.epochId}...`,
      `They say ${rumor.source.playerName} fought something fearsome.`
    ],
    discovery: [
      `${rumor.source.playerName} uncovered something remarkable, they say...`,
      `There are rumors of a great discovery in distant lands...`,
      `The explorers speak of ${rumor.source.playerName}'s findings.`
    ],
    ritual: [
      `I heard that ${rumor.source.playerName} performed an ancient ritual...`,
      `Strange whispers of magical workings ripple through the weave...`,
      `The arcane energies suggest ${rumor.source.playerName} channeled something powerful.`
    ],
    death: [
      `${rumor.source.playerName}'s tale has ended, or so the rumors say...`,
      `The weave trembles with news of a great loss...`,
      `A legendary figure has fallen, they whisper...`
    ]
  };

  const categoryReactions =
    reactions[rumor.content.eventType] || reactions['discovery'];
  return categoryReactions[Math.floor(Math.random() * categoryReactions.length)];
}

/**
 * M33: Get all rumors from a specific epoch/timeline
 * Useful for "oracle" NPCs that have knowledge of other timelines
 */
export function getRumorsFromEpoch(
  worldTemplateId: string,
  epochId: string
): Rumor[] {
  const ledger = getOrCreateRumorLedger(worldTemplateId);

  return Array.from(ledger.rumors.values())
    .filter(rumor => rumor.source.epochId === epochId)
    .sort((a, b) => b.propagatedAt - a.propagatedAt);
}

/**
 * M33: Calculate "timeline divergence" based on rumor count
 * More rumors from other timelines = higher divergence state
 */
export function calculateTimelineDivergence(
  worldTemplateId: string,
  sessionId: string
): number {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const heardCount = Array.from(ledger.rumors.values()).filter(
    r => r.hearingHistory?.some(h => h.sessionId === sessionId)
  ).length;

  // Divergence scale: 0-100
  // 0 = isolated timeline, 100 = deeply entangled with many other timelines
  const totalRumors = ledger.rumors.size;
  if (totalRumors === 0) return 0;

  return Math.min(100, (heardCount / totalRumors) * 100);
}

/**
 * M33: Cleanup old rumors (optional, for memory management)
 * Keeps only rumors from the last N days
 */
export function cleanupOldRumors(
  worldTemplateId: string,
  maxAgeMs: number = 7 * 24 * 60 * 60 * 1000 // 7 days
): number {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const now = Date.now();
  const toDelete: string[] = [];

  const rumorEntries = Array.from(ledger.rumors.entries());
  for (const [id, rumor] of rumorEntries) {
    if (now - rumor.propagatedAt > maxAgeMs) {
      toDelete.push(id);
    }
  }

  for (const id of toDelete) {
    ledger.rumors.delete(id);
  }

  ledger.lastCleanupTick = now;

  console.log(`[LoreEngine] Cleaned up ${toDelete.length} old rumors from ${worldTemplateId}`);

  return toDelete.length;
}

/**
 * M33: Get statistics on the rumor ledger
 */
export function getRumorLedgerStats(worldTemplateId: string): {
  totalRumors: number;
  averageReliability: number;
  mostHeardRumor?: string;
  epochsRepresented: string[];
} {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumors = Array.from(ledger.rumors.values());

  if (rumors.length === 0) {
    return {
      totalRumors: 0,
      averageReliability: 0,
      epochsRepresented: []
    };
  }

  const totalReliability = rumors.reduce((sum, r) => sum + (r.reliability || 0), 0);
  const averageReliability = totalReliability / rumors.length;

  const mostHeard = rumors.reduce((max, r) =>
    (r.hearingHistory?.length || 0) > (max.hearingHistory?.length || 0) ? r : max
  );

  const epochs = new Set(rumors.map(r => r.source.epochId));

  return {
    totalRumors: rumors.length,
    averageReliability,
    mostHeardRumor: mostHeard.id,
    epochsRepresented: Array.from(epochs)
  };
}

/**
 * M33: Export rumor ledger for debugging/backup
 */
export function exportRumorLedger(worldTemplateId: string): string {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumorArray = Array.from(ledger.rumors.values());

  return JSON.stringify(
    {
      worldTemplateId,
      rumorCount: rumorArray.length,
      rumors: rumorArray,
      stats: getRumorLedgerStats(worldTemplateId)
    },
    null,
    2
  );
}

/**
 * M33: Clear all rumors for a world template (use with caution)
 */
export function clearRumorLedger(worldTemplateId: string): boolean {
  if (RUMOR_REGISTRIES.has(worldTemplateId)) {
    RUMOR_REGISTRIES.delete(worldTemplateId);
    console.log(`[LoreEngine] Cleared rumor ledger for ${worldTemplateId}`);
    return true;
  }
  return false;
}

/**
 * M36 Task 2: Semantic Lore Search — Context-Aware Proximity Search
 * 
 * Enables the "Great Weave" to find contextually related prophecies and events.
 * Uses semantic similarity, temporal proximity, and theme matching to discover
 * related lore across the rumor ledger.
 * 
 * Applications:
 * - "Show me events related to this prophecy"
 * - "Find all rumors from nearby epochs"
 * - "Search by theme/keyword across chronicles"
 */

export interface SemanticSearchQuery {
  keyword?: string;               // Free-text search
  theme?: string;                 // Thematic category (prophecy, corruption, ascension, etc.)
  epoch?: string;                 // Filter to specific epoch
  minMagnitude?: number;          // Minimum event magnitude (0-100)
  maxResults?: number;            // Limit number of results
  includeExpired?: boolean;        // Include old rumors
}

export interface SemanticSearchResult {
  rumor: Rumor;
  relevanceScore: number;         // 0-100: how relevant to query
  matchedKeywords: string[];      // Which keywords matched
  themeMatch: number;             // How well theme matches
  temporalProximity: number;      // How close in time (0-100)
}

/**
 * M36: Extract semantic themes from a rumor
 */
function extractThemesFromRumor(rumor: Rumor): string[] {
  const themes: Set<string> = new Set();

  const text = `${rumor.content.title} ${rumor.content.description}`.toLowerCase();
  const eventType = rumor.content.eventType.toLowerCase();

  // Prophecy-related keywords
  if (text.includes('prophecy') || text.includes('predict') || text.includes('future')) {
    themes.add('prophecy');
  }

  // Corruption-related keywords
  if (text.includes('corrupt') || text.includes('taint') || text.includes('poison') || eventType.includes('corruption')) {
    themes.add('corruption');
  }

  // Ascension themes
  if (text.includes('ascend') || text.includes('transcend') || text.includes('transcendent')) {
    themes.add('ascension');
  }

  // Combat/Conflict themes
  if (text.includes('battle') || text.includes('war') || text.includes('defeat') || text.includes('victory') || eventType.includes('combat')) {
    themes.add('conflict');
  }

  // Discovery/Exploration themes
  if (text.includes('discover') || text.includes('explore') || text.includes('found') || eventType.includes('discovery')) {
    themes.add('discovery');
  }

  // Divine/Sacred themes
  if (text.includes('god') || text.includes('divine') || text.includes('sanctuary') || text.includes('shrine')) {
    themes.add('divine');
  }

  // Community/Social themes
  if (text.includes('gather') || text.includes('unite') || text.includes('together') || text.includes('collective')) {
    themes.add('community');
  }

  // Temporal themes
  if (text.includes('time') || text.includes('temporal') || text.includes('epoch') || text.includes('era')) {
    themes.add('temporal');
  }

  // If no themes matched, use event type as fallback
  if (themes.size === 0) {
    themes.add(eventType.split('_')[0] || 'misc');
  }

  return Array.from(themes);
}

/**
 * M36: Calculate semantic similarity between two texts
 * Uses simple keyword matching with TF-IDF-like concept
 */
function calculateSemanticSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  // Remove common stop words
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'is', 'was', 'be', 'to', 'of', 'in', 'at', 'on', 'from', 'by']);
  
  const filtered1 = new Set(Array.from(words1).filter(w => !stopWords.has(w) && w.length > 2));
  const filtered2 = new Set(Array.from(words2).filter(w => !stopWords.has(w) && w.length > 2));

  if (filtered1.size === 0 || filtered2.size === 0) return 0;

  // Jaccard similarity
  const intersection = new Set(Array.from(filtered1).filter(w => filtered2.has(w)));
  const union = new Set([...Array.from(filtered1), ...Array.from(filtered2)]);

  return (intersection.size / union.size) * 100;
}

/**
 * M36: Perform semantic search on the rumor ledger
 */
export function semanticSearchRumors(
  worldTemplateId: string,
  query: SemanticSearchQuery
): SemanticSearchResult[] {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumors = Array.from(ledger.rumors.values());
  
  if (rumors.length === 0) return [];

  const now = Date.now();
  const searchText = (query.keyword || '').toLowerCase();
  const searchTheme = (query.theme || '').toLowerCase();

  const results: SemanticSearchResult[] = [];

  for (const rumor of rumors) {
    // Filter by expiration
    if (!query.includeExpired) {
      const rumnorAge = now - rumor.content.timestamp;
      if (rumnorAge > 365 * 24 * 60 * 60 * 1000) {  // Older than 1 year
        continue;
      }
    }

    // Filter by epoch
    if (query.epoch && rumor.source.epochId !== query.epoch) {
      continue;
    }

    // Filter by magnitude
    if (query.minMagnitude && (rumor.content.magnitude || 0) < query.minMagnitude) {
      continue;
    }

    // Calculate relevance score
    let relevanceScore = 0;
    const matchedKeywords: string[] = [];

    // Keyword matching
    if (searchText) {
      const keywordScore = calculateSemanticSimilarity(searchText, rumor.content.title);
      const descScore = calculateSemanticSimilarity(searchText, rumor.content.description);
      relevanceScore += Math.max(keywordScore, descScore) * 0.5;

      // Track matched keywords
      if (keywordScore > 20) {
        matchedKeywords.push(query.keyword || '');
      }
    }

    // Theme matching
    let themeMatch = 0;
    if (searchTheme) {
      const rumorThemes = extractThemesFromRumor(rumor);
      if (rumorThemes.includes(searchTheme)) {
        themeMatch = 100;
      } else {
        // Partial theme matching
        for (const theme of rumorThemes) {
          const similarity = calculateSemanticSimilarity(searchTheme, theme);
          themeMatch = Math.max(themeMatch, similarity);
        }
      }
      relevanceScore += themeMatch * 0.3;
    } else {
      // If no theme specified, generic theme relevance
      themeMatch = 50 + (rumor.content.magnitude || 50) / 2;
      relevanceScore += themeMatch * 0.15;
    }

    // Temporal proximity (recent events weighted higher)
    const daysSincEvent = (now - rumor.content.timestamp) / (24 * 60 * 60 * 1000);
    const temporalProximity = Math.max(0, 100 - daysSincEvent);
    relevanceScore += temporalProximity * 0.2;

    // Reliability bonus
    relevanceScore += (rumor.reliability || 50) * 0.1;

    if (relevanceScore > 0) {
      results.push({
        rumor,
        relevanceScore: Math.round(relevanceScore),
        matchedKeywords,
        themeMatch: Math.round(themeMatch),
        temporalProximity: Math.round(temporalProximity)
      });
    }
  }

  // Sort by relevance and limit results
  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, query.maxResults || 10);
}

/**
 * M36: Find rumors thematically related to a given rumor
 */
export function findRelatedRumors(
  worldTemplateId: string,
  rumor: Rumor,
  maxResults: number = 5
): { related: Rumor; similarity: number }[] {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumors = Array.from(ledger.rumors.values()).filter(r => r.id !== rumor.id);

  const sourceThemes = extractThemesFromRumor(rumor);
  const sourceText = `${rumor.content.title} ${rumor.content.description}`;

  const related: { related: Rumor; similarity: number }[] = [];

  for (const candidate of rumors) {
    const candidateThemes = extractThemesFromRumor(candidate);
    const candidateText = `${candidate.content.title} ${candidate.content.description}`;

    // Theme overlap
    const themeOverlap = sourceThemes.filter(t => candidateThemes.includes(t)).length;
    const themeScore = (themeOverlap / Math.max(sourceThemes.length, candidateThemes.length)) * 100;

    // Text similarity
    const textScore = calculateSemanticSimilarity(sourceText, candidateText);

    // Temporal proximity (prefer events from similar time periods)
    const timeDiff = Math.abs(rumor.content.timestamp - candidate.content.timestamp);
    const temporalScore = Math.max(0, 100 - (timeDiff / (7 * 24 * 60 * 60 * 1000)));  // Decay over weeks

    // Combined similarity
    const similarity = (themeScore * 0.4) + (textScore * 0.4) + (temporalScore * 0.2);

    if (similarity > 20) {
      related.push({ related: candidate, similarity: Math.round(similarity) });
    }
  }

  related.sort((a, b) => b.similarity - a.similarity);
  return related.slice(0, maxResults);
}

/**
 * M36: Get semantic statistics about the rumor ledger
 */
export function getSemanticLoreStatistics(worldTemplateId: string): {
  totalRumors: number;
  uniqueThemes: string[];
  themeDistribution: Record<string, number>;
  mostCommonTheme: string;
  averageReliability: number;
} {
  const ledger = getOrCreateRumorLedger(worldTemplateId);
  const rumors = Array.from(ledger.rumors.values());

  const themeDistribution: Record<string, number> = {};
  let totalReliability = 0;

  for (const rumor of rumors) {
    const themes = extractThemesFromRumor(rumor);
    for (const theme of themes) {
      themeDistribution[theme] = (themeDistribution[theme] || 0) + 1;
    }
    totalReliability += rumor.reliability || 0;
  }

  const uniqueThemes = Object.keys(themeDistribution);
  const mostCommonTheme = uniqueThemes.length > 0
    ? uniqueThemes.reduce((max, theme) => themeDistribution[theme] > (themeDistribution[max] || 0) ? theme : max, uniqueThemes[0])
    : 'unknown';

  return {
    totalRumors: rumors.length,
    uniqueThemes,
    themeDistribution,
    mostCommonTheme,
    averageReliability: rumors.length > 0 ? totalReliability / rumors.length : 0
  };
}
