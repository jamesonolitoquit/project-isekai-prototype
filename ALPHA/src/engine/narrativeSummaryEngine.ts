/**
 * ALPHA_M17 - AI DM Narrative Summary: The Tale Untrue
 * 
 * Purpose: Generate a personalized narrative summarizing the player's session,
 * written in the voice of the AI DM. Uses:
 * - Playstyle vectors (combat, diplomat, explorer dominant traits)
 * - Major turning points from the Chronos Ledger
 * - Temporal debt and metagaming consequences
 * - Faction relationships and lore discoveries
 * 
 * Output: "Tale Untrue" - A narrative that feels like:
 *   A story the DM tells about what just happened, colored by the player's choices
 *   (Can be displayed as session recap, achievement summary, or shared social content)
 */

import type { PlaystyleVector, PlayerPreferences } from './analyticsEngine';
import type { TurningPoint, ChronosLedger } from './chronosLedgerEngine';
import type { WorldState } from './worldEngine';

export interface TaleUntrue {
  id: string;
  title: string;
  timestamp: number;
  sessionDuration: number; // Ticks played
  
  // Narrative sections
  opening: string;
  chapters: Array<{
    title: string;
    narrative: string;
    turningPoint?: TurningPoint;
  }>;
  climax: string;
  ending: string;
  epilogue: string;
  
  // Metadata
  playstyleArchetype: string; // e.g., "The Ruthless Combatant", "The Diplomatic Scholar"
  themes: string[]; // Recurring themes (revenge, redemption, discovery, etc.)
  dominantNarrative: string; // Primary story thread
  
  stats: {
    questsCompleted: number;
    npcAlliances: number;
    locationsDiscovered: number;
    loreUnlocked: number;
    consequencesTriggered: number;
    temporalInterventions: number;
  };
}

export interface NarrativeStyle {
  tone: 'heroic' | 'tragic' | 'comedic' | 'mysterious' | 'dark' | 'inspiring';
  perspective: 'second_person' | 'third_person' | 'unreliable_narrator';
  verbose: boolean; // Short vs detailed narrative
}

/**
 * Determine playstyle archetype from vectors
 */
function getPlaystyleArchetype(playstyle: PlaystyleVector): string {
  const { combatant, diplomat, explorer, dominant } = playstyle;
  
  // Primary archetype
  let archetype = '';
  
  if (dominant === 'combatant') {
    if (combatant > 0.8) archetype = 'The Relentless Warrior';
    else if (combatant > 0.6) archetype = 'The Skilled Fighter';
    else archetype = 'The Combat-Focused Adventurer';
  } else if (dominant === 'diplomat') {
    if (diplomat > 0.8) archetype = 'The Silver-Tongued Diplomat';
    else if (diplomat > 0.6) archetype = 'The Charismatic Negotiator';
    else archetype = 'The Socially Adept Traveler';
  } else if (dominant === 'explorer') {
    if (explorer > 0.8) archetype = 'The Insatiable Explorer';
    else if (explorer > 0.6) archetype = 'The Curious Wanderer';
    else archetype = 'The Discovery-Driven Adventurer';
  } else {
    if (combatant > 0.7 && diplomat > 0.6) archetype = 'The Warrior-Diplomat';
    else if (combatant > 0.7 && explorer > 0.6) archetype = 'The Daring Adventurer';
    else if (diplomat > 0.7 && explorer > 0.6) archetype = 'The Scholarly Wanderer';
    else archetype = 'The Balanced Wanderer';
  }
  
  return archetype;
}

/**
 * Generate narrative opening based on gameplay start
 */
function generateOpening(
  ledger: ChronosLedger,
  playstyle: PlaystyleVector,
  style: NarrativeStyle
): string {
  const archetype = getPlaystyleArchetype(playstyle);
  const firstMajorEvent = ledger.turningPoints.find(tp => tp.category === 'turning_point');
  
  const openings = [
    `A tale of ${archetype} begins not with prophecy, but with choice...`,
    `In the annals of Luxfier, there is a story told of ${archetype}...`,
    `This is what transpired when ${archetype} stepped into the unknown...`,
    `Reality remembers this chronicle: The ascension of ${archetype}...`,
    `The realm trembled as ${archetype} carved their path through destiny...`
  ];
  
  let opening = openings[Math.floor(Math.random() * openings.length)];
  
  if (firstMajorEvent) {
    opening += ` First came ${firstMajorEvent.description.toLowerCase()}, a moment that would echo through time.`;
  }
  
  return opening;
}

/**
 * Generate narrative chapter from turning point
 */
function generateChapter(
  turningPoint: TurningPoint,
  index: number,
  playstyle: PlaystyleVector,
  style: NarrativeStyle
): { title: string; narrative: string } {
  const systemsAffected = turningPoint.affectedSystems.join(', ');
  
  let narrative = '';
  
  // Opening line based on impact
  if (turningPoint.impactScore > 85) {
    narrative = `The threads of fate converged when `;
  } else if (turningPoint.impactScore > 70) {
    narrative = `A turning point emerged: `;
  } else if (turningPoint.impactScore > 50) {
    narrative = `In a moment of significance, `;
  } else {
    narrative = `Progress was made as `;
  }
  
  narrative += turningPoint.description.toLowerCase() + '. ';
  
  // Add context based on affected systems
  if (turningPoint.affectedSystems.includes('faction')) {
    narrative += 'The balance of power in Luxfier shifted. ';
  }
  if (turningPoint.affectedSystems.includes('lore')) {
    narrative += 'Hidden knowledge was unveiled. ';
  }
  if (turningPoint.affectedSystems.includes('suspicion') && style.tone === 'dark') {
    narrative += 'Reality began to fray. ';
  }
  if (turningPoint.affectedSystems.includes('quest')) {
    narrative += 'A path was fulfilled or forsaken. ';
  }
  
  // Add playstyle-specific color
  if (playstyle.combatant > 0.7 && turningPoint.affectedSystems.includes('quest')) {
    narrative += 'Through strength of will and blade, ';
  } else if (playstyle.diplomat > 0.7 && turningPoint.affectedSystems.includes('faction')) {
    narrative += 'Through words and cunning, ';
  } else if (playstyle.explorer > 0.7 && turningPoint.affectedSystems.includes('location')) {
    narrative += 'In discovery of the unknown, ';
  }
  
  narrative += `this moment would be remembered as pivotal (impact: ${Math.round(turningPoint.impactScore)}/100).`;
  
  return {
    title: `Chapter ${index}: ${turningPoint.type.split('_').join(' ').toLowerCase()}`,
    narrative
  };
}

/**
 * Identify recurring themes from events
 */
function identifyThemes(ledger: ChronosLedger, playstyle: PlaystyleVector): string[] {
  const themes: string[] = [];
  
  // Faction themes
  const factionEvents = ledger.turningPoints.filter(tp => tp.affectedSystems.includes('faction'));
  if (factionEvents.length > 3) {
    themes.push('Political intrigue');
  }
  
  // Temporal themes
  const temporalEvents = ledger.turningPoints.filter(tp => tp.affectedSystems.includes('temporal'));
  if (temporalEvents.length > 0) {
    themes.push('Temporal consequences');
  }
  
  // Discovery themes
  const discoveryEvents = ledger.turningPoints.filter(tp => tp.affectedSystems.includes('location') || tp.affectedSystems.includes('lore'));
  if (discoveryEvents.length > 3) {
    themes.push('The burden of knowledge');
    themes.push('Exploration and wonder');
  }
  
  // NPC themes
  const npcEvents = ledger.turningPoints.filter(tp => tp.affectedSystems.includes('npc'));
  if (npcEvents.length > 2) {
    themes.push('bonds formed and broken');
  }
  
  // Reality themes
  const realityEvents = ledger.turningPoints.filter(tp => tp.affectedSystems.includes('reality'));
  if (realityEvents.length > 0) {
    themes.push('The fragility of reality');
  }
  
  // Based on playstyle
  if (playstyle.combatant > 0.7) {
    themes.push('Trials overcome through strength');
  }
  if (playstyle.diplomat > 0.7) {
    themes.push('Understanding through dialogue');
  }
  if (playstyle.explorer > 0.7) {
    themes.push('The rewards of curiosity');
  }
  
  return Array.from(new Set(themes)).slice(0, 5); // Unique, max 5
}

/**
 * Generate narrative climax section
 */
function generateClimax(
  ledger: ChronosLedger,
  suspicionLevel: number,
  playstyle: PlaystyleVector,
  style: NarrativeStyle
): string {
  const climaxEvents = ledger.turningPoints.filter(tp => tp.category === 'turning_point');
  const lastMajorEvent = climaxEvents[climaxEvents.length - 1];
  
  if (!lastMajorEvent) return 'The climax remains uncertain.';
  
  let climax = '';
  
  // Reality rebellion special case
  if (suspicionLevel >= 90) {
    climax = `At the culmination of it all, reality itself rebelled against ${
      style.verbose ? 'such flagrant exploitation of metagame knowledge' : 'the impossible'
    }. The cosmos would not permit further transgression. `;
  } else if (suspicionLevel >= 60) {
    climax = `The crescendo arrived as reality began to fray at the edges. The consequences of metagaming echoed through the world. `;
  } else {
    climax = `The turning point crystallized when ${lastMajorEvent.description.toLowerCase()}. `;
  }
  
  // Add resolution flavor
  if (playstyle.combatant > 0.7) {
    climax += 'Victory was secured through unwavering determination.';
  } else if (playstyle.diplomat > 0.7) {
    climax += 'Understanding was achieved through careful negotiation.';
  } else if (playstyle.explorer > 0.7) {
    climax += 'The truth was revealed through relentless discovery.';
  } else {
    climax += 'A balance was struck between all forces.';
  }
  
  return climax;
}

/**
 * Generate narrative ending
 */
function generateEnding(
  temporalDebt: number,
  questsCompleted: number,
  style: NarrativeStyle
): string {
  let ending = '';
  
  if (temporalDebt > 50) {
    ending = 'But time itself grew heavy with the weight of rewinding. ';
  } else if (temporalDebt > 20) {
    ending = 'The accumulated cost of undoing time whispered warnings. ';
  } else {
    ending = 'The flow of time had held steady. ';
  }
  
  if (questsCompleted > 5) {
    ending += 'Many paths lay completed behind them. ';
  } else if (questsCompleted > 2) {
    ending += 'Several threads had been woven into the tapestry. ';
  } else {
    ending += 'The journey had only begun. ';
  }
  
  ending += 'What lay ahead remained unwritten.';
  
  return ending;
}

/**
 * Generate epilogue with forward-looking statements
 */
function generateEpilogue(
  ledger: ChronosLedger,
  playstyle: PlaystyleVector,
  themes: string[]
): string {
  const epilogues = [
    'The tale does not end here—merely pauses.',
    'And so the chronicle rests, awaiting the next chapter.',
    'Reality holds its breath, waiting for what comes next.',
    'The thread continues, ready to be picked up.',
    'What comes next is written only by choice.'
  ];
  
  let epilogue = epilogues[Math.floor(Math.random() * epilogues.length)];
  
  // Add specific forward hook based on unresolved things
  const unresolvedFactions = ledger.turningPoints
    .filter(tp => tp.affectedSystems.includes('faction'))
    .length < 3;
  
  if (unresolvedFactions) {
    epilogue += ' Many factions remain, their futures uncertain.';
  }
  
  const unresolvedLocations = ledger.turningPoints
    .filter(tp => tp.affectedSystems.includes('location'))
    .length < 5;
  
  if (unresolvedLocations) {
    epilogue += ' Unvisited lands call from beyond the horizon.';
  }
  
  return epilogue;
}

/**
 * Generate the complete "Tale Untrue" narrative
 */
export function generateTaleUntrue(
  ledger: ChronosLedger,
  currentState: WorldState,
  playstyle: PlaystyleVector,
  style: NarrativeStyle = { tone: 'heroic', perspective: 'third_person', verbose: true }
): TaleUntrue {
  const turningPoints = ledger.turningPoints.filter(tp => tp.category === 'turning_point');
  const themes = identifyThemes(ledger, playstyle);
  
  const opening = generateOpening(ledger, playstyle, style);
  
  const chapters = turningPoints.slice(0, 10).map((tp, idx) =>
    generateChapter(tp, idx + 1, playstyle, style)
  );
  
  const climax = generateClimax(ledger, currentState.player.suspicionLevel || 0, playstyle, style);
  
  const questsCompleted = ledger.turningPoints.filter(tp =>
    tp.type.includes('QUEST_COMPLETE')
  ).length;
  
  const ending = generateEnding(currentState.player.temporalDebt || 0, questsCompleted, style);
  const epilogue = generateEpilogue(ledger, playstyle, themes);
  
  const dominantNarrative = chapters[0]?.narrative || opening;
  const archetype = getPlaystyleArchetype(playstyle);
  
  return {
    id: `tale_${Date.now()}`,
    title: `The Tale of ${archetype}`,
    timestamp: Date.now(),
    sessionDuration: currentState.tick || 0,
    
    opening,
    chapters,
    climax,
    ending,
    epilogue,
    
    playstyleArchetype: archetype,
    themes,
    dominantNarrative,
    
    stats: {
      questsCompleted,
      npcAlliances: currentState.npcs?.length || 0,
      locationsDiscovered: currentState.player.visitedLocations?.size || 0,
      loreUnlocked: currentState.player.knowledgeBase?.size || 0,
      consequencesTriggered: ledger.paradoxEchoes.length,
      temporalInterventions: ledger.turningPoints.filter(tp =>
        tp.affectedSystems.includes('temporal')
      ).length
    }
  };
}

/**
 * Format Tale Untrue as readable markdown
 */
export function formatTaleAsMarkdown(tale: TaleUntrue): string {
  const lines: string[] = [];
  
  lines.push(`# ${tale.title}`);
  lines.push('');
  lines.push(`**Archetype:** ${tale.playstyleArchetype}`);
  lines.push(`**Session Duration:** ${Math.floor(tale.sessionDuration / 60)} minutes`);
  lines.push('');
  
  if (tale.themes.length > 0) {
    lines.push(`**Themes:** ${tale.themes.join(', ')}`);
    lines.push('');
  }
  
  lines.push('---');
  lines.push('');
  lines.push(tale.opening);
  lines.push('');
  
  for (const chapter of tale.chapters) {
    lines.push(`## ${chapter.title}`);
    lines.push('');
    lines.push(chapter.narrative);
    lines.push('');
  }
  
  lines.push('## The Culmination');
  lines.push('');
  lines.push(tale.climax);
  lines.push('');
  
  lines.push(tale.ending);
  lines.push('');
  
  lines.push('---');
  lines.push('');
  lines.push(`_${tale.epilogue}_`);
  lines.push('');
  
  // Statistics footer
  lines.push('### Session Statistics');
  lines.push(`- Quests Completed: ${tale.stats.questsCompleted}`);
  lines.push(`- Locations Discovered: ${tale.stats.locationsDiscovered}`);
  lines.push(`- Lore Entries Unlocked: ${tale.stats.loreUnlocked}`);
  lines.push(`- Reality Interventions: ${tale.stats.consequencesTriggered}`);
  
  return lines.join('\n');
}

/**
 * Format Tale Untrue as plain prose paragraph 
 */
export function formatTaleAsPlaintext(tale: TaleUntrue): string {
  let prose = tale.opening + ' ';
  
  for (const chapter of tale.chapters.slice(0, 5)) {
    prose += chapter.narrative + ' ';
  }
  
  prose += tale.climax + ' ' + tale.ending + ' ' + tale.epilogue;
  
  return prose;
}
