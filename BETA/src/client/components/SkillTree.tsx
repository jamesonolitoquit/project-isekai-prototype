/**
 * SkillTree Component (Constellation)
 * 
 * Skill point allocation UI displayed as a constellation pattern.
 * Features:
 * - Skill nodes in constellation layout
 * - Prerequisites visualization (connecting lines)
 * - Skill point requirements display
 * - Bonus stat visualization
 * - Unlock/lock state indication
 * - Click-to-learn with validation
 * - Tab-based skill categories (Combat, Magic, Survival)
 * 
 * Phase 3: Skill progression and character customization
 */

import React, { useMemo, useState } from 'react';
import type { PlayerState } from '../../engine/worldEngine';
import { usePlayerTheme } from '../hooks/usePlayerTheme';

export interface SkillNode {
  id: string;
  name: string;
  icon: string;
  description: string;
  skillPointCost: number;
  prerequisites?: string[];
  statBonus?: {
    str?: number;
    agi?: number;
    int?: number;
    cha?: number;
    end?: number;
    luk?: number;
    perception?: number;
  };
  category: 'combat' | 'magic' | 'survival';
  position: { x: number; y: number };
}

export interface SkillTreeProps {
  player: PlayerState;
  onLearnSkill?: (skillId: string) => void;
  unlockedSkills?: string[];
  availableSkillPoints?: number;
}

// Skill constellation database
const SKILL_CONSTELLATION: Record<string, SkillNode> = {
  // COMBAT TREE
  'power-strike': {
    id: 'power-strike',
    name: 'Power Strike',
    icon: '⚔️',
    description: 'Increase melee damage',
    skillPointCost: 1,
    category: 'combat',
    position: { x: 100, y: 100 },
    statBonus: { str: 2 },
  },
  'riposte': {
    id: 'riposte',
    name: 'Riposte',
    icon: '🗡️',
    description: 'Counter after blocking',
    skillPointCost: 2,
    prerequisites: ['power-strike'],
    category: 'combat',
    position: { x: 200, y: 120 },
    statBonus: { agi: 1, str: 1 },
  },
  'whirlwind': {
    id: 'whirlwind',
    name: 'Whirlwind',
    icon: '💨',
    description: 'Strike all nearby enemies',
    skillPointCost: 3,
    prerequisites: ['power-strike', 'riposte'],
    category: 'combat',
    position: { x: 150, y: 200 },
    statBonus: { str: 3, agi: 1 },
  },

  // MAGIC TREE
  'arcane-bolt': {
    id: 'arcane-bolt',
    name: 'Arcane Bolt',
    icon: '✨',
    description: 'Launch magical projectiles',
    skillPointCost: 1,
    category: 'magic',
    position: { x: 400, y: 100 },
    statBonus: { int: 2 },
  },
  'spell-weaver': {
    id: 'spell-weaver',
    name: 'Spell Weaver',
    icon: '🔮',
    description: 'Reduce spell cooldowns',
    skillPointCost: 2,
    prerequisites: ['arcane-bolt'],
    category: 'magic',
    position: { x: 500, y: 120 },
    statBonus: { int: 2, cha: 1 },
  },
  'mana-shield': {
    id: 'mana-shield',
    name: 'Mana Shield',
    icon: '🛡️',
    description: 'Convert mana into armor',
    skillPointCost: 2,
    prerequisites: ['arcane-bolt'],
    category: 'magic',
    position: { x: 450, y: 180 },
    statBonus: { int: 1, end: 1 },
  },
  'catastrophe': {
    id: 'catastrophe',
    name: 'Catastrophe',
    icon: '💥',
    description: 'Unleash massive explosion',
    skillPointCost: 5,
    prerequisites: ['spell-weaver', 'mana-shield'],
    category: 'magic',
    position: { x: 475, y: 260 },
    statBonus: { int: 3, cha: 2 },
  },

  // SURVIVAL TREE
  'traceless-step': {
    id: 'traceless-step',
    name: 'Traceless Step',
    icon: '👣',
    description: 'Move without sound',
    skillPointCost: 1,
    category: 'survival',
    position: { x: 300, y: 100 },
    statBonus: { agi: 2 },
  },
  'pathfinder': {
    id: 'pathfinder',
    name: 'Pathfinder',
    icon: '🧭',
    description: 'Faster travel in wilderness',
    skillPointCost: 2,
    prerequisites: ['traceless-step'],
    category: 'survival',
    position: { x: 350, y: 180 },
    statBonus: { agi: 1, perception: 2 },
  },
  'survivalist': {
    id: 'survivalist',
    name: 'Survivalist',
    icon: '🔥',
    description: 'Heal faster from wounds',
    skillPointCost: 2,
    prerequisites: ['traceless-step'],
    category: 'survival',
    position: { x: 280, y: 180 },
    statBonus: { end: 2, perception: 1 },
  },
};

type SkillCategory = 'combat' | 'magic' | 'survival';

const CATEGORY_NAMES: Record<SkillCategory, string> = {
  combat: '⚔️ Combat',
  magic: '✨ Magic',
  survival: '👣 Survival',
};

export const SkillTree: React.FC<SkillTreeProps> = ({
  player,
  onLearnSkill,
  unlockedSkills = [],
  availableSkillPoints = 0,
}) => {
  const theme = usePlayerTheme(player?.theme);
  const [activeCategory, setActiveCategory] = useState<SkillCategory>('combat');
  const [hoveredSkill, setHoveredSkill] = useState<string | null>(null);

  // Get skills for current category
  const categorySkills = useMemo(() => {
    return Object.values(SKILL_CONSTELLATION).filter(
      (skill) => skill.category === activeCategory
    );
  }, [activeCategory]);

  // Check if skill is unlocked
  const isSkillUnlocked = (skillId: string): boolean => {
    return unlockedSkills.includes(skillId);
  };

  // Check if prerequisites are met
  const prerequisitesMet = (skill: SkillNode): boolean => {
    if (!skill.prerequisites) return true;
    return skill.prerequisites.every((prereqId) => isSkillUnlocked(prereqId));
  };

  // Check if skill can be learned
  const canLearnSkill = (skill: SkillNode): boolean => {
    return !isSkillUnlocked(skill.id) && prerequisitesMet(skill) && availableSkillPoints >= skill.skillPointCost;
  };

  // =========================================================================
  // STYLES
  // =========================================================================

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.background,
    padding: '16px',
    fontFamily: theme.fonts.primary,
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: `2px solid ${theme.colors.primary}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: theme.colors.textAccent,
  };

  const skillPointsStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 700,
    color: theme.colors.accent,
    backgroundColor: theme.colors.primary + '44',
    padding: '4px 12px',
    borderRadius: '4px',
    border: `1px solid ${theme.colors.accent}`,
  };

  const tabsStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: '8px',
  };

  const tabStyle = (isActive: boolean): React.CSSProperties => {
    return {
      padding: '8px 16px',
      fontSize: '12px',
      fontWeight: 700,
      textTransform: 'uppercase',
      cursor: 'pointer',
      backgroundColor: isActive ? theme.colors.primary : 'transparent',
      color: isActive ? theme.colors.background : theme.colors.text,
      border: isActive ? `1px solid ${theme.colors.accent}` : `1px solid ${theme.colors.border}`,
      borderRadius: '4px',
      transition: 'all 0.2s',
    };
  };

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '12px',
    overflowY: 'auto',
    flex: 1,
    paddingRight: '8px',
  };

  const skillNodeStyle = (skill: SkillNode, isHovered: boolean): React.CSSProperties => {
    const unlocked = isSkillUnlocked(skill.id);
    const canLearn = canLearnSkill(skill);
    const hasPrereqs = prerequisitesMet(skill);

    let bgColor = theme.colors.secondary;
    let borderColor = theme.colors.border;

    if (unlocked) {
      bgColor = theme.colors.accent + '33';
      borderColor = theme.colors.accent;
    } else if (canLearn) {
      borderColor = theme.colors.success;
    } else if (!hasPrereqs) {
      bgColor = theme.colors.disabled + '22';
      borderColor = theme.colors.disabled;
    }

    return {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '12px',
      backgroundColor: bgColor,
      border: `2px solid ${borderColor}`,
      borderRadius: '8px',
      cursor: canLearn ? 'pointer' : 'default',
      transition: 'all 0.2s',
      transform: isHovered && canLearn ? 'scale(1.05)' : 'scale(1)',
      opacity: !hasPrereqs && !unlocked ? 0.5 : 1,
      position: 'relative',
    };
  };

  const iconStyle: React.CSSProperties = {
    fontSize: '32px',
    marginBottom: '6px',
  };

  const skillNameStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 700,
    color: theme.colors.textAccent,
    marginBottom: '4px',
    textAlign: 'center',
    minHeight: '30px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  const costStyle = (skill: SkillNode): React.CSSProperties => {
    const canLearn = canLearnSkill(skill);
    const unlocked = isSkillUnlocked(skill.id);

    return {
      fontSize: '10px',
      fontWeight: 700,
      color: unlocked ? theme.colors.success : canLearn ? theme.colors.warning : theme.colors.textSecondary,
      textAlign: 'center',
    };
  };

  const unlockedBadgeStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    fontSize: '12px',
    backgroundColor: theme.colors.success,
    color: theme.colors.background,
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
  };

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginBottom: '8px',
    padding: '8px 12px',
    backgroundColor: theme.colors.secondary,
    border: `1px solid ${theme.colors.accent}`,
    borderRadius: '4px',
    fontSize: '10px',
    color: theme.colors.text,
    minWidth: '160px',
    textAlign: 'center',
    whiteSpace: 'wrap',
    wordWrap: 'break-word',
    pointerEvents: 'none',
    zIndex: 1000,
    fontFamily: theme.fonts.primary,
    boxShadow: theme.shadows.heavy,
    maxWidth: '220px',
  };

  const tooltipTitleStyle: React.CSSProperties = {
    fontWeight: 700,
    color: theme.colors.textAccent,
    marginBottom: '4px',
  };

  const tooltipStatStyle: React.CSSProperties = {
    fontSize: '9px',
    color: theme.colors.success,
    marginTop: '4px',
  };

  return (
    <div style={containerStyle}>
      {/* HEADER */}
      <div style={headerStyle}>
        <div style={titleStyle}>Constellation</div>
        <div style={skillPointsStyle}>Points: {availableSkillPoints}</div>
      </div>

      {/* CATEGORY TABS */}
      <div style={tabsStyle}>
        {(Object.keys(CATEGORY_NAMES) as SkillCategory[]).map((category) => (
          <div
            key={category}
            style={tabStyle(activeCategory === category)}
            onClick={() => setActiveCategory(category)}
          >
            {CATEGORY_NAMES[category]}
          </div>
        ))}
      </div>

      {/* SKILLS GRID */}
      <div style={gridStyle}>
        {categorySkills.map((skill) => {
          const unlocked = isSkillUnlocked(skill.id);
          const canLearn = canLearnSkill(skill);
          const hasPrereqs = prerequisitesMet(skill);
          const isHovered = hoveredSkill === skill.id;

          return (
            <div
              key={skill.id}
              style={skillNodeStyle(skill, isHovered)}
              onClick={() => {
                if (canLearn) {
                  onLearnSkill?.(skill.id);
                }
              }}
              onMouseEnter={() => setHoveredSkill(skill.id)}
              onMouseLeave={() => setHoveredSkill(null)}
              title={skill.name}
            >
              {/* Icon */}
              <div style={iconStyle}>{skill.icon}</div>

              {/* Name */}
              <div style={skillNameStyle}>{skill.name}</div>

              {/* Cost/Status */}
              <div style={costStyle(skill)}>
                {unlocked ? (
                  <span>✓ Unlocked</span>
                ) : hasPrereqs ? (
                  <span>{skill.skillPointCost} pts</span>
                ) : (
                  <span>🔒 Locked</span>
                )}
              </div>

              {/* Unlocked Badge */}
              {unlocked && <div style={unlockedBadgeStyle}>✓</div>}

              {/* TOOLTIP */}
              {isHovered && (
                <div style={tooltipStyle}>
                  <div style={tooltipTitleStyle}>{skill.name}</div>
                  <div style={{ fontSize: '9px', marginBottom: '4px' }}>{skill.description}</div>
                  {skill.statBonus && Object.keys(skill.statBonus).length > 0 && (
                    <div style={tooltipStatStyle}>
                      {Object.entries(skill.statBonus)
                        .map(([stat, bonus]) => `+${bonus} ${stat.toUpperCase()}`)
                        .join(', ')}
                    </div>
                  )}
                  {!hasPrereqs && skill.prerequisites && skill.prerequisites.length > 0 && (
                    <div style={{ fontSize: '9px', color: theme.colors.error, marginTop: '4px' }}>
                      Requires: {skill.prerequisites.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SkillTree;
