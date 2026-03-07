/**
 * Phase 43: Learning Plateau Strings
 * 
 * Maps learning plateau events (daily XP soft caps) to era-appropriate messages
 * for different narrative codecs. Provides linguistic flavor for mechanical constraints.
 */

import type { NarrativeCodec } from '../services/themeManager';

/**
 * Get the learning plateau message for a skill reaching its daily XP soft cap
 */
export function getLearningPlateauMessage(
  skillName: string,
  codecName: NarrativeCodec
): string {
  const messages: Record<NarrativeCodec, (skill: string) => string> = {
    'CODENAME_MEDIEVAL': (skill: string) => 
      `Thy mind is a full vessel; only contemplation of ${skill} remains.`,
    
    'CODENAME_GLITCH': (skill: string) => 
      `[COGNITIVE_BUFFER_SATURATED] ${skill} learning halted. Defrag required.`,
    
    'CODENAME_MINIMAL': (skill: string) => 
      `Learning limit reached for ${skill}. Rest helps skill consolidation.`,
    
    'CODENAME_CYBERPUNK': (skill: string) => 
      `NEURAL_LOAD_CRITICAL: ${skill} synaptic pathway overheating. Cool down required.`,
    
    'CODENAME_SOLARPUNK': (skill: string) => 
      `Your ${skill} expertise needs rest. Let it settle like garden soil.`,
    
    'CODENAME_VOIDSYNC': (skill: string) => 
      `Cosmic consciousness saturated with ${skill}. Await the void's reflection.`,
    
    'CODENAME_NOIR': (skill: string) => 
      `Your head's spinning with ${skill} leads—too many facts, not enough coffee.`,
    
    'CODENAME_OVERLAND': (skill: string) => 
      `Your ${skill} knowledge is overwhelming your mind. Tomorrow brings new clarity.`,
    
    'CODENAME_VINTAGE': (skill: string) => 
      `The ${skill} groove is stuck in your head now; let it rest and swing tomorrow.`,
    
    'CODENAME_STORYBOOK': (skill: string) => 
      `The tale of your ${skill} mastery grows thick; let the pages settle.`,
    
    'CODENAME_DREAMSCAPE': (skill: string) => 
      `Reality bends from the weight of ${skill} learning. Dream first; remember later.`
  };

  const getMsg = messages[codecName] || messages['CODENAME_MINIMAL'];
  return getMsg(skillName);
}

/**
 * Get a generic learning plateau message when no specific skill is known
 */
export function getGenericPlateauMessage(codecName: NarrativeCodec): string {
  const messages: Record<NarrativeCodec, string> = {
    'CODENAME_MEDIEVAL': `Thy mind is a full vessel. Reflection and rest shall sharpen the whetstone.`,
    'CODENAME_GLITCH': `[BUFFER_FULL] Cognitive streams are saturated. Compression and defragmentation pending.`,
    'CODENAME_MINIMAL': `Your mind is full. Rest consolidates what you've learned today.`,
    'CODENAME_CYBERPUNK': `NEURAL_OVERLOAD_DETECTED. Consciousness requires defragmentation.`,
    'CODENAME_SOLARPUNK': `Your mind is like a full bloom flower—give today's learning time to settle.`,
    'CODENAME_VOIDSYNC': `The void's whispers fade. Your consciousness is saturated. Await cosmic equilibrium.`,
    'CODENAME_NOIR': `The evidence locker's full. You need sleep to make sense of the day's haul.`,
    'CODENAME_OVERLAND': `The archive of today's knowledge is brimming. Let it organize overnight.`,
    'CODENAME_VINTAGE': `The band's played all the notes they know for today. Time for a long, cool drink.`,
    'CODENAME_STORYBOOK': `The morning's pages are written. Let them dry before the next chapter.`,
    'CODENAME_DREAMSCAPE': `Reality shivers at the edge of consciousness. Return tomorrow, when dreams and waking blend anew.`
  };

  return messages[codecName] || messages['CODENAME_MINIMAL'];
}

/**
 * Get an encouraging message about reaching a proficiency milestone
 */
export function getMilestoneMessage(
  skillName: string,
  newLevel: number,
  codecName: NarrativeCodec
): string {
  // Journeyman milestone (level 10)
  if (newLevel === 10) {
    const journeymanMessages: Record<NarrativeCodec, (skill: string) => string> = {
      'CODENAME_MEDIEVAL': (skill: string) => 
        `Hark! Thou hast become a ${skill} journeyman—thy craft is now respected.`,
      'CODENAME_GLITCH': (skill: string) => 
        `[PROFICIENCY_MILESTONE] ${skill} = JOURNEYMAN_TIER. Skill floor secured.`,
      'CODENAME_MINIMAL': (skill: string) => 
        `${skill} milestone: You've reached journeyman level. Your foundation is solid.`,
      'CODENAME_CYBERPUNK': (skill: string) => 
        `ACHIEVEMENT_UNLOCKED: ${skill} proficiency_10. Neural pathways stabilized.`,
      'CODENAME_SOLARPUNK': (skill: string) => 
        `Congratulations—your ${skill} roots run deep. You're a journeyman gardener now.`,
      'CODENAME_VOIDSYNC': (skill: string) => 
        `The cosmos acknowledges your ${skill} mastery. Journeyman consciousness achieved.`,
      'CODENAME_NOIR': (skill: string) => 
        `You've cracked the case on ${skill}. Welcome to the journeyman division, detective.`,
      'CODENAME_OVERLAND': (skill: string) => 
        `Your map of ${skill} is getting detailed. You've reached journeyman status.`,
      'CODENAME_VINTAGE': (skill: string) => 
        `Your ${skill} solo is getting tight. Welcome to the journeyman jam session.`,
      'CODENAME_STORYBOOK': (skill: string) => 
        `Your tale of ${skill} has earned you journeyman status in the guild.`,
      'CODENAME_DREAMSCAPE': (skill: string) => 
        `The dream-paths of ${skill} now feel familiar. You walk them as a journeyman.`
    };
    const getMsg = journeymanMessages[codecName] || journeymanMessages['CODENAME_MINIMAL'];
    return getMsg(skillName);
  }

  // Expert milestone (level 15)
  if (newLevel === 15) {
    const expertMessages: Record<NarrativeCodec, (skill: string) => string> = {
      'CODENAME_MEDIEVAL': (skill: string) => 
        `Thy ${skill} excellence is beyond measure—thou art now a master craftsperson.`,
      'CODENAME_GLITCH': (skill: string) => 
        `[ACHIEVEMENT_EXPERT] ${skill} = EXPERT_TIER. Neural optimization complete.`,
      'CODENAME_MINIMAL': (skill: string) => 
        `Expert level reached in ${skill}. Your mastery inspires others.`,
      'CODENAME_CYBERPUNK': (skill: string) => 
        `ELITE_STATUS_ACHIEVED: ${skill} expert_rank. You're a net legend.`,
      'CODENAME_SOLARPUNK': (skill: string) => 
        `Your ${skill} bloom is radiant. You've become a master gardener.`,
      'CODENAME_VOIDSYNC': (skill: string) => 
        `The void bows to your ${skill} mastery. You walk the expert's path.`,
      'CODENAME_NOIR': (skill: string) => 
        `${skill} expert? You're the sharpest eye in the precinct.`,
      'CODENAME_OVERLAND': (skill: string) => 
        `Your ${skill} charts are legendary. Expert status confirmed.`,
      'CODENAME_VINTAGE': (skill: string) => 
        `Your ${skill} improvisations are legendary. Expert musician status.`,
      'CODENAME_STORYBOOK': (skill: string) => 
        `Your ${skill} legend spreads through taverns. Expert bard recognized.`,
      'CODENAME_DREAMSCAPE': (skill: string) => 
        `In dreams and waking, you command ${skill}. Expert consciousness achieved.`
    };
    const getMsg = expertMessages[codecName] || expertMessages['CODENAME_MINIMAL'];
    return getMsg(skillName);
  }

  // Master milestone (level 20)
  if (newLevel === 20) {
    const masterMessages: Record<NarrativeCodec, (skill: string) => string> = {
      'CODENAME_MEDIEVAL': (skill: string) => 
        `LEGEND SPEAKS THY NAME! Thou art now a legendary master of ${skill}!`,
      'CODENAME_GLITCH': (skill: string) => 
        `[LEGENDARY_ACHIEVEMENT] ${skill} = MASTER_TIER. Consciousness_achieved.`,
      'CODENAME_MINIMAL': (skill: string) => 
        `You are now a master of ${skill}. Legends speak your name.`,
      'CODENAME_CYBERPUNK': (skill: string) => 
        `LEGEND_PROTOCOL_ACTIVATED: ${skill} master_rank. You are a digital god.`,
      'CODENAME_SOLARPUNK': (skill: string) => 
        `Your ${skill} mastery blooms eternal. You are the garden itself.`,
      'CODENAME_VOIDSYNC': (skill: string) => 
        `Beyond the void's veil, ${skill} bows to your mastery. You are legend.`,
      'CODENAME_NOIR': (skill: string) => 
        `${skill} legend status—you're the smartest detective in the city.`,
      'CODENAME_OVERLAND': (skill: string) => 
        `Your {{@math skill}} know every land and sea. Master cartographer.`,
      'CODENAME_VINTAGE': (skill: string) => 
        `Your ${skill} solo is the stuff of legend. Master musician achieved.`,
      'CODENAME_STORYBOOK': (skill: string) => 
        `Bards will sing of your ${skill} mastery for centuries to come!`,
      'CODENAME_DREAMSCAPE': (skill: string) => 
        `In the dream-realm, you ARE ${skill}. Master of all possibility.`
    };
    const getMsg = masterMessages[codecName] || masterMessages['CODENAME_MINIMAL'];
    return getMsg(skillName);
  }

  // Generic level-up message
  const levelUpMessages: Record<NarrativeCodec, (skill: string, level: number) => string> = {
    'CODENAME_MEDIEVAL': (skill: string, level: number) => 
      `Thy skill in ${skill} improves—thou hast reached level ${level}.`,
    'CODENAME_GLITCH': (skill: string, level: number) => 
      `[LEVEL_UP] ${skill} = ${level}. Neural pathway expanded.`,
    'CODENAME_MINIMAL': (skill: string, level: number) => 
      `${skill} advanced to level ${level}. Keep practicing.`,
    'CODENAME_CYBERPUNK': (skill: string, level: number) => 
      `SKILL_ADVANCED: ${skill} → ${level}. Neural matrix updated.`,
    'CODENAME_SOLARPUNK': (skill: string, level: number) => 
      `${skill} grows to level ${level}. Your garden flourishes.`,
    'CODENAME_VOIDSYNC': (skill: string, level: number) => 
      `${skill} transcends to level ${level}. Cosmic awareness expands.`,
    'CODENAME_NOIR': (skill: string, level: number) => 
      `Your ${skill} case file is getting thicker—level ${level} now.`,
    'CODENAME_OVERLAND': (skill: string, level: number) => 
      `${skill} experience logged: level ${level} recorded.`,
    'CODENAME_VINTAGE': (skill: string, level: number) => 
      `Your ${skill} groove hits level ${level}. The tempo builds.`,
    'CODENAME_STORYBOOK': (skill: string, level: number) => 
      `Chapter unlocked: ${skill} reaches level ${level}.`,
    'CODENAME_DREAMSCAPE': (skill: string, level: number) => 
      `${skill} ascends to level ${level} in the dream-realm.`
  };

  const getMsg = levelUpMessages[codecName] || levelUpMessages['CODENAME_MINIMAL'];
  return getMsg(skillName, newLevel);
}
