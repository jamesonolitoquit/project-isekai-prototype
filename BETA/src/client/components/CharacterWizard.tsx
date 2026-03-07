import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { CoreAttributes } from '../../types/attributes';
import { usePersistentCreation } from '../hooks/usePersistentCreation';
import { generateDefaultStats, getAvailableRaces, getAvailableArchetypes, getAvailableTalents } from '../../engine/characterCreation';
import styles from './CharacterWizard.module.css';
import HoverTooltip, { type TooltipData } from './HoverTooltip';
import { Dice3D } from './Dice3D';
import { DynamicGrid } from './DynamicGrid';
import { StatAdjuster } from './StatAdjuster';

// interface CharacterWizardProps {

//   worldTemplate: any;

//   onCharacterCreated?: (draft: any) => void;

//   onCancel?: () => void;

//   setCodexHoverTarget?: (target: any) => void;

// }

// Minimal placeholder for theme flavor texts (safe fallback)
const flavorByTheme: Record<string, Record<string, string>> = {};

const getThemeFlavor = (currentTheme: string, stat: string) => {
  const themeTexts = flavorByTheme[currentTheme];
  return themeTexts?.[stat] || 'A fundamental aspect of your being.';
};

type WizardStep = 0 | 1 | 2 | 3 | 4 | 5;

export default function CharacterWizard(props: any) {

  const { draft, updateDraft, updateStats, addTalent, removeTalent, advanceStep, regressStep, isDraftValidForStep, getMissingRequiredFields } = usePersistentCreation();

  const currentStep = (draft.currentStep || 0) as WizardStep;

  const races = useMemo(() => getAvailableRaces(), []);

  const talents = useMemo(() => getAvailableTalents(), []);

  const [codexHoverTarget, setCodexHoverTarget] = useState(null);

  // Tooltip state (replaces right sidebar for Step 5+)
  const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null);
  const [rerollCount, setRerollCount] = useState(0);
  const [diceIsRolling, setDiceIsRolling] = useState(false);

  const showTooltip = useCallback((e: React.MouseEvent, data: TooltipData) => {
    setTooltipAnchor((e.currentTarget as HTMLElement).getBoundingClientRect());
    setTooltipData(data);
  }, []);

  const hideTooltip = useCallback(() => {
    setTooltipData(null);
    setTooltipAnchor(null);
  }, []);

  // Reset sub-flow phase when entering Step 5 to ensure clean origin → gear → fate sequence
  useEffect(() => {
    if (currentStep === 5) {
      updateDraft({ preparationPhase: 'location' });
      setRerollCount(0);
      setDiceIsRolling(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  // Prevent browser back button during character creation steps
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      e.preventDefault();
      window.history.forward();
    };
    if (currentStep > 0 && currentStep < 6) {
      window.history.pushState(null, '', window.location.href);
      window.addEventListener('popstate', handlePopState);
    }
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentStep]);

  // Step handlers
  const handleNextStep = () => {
    if (isDraftValidForStep(currentStep)) {
      advanceStep();
    }
  };

  const handlePrevStep = () => {
    regressStep();
  };

  const handleNameChange = (name: string) => {
    updateDraft({ characterName: name });
  };

  const handleGenderChange = (gender: string) => {
    updateDraft({ gender });
  };

  const handleBackstoryChange = (backstorySnippet: string) => {
    updateDraft({ backstorySnippet });
  };

  /**
   * Get starting stats for a race from the world template
   * Matches race IDs case-insensitively against ancestry tree definitions
   * Falls back to default 8s if race not found in template
   */
  const getStartingStatsForRace = (raceId: string): CoreAttributes => {
    if (!props.worldTemplate?.ancestryTrees) {
      return { STR: 8, DEX: 8, AGI: 8, CON: 8, INT: 8, WIS: 8, CHA: 8, PER: 8 };
    }

    // Match by race name (case-insensitive) or by full id
    const ancestry = props.worldTemplate.ancestryTrees.find(
      (tree: any) => 
        tree.race?.toLowerCase() === raceId.toLowerCase() ||
        tree.id === raceId
    );

    if (ancestry?.baseStats) {
      return ancestry.baseStats as unknown as CoreAttributes;
    }

    // Fallback to default balanced 8s
    return { STR: 8, DEX: 8, AGI: 8, CON: 8, INT: 8, WIS: 8, CHA: 8, PER: 8 };
  };

  const handleRaceChange = (raceId: string) => {
    // Seed the stats from the race's template definition
    const racialBaseStats = getStartingStatsForRace(raceId);
    updateDraft({ 
      selectedRace: raceId,
      baseStats: racialBaseStats,
      racialBaseStats: racialBaseStats  // Store racial baseline separately
    });
  };

  const handleArchetypeChange = (archetypeId: string) => {
    updateDraft({ archetype: archetypeId });
  };

  const handleLocationChange = (locationId: string) => {
    updateDraft({ startingLocationId: locationId });
  };

  const handleStatChange = (stat: keyof CoreAttributes, value: number) => {
    // Get the racial baseline (what they started with based on race selection)
    const racialBase = draft.racialBaseStats?.[stat] ?? 8;
    
    // Clamp value between racial base and 20 (base + 12 pool max)
    const newValue = Math.max(racialBase, Math.min(20, value));
    if (newValue === draft.baseStats[stat]) return; // No change

    const oldValue = draft.baseStats[stat];
    const difference = newValue - oldValue;

    // Calculate new total after the change
    const currentTotal = Object.values(draft.baseStats).reduce((a, b) => a + b, 0);
    const newTotal = currentTotal + difference;
    // Calculate essence used relative to 64 base (8×8)
    const newEssenceUsed = newTotal - 64;

    // Can only use up to 12 essence points (total cannot exceed 76)
    if (newEssenceUsed > 12) {
      return;
    }

    // Update stats
    const newStats = { ...draft.baseStats, [stat]: newValue };
    updateStats(newStats);
  };

  const handleTalentToggle = (talentId: string) => {
    if (draft.selectedTalents.includes(talentId)) {
      removeTalent(talentId);
    } else if (draft.selectedTalents.length < 2) {
      // Enforce 2-talent limit
      addTalent(talentId);
    }
    // Silently ignore attempts to select a 3rd talent
  };

  const handleFinalize = () => {
    const missing = getMissingRequiredFields();
    if (missing.length > 0) {
      alert(`Missing required fields: ${missing.join(', ')}`);
      return;
    }
    // Derive archetype from selected talents, or default to 'Wanderer'
    const firstTalent = talents.find(t => t.id === draft.selectedTalents[0]);
    const isMagical = firstTalent ? /magic|arcane|spirit|heal/i.test(firstTalent.effect) : false;
    const archetypeFromTalents = draft.selectedTalents.length > 0
      ? (isMagical ? 'Arcanist' : 'Fighter')
      : 'Wanderer';
    
    // Add equipment: map startingGearId to correct slot
    const equipment: Record<string, string> = {};
    if (draft.startingGearId && props.worldTemplate?.startingGearChoices) {
      const selectedGear = props.worldTemplate.startingGearChoices.find(
        (g: any) => g.id === draft.startingGearId
      );
      if (selectedGear && selectedGear.equipmentSlot) {
        equipment[selectedGear.equipmentSlot] = draft.startingGearId;
      }
    }

    const finalCharacter = {
      ...draft,
      archetype: draft.archetype || archetypeFromTalents,
      equipment  // Include properly mapped equipment
    };
    
    if (props.onCharacterCreated) {
      props.onCharacterCreated(finalCharacter);
    }
  };

  // Render steps
  const renderStep0_WorldContext = () => {
    const metadata = props.worldTemplate?.metadata || {
      name: 'The First Realm',
      description: 'The tactical void where your journey begins.',
      loreHighlights: ['A world of deep magic and high friction.', 'Time flows deterministically.', 'Your choices shape destiny.'],
      worldEpoch: 'Alpha-0'
    };

    const loreHighlights = metadata.loreHighlights || [];

    return (
      <div className={styles.world_context_splash}>
        <h1 className={styles.world_title}>{metadata.name}</h1>
        <p className={styles.world_description}>{metadata.description}</p>
        <div className={styles.lore_highlights}>
          <h3>The Awakening Path Awaits</h3>
          <ul>
            {loreHighlights.map((highlight, i) => (
              <li key={i}>{highlight}</li>
            ))}
          </ul>
        </div>
        <div className={styles.step_actions}>
          <button onClick={handleNextStep} className={styles.btn_primary}>
            Begin Awakening →
          </button>
          {props.onCancel && (
            <button onClick={props.onCancel} className={styles.btn_secondary}>
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderStep1_Identity = () => (
    <div>
      <div className={styles.altar_header}>
        <h2 className={styles.altar_title}>🆔 Define Your Identity</h2>
        <p className={styles.altar_subtitle}>Your character begins to take shape</p>
      </div>

      <div className={styles.form_group}>
        <label>Character Name</label>
        <input
          type="text"
          value={draft.characterName || ''}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="Enter your character's name"
          className={styles.input_field}
        />
      </div>

      <div className={styles.form_group}>
        <label>Gender Presentation</label>
        <div className={styles.gender_options}>
          {['Female', 'Male', 'Non-Binary', 'Other'].map(option => (
            <label key={option} className={styles.radio_label}>
              <input
                type="radio"
                name="gender"
                value={option}
                checked={draft.gender === option}
                onChange={(e) => handleGenderChange(e.target.value)}
              />
              {option}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.form_group}>
        <label>Backstory (Optional)</label>
        <textarea
          value={draft.backstorySnippet || ''}
          onChange={(e) => handleBackstoryChange(e.target.value)}
          placeholder="A brief history of your character"
          className={styles.textarea_field}
        />
      </div>

      <div className={styles.step_actions}>
        <button onClick={handlePrevStep} className={styles.btn_secondary}>
          ← Back
        </button>
        <button
          onClick={handleNextStep}
          className={styles.btn_primary}
          disabled={!draft.characterName}
          title={!draft.characterName ? 'Name is required' : 'Proceed to ancestry'}
        >
          Next →
        </button>
      </div>
    </div>
  );

  const renderStep2_Ancestry = () => (
    <div>
      <div className={styles.altar_header}>
        <h2 className={styles.altar_title}>🧬 Choose Your Ancestry</h2>
        <p className={styles.altar_subtitle}>Bloodline shapes your beginning</p>
      </div>

      <DynamicGrid
        items={races}
        columns={3}
        itemsPerPage={12}
        renderItem={(race) => (
          <label
            className={`${styles.race_card} ${draft.selectedRace === race.id ? styles.selected : ''}`}
            onMouseEnter={(e) => showTooltip(e, raceTooltipData(race))}
            onMouseLeave={hideTooltip}
          >
            <input
              type="radio"
              name="race"
              value={race.id}
              checked={draft.selectedRace === race.id}
              onChange={(e) => handleRaceChange(e.target.value)}
            />
            <div className={styles.race_label}>
              <div className={styles.race_name}>{race.name}</div>
              <div className={styles.race_traits}>{race.description}</div>
            </div>
          </label>
        )}
      />

      <div className={styles.step_actions}>
        <button onClick={handlePrevStep} className={styles.btn_secondary}>
          ← Back
        </button>
        <button
          onClick={handleNextStep}
          className={styles.btn_primary}
          disabled={!draft.selectedRace}
          title={!draft.selectedRace ? 'Select an ancestry' : 'Proceed to essence'}
        >
          Next →
        </button>
      </div>
    </div>
  );

  const renderStep3_Stats = () => {
    const coreTotal = draft.baseStats.STR + draft.baseStats.DEX + draft.baseStats.AGI + draft.baseStats.CON + 
                      draft.baseStats.INT + draft.baseStats.WIS + draft.baseStats.CHA + draft.baseStats.PER;
    const remaining = 12 - (coreTotal - 64);
    const isPointsValid = remaining === 0;

    const physicalStats: (keyof CoreAttributes)[] = ['STR', 'DEX', 'AGI', 'CON'];
    const mentalStats: (keyof CoreAttributes)[] = ['INT', 'WIS', 'CHA', 'PER'];
    const statIcons: Record<keyof CoreAttributes, string> = {
      STR: '⚔️', DEX: '🎯', AGI: '🏃', CON: '❤️',
      INT: '🧠', WIS: '👁️', CHA: '💬', PER: '🔭'
    };

    const renderStatGroup = (stats: (keyof CoreAttributes)[], title: string) => (
      <div className={styles.stats_column} style={{ maxWidth: '400px' }}>
        <h3>{title}</h3>
        {stats.map(stat => {
          const racialBase = draft.racialBaseStats?.[stat] ?? 8;
          const canIncrement = remaining > 0 && draft.baseStats[stat] < 20;
          return (
            <div
              key={stat}
              onMouseEnter={(e) => showTooltip(e, statTooltipData(stat))}
              onMouseLeave={hideTooltip}
            >
              <StatAdjuster
                icon={statIcons[stat]}
                label={stat}
                value={draft.baseStats[stat]}
                min={racialBase}
                max={20}
                disabled={!canIncrement && draft.baseStats[stat] >= 20}
                onChange={(v) => handleStatChange(stat, v)}
              />
            </div>
          );
        })}
      </div>
    );

    return (
      <div>
        <div className={styles.altar_header}>
          <h2 className={styles.altar_title}>⚔️ Allocate Your Essence</h2>
          <p className={styles.altar_subtitle}>Pool: 12 points | Remaining: {remaining}</p>
        </div>

        <div className={styles.stats_grid}>
          {renderStatGroup(physicalStats, 'Physical')}
          {renderStatGroup(mentalStats, 'Mental & Social')}
        </div>

        <div className={styles.step_actions}>
          <button onClick={handlePrevStep} className={styles.btn_secondary}>
            ← Back
          </button>
          <button
            onClick={handleNextStep}
            className={styles.btn_primary}
            disabled={!isPointsValid}
            title={isPointsValid ? 'Proceed to talents' : 'You must spend exactly 20 essence points'}
          >
            Next →
          </button>
        </div>
      </div>
    );
  };

  const renderStep4_Talents = () => (
    <div>
      <div className={styles.altar_header}>
        <h2 className={styles.altar_title}>🎭 Select Your Innate Talents</h2>
        <p className={styles.altar_subtitle}>Selected: {draft.selectedTalents.length} / 2 talents</p>
      </div>

      <DynamicGrid
        items={talents}
        columns={2}
        itemsPerPage={12}
        renderItem={(talent) => {
          const isSelected = draft.selectedTalents.includes(talent.id);
          const isMaxed = draft.selectedTalents.length >= 2 && !isSelected;
          const talentType = (talent as any).type || 'passive';
          const isActive = talentType === 'active';
          return (
            <div
              className={`talent-card${isSelected ? ' selected' : ''}${isMaxed ? ' locked' : ''}`}
              onMouseEnter={(e) => showTooltip(e, talentTooltipData(talent))}
              onMouseLeave={hideTooltip}
              onClick={() => !isMaxed && handleTalentToggle(talent.id)}
              role="checkbox"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && !isMaxed && handleTalentToggle(talent.id)}
            >
              <div className="talent-card-header">
                <div className="talent-card-title">{talent.name}</div>
                <span className="talent-card-tag">
                  {isActive ? '🔵 Active' : '🟡 Passive'}
                </span>
              </div>
              <div className="talent-card-desc">{talent.description}</div>
              {(talent as any).mechanics && (
                <div className="talent-card-footer">
                  <span>{(talent as any).mechanics}</span>
                </div>
              )}
            </div>
          );
        }}
      />

      <div className={styles.step_actions}>
        <button onClick={handlePrevStep} className={styles.btn_secondary}>
          ← Back
        </button>
        <button onClick={handleNextStep} className={styles.btn_primary}>
          Next →
        </button>
      </div>
    </div>
  );

  const calculateVitality = () => {
    const con = draft.baseStats.CON;
    const wis = draft.baseStats.WIS;
    const int = draft.baseStats.INT;
    const cha = draft.baseStats.CHA;
    
    const hp = 20 + (con * 5) + (wis * 2);
    const mp = 50 + (int * 8) + (cha * 3);
    
    return { hp, mp };
  };

  // Tooltip data builders for the floating tooltip system
  const statTooltipData = (stat: keyof CoreAttributes): TooltipData => {
    const icons: Record<keyof CoreAttributes, string> = {
      STR: '⚔️', DEX: '🎯', AGI: '🏃', CON: '❤️', INT: '🧠', WIS: '👁️', CHA: '💬', PER: '🔭'
    };
    const descriptions: Record<keyof CoreAttributes, string> = {
      STR: 'Raw physical power and endurance.',
      DEX: 'Precision and nimble coordination.',
      AGI: 'Speed and reflexive grace.',
      CON: 'Fortitude and bodily resilience.',
      INT: 'Mental acuity and magical aptitude.',
      WIS: 'Intuition and spiritual awareness.',
      CHA: 'Personal magnetism and social influence.',
      PER: 'Sensory sharpness and environmental awareness.'
    };
    const mechanics: Record<keyof CoreAttributes, string> = {
      STR: '+3% Melee DMG per point | +10 Carry Weight per point',
      DEX: '+4% Ranged Accuracy per point | +5 Throw Distance per point',
      AGI: '+2% Action Speed per point | +8% Evasion Defense per point',
      CON: '+5 Max HP per point | +3% Poison Resistance per point',
      INT: '+8 Mana Pool per point | +2% Spell Power per point',
      WIS: '+3% Mana Regen per point | +5% Judgment Call per point',
      CHA: '+5% NPC Persuasion per point | +3% Faction Gains per point',
      PER: '-10 Fog-of-War per point | +8% Loot Detection per point'
    };
    return {
      icon: icons[stat],
      title: stat,
      description: descriptions[stat],
      meta: mechanics[stat],
      secondary: `Current: ${draft.baseStats[stat]} / 20`
    };
  };

  const slotTooltipData = (slotId: string): TooltipData => {
    const slots: Record<string, { title: string; desc: string }> = {
      head: { title: 'Head Slot', desc: 'Helmets, circlets, or hoods to protect your mind and skull.' },
      chest: { title: 'Chest Slot', desc: 'Primary armor—breastplates or robes that define your defense.' },
      hands: { title: 'Hands Slot', desc: 'Gauntlets and gloves for grip and control.' },
      mainhand: { title: 'Main Hand', desc: 'Your primary weapon—chosen during Phase 2.' },
      offhand: { title: 'Off Hand', desc: 'Shield, secondary weapon, or arcane focus.' },
      feet: { title: 'Feet Slot', desc: 'Boots that determine your speed and stance.' }
    };
    const slot = slots[slotId] || { title: slotId, desc: '' };
    return {
      title: slot.title,
      description: slot.desc,
      meta: '✨ Filled during Gear selection'
    };
  };

  const locationTooltipData = (location: any): TooltipData => ({
    icon: '📍',
    title: location.name,
    description: location.description || '',
    meta: location.geography ? `Geography: ${location.geography}` : undefined,
    secondary: location.factionPresence ? `Faction: ${location.factionPresence}` : undefined
  });

  const gearTooltipData = (gear: any): TooltipData => ({
    icon: gear.icon,
    title: gear.name,
    description: gear.flavorText || gear.description || '',
    meta: gear.mechanics,
    secondary: gear.statBonuses ? `Bonuses: ${gear.statBonuses}` : undefined
  });

  const raceTooltipData = (race: any): TooltipData => {
    const ancestryTree = props.worldTemplate?.ancestryTrees?.find(
      (tree: any) => tree.race?.toLowerCase() === race.id?.toLowerCase() || tree.id === race.id
    );
    const passive = ancestryTree?.innatePassive;
    return {
      icon: '🧬',
      title: race.name,
      description: race.description || '',
      meta: passive ? `${passive.icon} ${passive.name}: ${passive.effect}` : undefined,
      secondary: ancestryTree ? 'Innate racial traits apply from combat start' : undefined
    };
  };

  const talentTooltipData = (talent: any): TooltipData => ({
    icon: (talent.type || 'passive') === 'active' ? '🔵' : '🟡',
    title: talent.name,
    description: talent.description || '',
    meta: talent.mechanics,
    secondary: talent.effect
  });

  const getRollFateRandom = (): string => {
    const curiosities = props.worldTemplate.curiosityPool || [];
    if (curiosities.length === 0) return 'unknown-item';
    const index = Math.floor(Math.random() * curiosities.length);
    return curiosities[index].id;
  };

  const renderStep5_OriginFinalize = () => {
    const { hp, mp } = calculateVitality();
    const phase = draft.preparationPhase || 'location';
    const selectedLocation = props.worldTemplate.startingLocations?.find(l => l.id === draft.startingLocationId);
    const selectedGear = props.worldTemplate.startingGearChoices?.find(g => g.id === draft.startingGearId);
    const selectedCurio = props.worldTemplate.curiosityPool?.find(c => c.id === draft.flavorItemId);

    const raceIcons: Record<string, string> = {
      human: '👤', elf: '🏹', dwarf: '⛏️', orc: '⚡', dragonborn: '🐉', halfling: '🍀'
    };
    const raceIcon = raceIcons[draft.selectedRace?.toLowerCase()] || '👤';
    const ancestry = races.find(r => r.id === draft.selectedRace)?.name || 'Unknown';

    const biomeIcons: Record<string, string> = {
      mountain: '🏔️', forest: '🌲', cave: '🕳️', village: '🏘️', plains: '🌾',
      desert: '🏜️', coastal: '🌊', tundra: '❄️', swamp: '🌿', ruins: '🏛️'
    };

    return (
      <div className="layout-triptych">
        {/* LEFT SIDEBAR: Hero Card */}
        <div className="layout-triptych-sidebar">
          <div className="hero-card">
            {/* Avatar */}
            <div className="hero-card-avatar-frame">
              <div className="hero-card-avatar">{raceIcon}</div>
            </div>
            <div className="hero-card-name-tag">
              <div className="hero-card-name">{draft.characterName}</div>
              <div className="hero-card-ancestry">{ancestry} • {draft.gender}</div>
            </div>

            {/* Vitality */}
            <div className="hero-card-vitality">
              <div className="vitality-bar-wrapper">
                <span className="vitality-bar-icon">❤️</span>
                <div className="vitality-bar"><div className="vitality-bar-fill hp" /></div>
                <span className="vitality-bar-value">{hp}/{hp}</span>
              </div>
              <div className="vitality-bar-wrapper">
                <span className="vitality-bar-icon">🔵</span>
                <div className="vitality-bar"><div className="vitality-bar-fill mp" /></div>
                <span className="vitality-bar-value">{mp}/{mp}</span>
              </div>
            </div>

            {/* Equipment Slots */}
            <div className="hero-card-equipment">
              <div className="equipment-title">Equipment</div>
              <div className="equipment-grid">
                {[
                  { id: 'head', icon: '👑' },
                  { id: 'chest', icon: selectedGear?.equipmentSlot === 'chest' ? (selectedGear.icon || '🎖️') : '🎖️' },
                  { id: 'hands', icon: '🧤' },
                  { id: 'mainhand', icon: selectedGear?.equipmentSlot === 'mainHand' ? (selectedGear.icon || '⚔️') : '⚔️' },
                  { id: 'offhand', icon: '🛡️' },
                  { id: 'feet', icon: '👢' }
                ].map((slot, idx) => {
                  const normalizedSlotId = slot.id.replace('mainhand', 'mainHand').replace('offhand', 'offHand');
                  const isFilledSlot = selectedGear && selectedGear.equipmentSlot === normalizedSlotId;
                  return (
                    <div
                      key={slot.id}
                      className={`equipment-slot ${isFilledSlot ? 'filled' : ''}`}
                      title={slot.id}
                      onMouseEnter={(e) => showTooltip(e, slotTooltipData(slot.id))}
                      onMouseLeave={hideTooltip}
                    >
                      <span className={isFilledSlot ? '' : 'equipment-slot-ghost'}>
                        {slot.icon}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Core Attributes */}
            <div className="sidebar-section">
            <div className="hero-card-attributes">
              <div className="attributes-title">Attributes</div>
              <div className="attributes-grid">
                {(['STR', 'DEX', 'AGI', 'CON', 'INT', 'WIS', 'CHA', 'PER'] as const).map(stat => {
                  const icons: Record<string, string> = { STR: '⚔️', DEX: '🎯', AGI: '🏃', CON: '❤️', INT: '🧠', WIS: '👁️', CHA: '💬', PER: '🔭' };
                  return (
                    <div
                      key={stat}
                      className="attribute-box"
                      onMouseEnter={(e) => showTooltip(e, statTooltipData(stat))}
                      onMouseLeave={hideTooltip}
                    >
                      <div className="attribute-icon">{icons[stat]}</div>
                      <div className="attribute-value">{draft.baseStats[stat]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            </div>

            {/* Progress */}
            <div className="sidebar-section">
            <div className="hero-card-progress">
              <div className="progress-title">Progress</div>
              <div className={`progress-item ${selectedLocation ? 'completed' : 'pending'}`}>
                <span>{selectedLocation ? '✓' : '📍'}</span> Origin
              </div>
              <div className={`progress-item ${selectedGear ? 'completed' : 'pending'}`}>
                <span>{selectedGear ? '✓' : '⚔️'}</span> Gear
              </div>
              <div className={`progress-item ${selectedCurio ? 'completed' : 'pending'}`}>
                <span>{selectedCurio ? '✓' : '🎲'}</span> Fate
              </div>
            </div>
            </div>

            {/* Selected Talents */}
            {draft.selectedTalents.length > 0 && (
              <div className="sidebar-section">
              <div className="hero-card-talents">
                <div className="talents-title">Talents</div>
                <div className="talents-list">
                  {draft.selectedTalents.map(tid => {
                    const t = talents.find(x => x.id === tid);
                    return t ? (
                      <span key={tid} className="talent-badge">{t.name}</span>
                    ) : null;
                  })}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>

        {/* CENTER STAGE: Full-width interaction area */}
        <div className="layout-triptych-stage">
          {/* Phase 1: Location */}
          {phase === 'location' && (
            <>
              <div className="layout-triptych-stage-header">
                <div>
                  <h2 style={{ color: 'var(--wizard-accent)', fontSize: '1.5rem', margin: 0 }}>📍 Phase 1: Your Origin</h2>
                  <p style={{ color: 'var(--wizard-text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>Where do you awaken?</p>
                </div>
                <button onClick={() => regressStep()} className={styles.btn_secondary} style={{ whiteSpace: 'nowrap' }}>
                  ← Back to Talents
                </button>
              </div>
              <div className="layout-triptych-stage-content">
                {(props.worldTemplate?.startingLocations || []).length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--wizard-text-secondary)' }}>
                    <p>Searching for ley-lines...</p>
                  </div>
                ) : (
                  (props.worldTemplate.startingLocations || []).map(location => (
                    <button
                      key={location.id}
                      className={`location-card ${draft.startingLocationId === location.id ? 'selected' : ''}`}
                      onClick={() => {
                        hideTooltip();
                        updateDraft({
                          startingLocationId: location.id,
                          preparationPhase: 'gear'
                        });
                      }}
                      onMouseEnter={(e) => showTooltip(e, locationTooltipData(location))}
                      onMouseLeave={hideTooltip}
                    >
                      <div className="location-card-icon">{biomeIcons[location.biome] || '📍'}</div>
                      <div className="location-card-name">{location.name}</div>
                      {location.biome && <div className="location-card-biome">{location.biome}</div>}
                      <div className="location-card-desc">{location.description}</div>
                    </button>
                  ))
                )}
              </div>
              <div className="layout-triptych-stage-footer" />
            </>
          )}

          {/* Phase 2: Gear */}
          {phase === 'gear' && (
            <>
              <div className="layout-triptych-stage-header">
                <div>
                  <h2 style={{ color: 'var(--wizard-accent)', fontSize: '1.5rem', margin: 0 }}>⚔️ Phase 2: Your Arms</h2>
                  <p style={{ color: 'var(--wizard-text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>Select your starting gear</p>
                </div>
                <button onClick={() => updateDraft({ preparationPhase: 'location' })} className={styles.btn_secondary} style={{ whiteSpace: 'nowrap' }}>
                  ← Back to Origin
                </button>
              </div>
              <div className="layout-triptych-stage-content">
                {(props.worldTemplate.startingGearChoices || []).length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '2rem', color: 'var(--wizard-text-secondary)' }}>
                    <p>No gear available in this world template.</p>
                  </div>
                ) : (
                  (props.worldTemplate.startingGearChoices || []).map(gear => (
                    <button
                      key={gear.id}
                      className={`gear-card ${draft.startingGearId === gear.id ? 'selected' : ''}`}
                      onClick={() => {
                        hideTooltip();
                        updateDraft({
                          startingGearId: gear.id,
                          preparationPhase: 'curio'
                        });
                      }}
                      onMouseEnter={(e) => showTooltip(e, gearTooltipData(gear))}
                      onMouseLeave={hideTooltip}
                    >
                      <span className={`gear-card-category ${gear.category}`}>{gear.category}</span>
                      <div className="gear-card-icon">{gear.icon}</div>
                      <div className="gear-card-name">{gear.name}</div>
                      {gear.statBonuses && <div className="gear-card-stats">{gear.statBonuses}</div>}
                    </button>
                  ))
                )}
              </div>
              <div className="layout-triptych-stage-footer" />
            </>
          )}

          {/* Phase 3: Fate */}
          {phase === 'curio' && (
            <>
              <div className="layout-triptych-stage-header">
                <div>
                  <h2 style={{ color: 'var(--wizard-accent)', fontSize: '1.5rem', margin: 0 }}>🎲 Phase 3: Your Fate</h2>
                  <p style={{ color: 'var(--wizard-text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
                    {selectedCurio ? `You have rolled: ${selectedCurio.name}` : 'Roll for destiny'}
                  </p>
                </div>
                <button onClick={() => {
                  updateDraft({ preparationPhase: 'gear', flavorItemId: undefined });
                  setRerollCount(0);
                }} className={styles.btn_secondary} style={{ whiteSpace: 'nowrap' }}>
                  ← Back to Gear
                </button>
              </div>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {!selectedCurio ? (
                  <div className="fate-rolling-state">
                    {diceIsRolling ? (
                      <>
                        <Dice3D
                          isRolling={diceIsRolling}
                          onRollComplete={() => {
                            setDiceIsRolling(false);
                            updateDraft({ flavorItemId: getRollFateRandom() });
                          }}
                        />
                        <p className="fate-rolling-text">Your fate is being decided...</p>
                      </>
                    ) : (
                      <>
                        <span className="fate-static-dice">🎲</span>
                        <p className="fate-rolling-text">Click to roll your fortune</p>
                        <button
                          className={styles.btn_roll_fate}
                          disabled={diceIsRolling}
                          onClick={() => {
                            hideTooltip();
                            setDiceIsRolling(true);
                          }}
                        >
                          🎲 Roll for Your Fate
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={styles.curio_reveal}>
                    <div className={styles.curio_reveal_icon}>{selectedCurio.icon}</div>
                    <div className={styles.curio_reveal_name}>{selectedCurio.name}</div>
                    <div className={styles.curio_reveal_lore}>{selectedCurio.lore}</div>
                    <div className={styles.curio_action_buttons}>
                      <button
                        className={styles.curio_btn_accept}
                        onClick={() => updateDraft({ preparationPhase: 'complete' })}
                      >
                        ✓ Accept This Fate
                      </button>
                      <button
                        className={styles.curio_btn_reroll}
                        disabled={rerollCount >= 3}
                        title={rerollCount >= 3 ? 'Max rerolls reached' : 'Reroll your fortune'}
                        onClick={() => {
                          updateDraft({ flavorItemId: undefined });
                          setDiceIsRolling(true);
                          setRerollCount(c => c + 1);
                        }}
                      >
                        🎲 Reroll ({rerollCount}/3)
                      </button>
                    </div>
                    {rerollCount >= 3 && (
                      <p className={styles.curio_reroll_warning}>You&apos;ve used all your rerolls. Choose wisely.</p>
                    )}
                  </div>
                )}
              </div>
              <div className="layout-triptych-stage-footer" />
            </>
          )}

          {/* Phase Complete */}
          {phase === 'complete' && (
            <>
              <div className="layout-triptych-stage-header">
                <div>
                  <h2 style={{ color: 'var(--wizard-accent)', fontSize: '1.5rem', margin: 0 }}>✨ Ready to Awaken</h2>
                  <p style={{ color: 'var(--wizard-text-secondary)', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>Your destiny awaits...</p>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2rem' }}>
                <div style={{ fontSize: '3rem' }}>🌅</div>
                <div style={{ textAlign: 'center', color: 'var(--wizard-text-secondary)', fontSize: '1.1rem', lineHeight: '1.6' }}>
                  <p>{draft.characterName} the {ancestry}</p>
                  <p>stands ready to begin their journey.</p>
                </div>
                <button onClick={handleFinalize} className={styles.btn_success} style={{ padding: '1rem 2rem', fontSize: '1.1rem' }}>
                  ✓ Awaken & Enter the World
                </button>
              </div>
              <div className="layout-triptych-stage-footer" />
            </>
          )}
        </div>

      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0:
        return renderStep0_WorldContext();
      case 1:
        return renderStep1_Identity();
      case 2:
        return renderStep2_Ancestry();
      case 3:
        return renderStep3_Stats();
      case 4:
        return renderStep4_Talents();
      case 5:
        return renderStep5_OriginFinalize();
      default:
        return null;
    }
  };

  const getStatMechanics = (stat: keyof CoreAttributes): string => {
    const mechanics: Record<keyof CoreAttributes, string> = {
      STR: '+3% Melee DMG per point | +10 Carry Weight per point',
      DEX: '+4% Ranged Accuracy per point | +5 Throw Distance per point',
      AGI: '+2% Action Speed per point | +8% Evasion Defense per point',
      CON: '+5 Max HP per point | +3% Poison Resistance per point',
      INT: '+8 Mana Pool per point | +2% Spell Power per point',
      WIS: '+3% Mana Regen per point | +5% Judgment Call Success per point',
      CHA: '+5% NPC Persuasion per point | +3% Faction Relation Gains per point',
      PER: '-10 Fog-of-War per point | +8% Loot Detection Chance per point'
    };
    return mechanics[stat];
  };

  const getStatFlavorText = (stat: keyof CoreAttributes): string => {
    const flavorTexts: Record<keyof CoreAttributes, string> = {
      STR: 'Raw physical power and endurance.',
      DEX: 'Precision and nimble coordination.',
      AGI: 'Speed and reflexive grace.',
      CON: 'Fortitude and bodily resilience.',
      INT: 'Mental acuity and magical aptitude.',
      WIS: 'Intuition and spiritual awareness.',
      CHA: 'Personal magnetism and social influence.',
      PER: 'Sensory sharpness and environmental awareness.'
    };
    return flavorTexts[stat];
  };

  const getRaceModifiers = (raceId: string): string => {
    const race = races.find(r => r.id === raceId);
    if (!race) return 'No racial bonuses available.';
    // In future, pull from worldTemplate.ancestryTrees or race.modifiers
    // For now, return a placeholder
    return `${race.name} ancestry provides unique cultural traits and bonuses.`;
  };

  const renderCodex = () => {
    // If no target is hovered, show the selected race's innate passive or empty state
    if (!codexHoverTarget) {
      if (draft.selectedRace) {
        const selectedRaceAncestry = props.worldTemplate?.ancestryTrees?.find(
          (tree: any) => tree.race?.toLowerCase() === draft.selectedRace?.toLowerCase() || tree.id === draft.selectedRace
        );
        if (selectedRaceAncestry) {
          const passive = selectedRaceAncestry.innatePassive;
          return (
            <div className={styles.codex_content}>
              <div className={styles.codex_entry}>
                <div className={styles.codex_entry_name}>🧬 {selectedRaceAncestry.name}</div>
                <p className={styles.codex_entry_desc}>{selectedRaceAncestry.description}</p>
                {passive && (
                  <>
                    <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(155, 89, 182, 0.1)', borderLeft: '3px solid ' + passive.color, borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: passive.color, marginBottom: '0.5rem' }}>
                        {passive.icon} Innate: {passive.name}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#d0d0d0', margin: '0.5rem 0' }}>
                        {passive.lore}
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#a0d995', fontWeight: 600, margin: '0.5rem 0' }}>
                        ⚡ {passive.effect}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        }
      }
      return (
        <div className={styles.codex_empty}>
          <p>Hover over any stat or option to learn more...</p>
        </div>
      );
    }

    if (codexHoverTarget.type === 'slot') {
      const slotDescriptions: Record<string, { name: string; desc: string }> = {
        head: { name: 'Head Slot', desc: 'Where you will equip helmets, circlets, or hoods to protect your mind and skull.' },
        chest: { name: 'Chest Slot', desc: 'Your primary armor. A well-crafted breastplate or robe can mean the difference between victory and defeat.' },
        hands: { name: 'Hands Slot', desc: 'Gauntlets and gloves. Better grip, better control. Choose wisely.' },
        mainhand: { name: 'Main Hand Slot', desc: 'Your primary weapon. This is where your chosen starting arms will be equipped in Phase 2.' },
        offhand: { name: 'Off Hand Slot', desc: 'A shield, secondary weapon, or focus. Your second weapon changes everything.' },
        feet: { name: 'Feet Slot', desc: 'Boots and footwear. They determine your speed on the battlefield and your stance.' }
      };
      
      const slot = slotDescriptions[codexHoverTarget.value as string];
      if (!slot) return null;
      
      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div className={styles.codex_entry_name}>{slot.name}</div>
            <p className={styles.codex_entry_desc}>{slot.desc}</p>
            <p style={{ fontSize: '0.75rem', color: '#a0d995', marginTop: '1rem', fontStyle: 'italic' }}>
              ✨ This slot will be filled during Phase 2: Your Gear.
            </p>
          </div>
        </div>
      );
    }

    if (codexHoverTarget.type === 'stat') {
      const statKey = codexHoverTarget.value as keyof CoreAttributes;
      const statIcons: Record<keyof CoreAttributes, string> = {
        STR: '⚔️', DEX: '🎯', AGI: '🏃', CON: '❤️',
        INT: '🧠', WIS: '👁️', CHA: '💬', PER: '🔭'
      };

      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div className={styles.codex_entry_name}>
              {statIcons[statKey]} {statKey}
            </div>
            <p className={styles.codex_entry_desc}>
              {getStatFlavorText(statKey)}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#a0d995', marginTop: '0.75rem', fontStyle: 'italic', fontWeight: 600 }}>
              ⚙️ {getStatMechanics(statKey)}
            </p>
            <p style={{ fontSize: '0.8rem', color: '#74b9ff', marginTop: '0.5rem' }}>
              Current: {draft.baseStats[statKey]} / 20
            </p>
          </div>
        </div>
      );
    }

    if (codexHoverTarget.type === 'race') {
      const race = races.find(r => r.id === codexHoverTarget.value);
      if (!race) return null;

      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div className={styles.codex_entry_name}>🧬 {race.name}</div>
            <p className={styles.codex_entry_desc}>{race.description}</p>
            <p style={{ fontSize: '0.75rem', color: '#a0d995', marginTop: '0.75rem', fontStyle: 'italic', fontWeight: 600 }}>
              ⚡ {getRaceModifiers(race.id)}
            </p>
          </div>
        </div>
      );
    }

    if (codexHoverTarget.type === 'talent') {
      const talent = talents.find(t => t.id === codexHoverTarget.value);
      if (!talent) return null;
      const talentType = (talent as any).type || 'passive';
      const isActive = talentType === 'active';

      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div className={styles.codex_entry_name}>{talent.name}</div>
              <span style={isActive ? { color: '#74b9ff', fontWeight: 600 } : { color: '#ffd93d', fontWeight: 600 }}>
                {isActive ? '🔵 Active' : '🟡 Passive'}
              </span>
            </div>
            <p className={styles.codex_entry_desc}>{talent.description}</p>
            {(talent as any).mechanics && (
              <p style={{ fontSize: '0.8rem', color: '#8b9dc3', marginTop: '0.5rem' }}>
                <strong>Mechanics:</strong> {(talent as any).mechanics}
              </p>
            )}
            {(talent as any).cooldown && (
              <p style={{ fontSize: '0.8rem', color: '#a0d995', marginTop: '0.3rem' }}>
                <strong>Cooldown:</strong> {(talent as any).cooldown}
              </p>
            )}
            {(talent as any).cost && (
              <p style={{ fontSize: '0.8rem', color: '#a0d995', marginTop: '0.3rem' }}>
                <strong>Cost:</strong> {(talent as any).cost}
              </p>
            )}
            {talent.effect && (
              <p style={{ fontSize: '0.8rem', color: '#a0d995', marginTop: '0.5rem', fontStyle: 'italic', fontWeight: 600 }}>
                ⚡ {talent.effect}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (codexHoverTarget.type === 'location') {
      const location = props.worldTemplate.startingLocations?.find(l => l.id === codexHoverTarget.value);
      if (!location) return null;
      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div className={styles.codex_entry_name}>📍 {location.name}</div>
            <p className={styles.codex_entry_desc}>{location.description}</p>
            {location.geography && (
              <p style={{ fontSize: '0.85rem', color: '#8b9dc3', marginTop: '0.75rem', lineHeight: 1.5 }}>
                <strong style={{ color: '#74b9ff' }}>Geography:</strong> {location.geography}
              </p>
            )}
            {location.factionPresence && (
              <p style={{ fontSize: '0.85rem', color: '#ffd93d', marginTop: '0.5rem', lineHeight: 1.5 }}>
                <strong>Faction:</strong> {location.factionPresence}
              </p>
            )}
            {location.lore && (
              <p style={{ fontSize: '0.85rem', color: '#a0d995', marginTop: '0.75rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                {location.lore}
              </p>
            )}
          </div>
        </div>
      );
    }

    if (codexHoverTarget.type === 'gear') {
      const gear = props.worldTemplate.startingGearChoices?.find(g => g.id === codexHoverTarget.value);
      if (!gear) return null;
      return (
        <div className={styles.codex_content}>
          <div className={styles.codex_entry}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div className={styles.codex_entry_name}>{gear.icon} {gear.name}</div>
              <span style={{ color: gear.category === 'offense' ? '#ff6b6b' : '#74b9ff', fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>
                {gear.category}
              </span>
            </div>
            <p className={styles.codex_entry_desc}>{gear.flavorText}</p>
            {gear.mechanics && (
              <p style={{ fontSize: '0.85rem', color: '#8b9dc3', marginTop: '0.75rem' }}>
                <strong style={{ color: '#74b9ff' }}>Mechanics:</strong> {gear.mechanics}
              </p>
            )}
            {gear.statBonuses && (
              <p style={{ fontSize: '0.85rem', color: '#a0d995', marginTop: '0.5rem' }}>
                <strong>Bonuses:</strong> {gear.statBonuses}
              </p>
            )}
            {gear.lore && (
              <p style={{ fontSize: '0.85rem', color: '#a0d995', marginTop: '0.75rem', fontStyle: 'italic', lineHeight: 1.6 }}>
                {gear.lore}
              </p>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className={styles.wizard_container}>
      <div className={styles.wizard_main}>
        {currentStep === 5 ? (
          <div className={styles.wizard_triptych_wrapper}>
            {renderCurrentStep()}
          </div>
        ) : (
          <div className={styles.wizard_form_card}>
            {renderCurrentStep()}
          </div>
        )}
      </div>
      <HoverTooltip data={tooltipData} anchorRect={tooltipAnchor} />
    </div>
  );
}
