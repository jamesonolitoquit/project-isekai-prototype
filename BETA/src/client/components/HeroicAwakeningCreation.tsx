import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  createPlayerCharacter,
  generateDefaultStats,
  getAvailableRaces,
  getAvailableArchetypes,
  getAvailableTalents,
  getArchetype,
  STAT_POINTS_AVAILABLE,
  validateStatAllocation,
  type CharacterStats,
  type Archetype
} from '../../engine/characterCreation';
import { generateOriginStory, refineOriginStory, analyzeStoryForSeeds } from '../services/aiStoryService';

type CreationStep = 'origin' | 'vessel' | 'gift' | 'review';

interface HeroicAwakeningCreationProps {
  onCharacterCreated?: (character: any) => void;
  worldTemplate?: any;
}

// Theme mapping based on world template
function getThemeForTemplate(template?: any): 'parchment' | 'digital' | 'dark-fantasy' {
  if (!template) return 'dark-fantasy';
  const name = (template.name || '').toLowerCase();
  if (name.includes('cyber') || name.includes('digital')) return 'digital';
  if (name.includes('ancient') || name.includes('parchment')) return 'parchment';
  return 'dark-fantasy';
}

// Get theme styles
function getThemeStyles(theme: 'parchment' | 'digital' | 'dark-fantasy') {
  const themes = {
    parchment: {
      background: '#f5f1e8',
      accent: '#8b6f47',
      textColor: '#2c2416',
      borderColor: '#d4a574',
      fontSize: 'Georgia, serif',
      borderStyle: 'solid'
    },
    digital: {
      background: '#0a0e27',
      accent: '#00ff41',
      textColor: '#00ff41',
      borderColor: '#00ff41',
      fontSize: 'Courier New, monospace',
      borderStyle: 'dashed'
    },
    'dark-fantasy': {
      background: '#1a1a2e',
      accent: '#9d4edd',
      textColor: '#e0aaff',
      borderColor: '#7b2cbf',
      fontSize: 'Trebuchet MS, sans-serif',
      borderStyle: 'solid'
    }
  };
  return themes[theme];
}

export default function HeroicAwakeningCreation({ onCharacterCreated, worldTemplate }: HeroicAwakeningCreationProps) {
  const theme = getThemeForTemplate(worldTemplate);
  const themeStyles = getThemeStyles(theme);

  // Step 1: Origin
  const [originStory, setOriginStory] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingStory, setIsGeneratingStory] = useState(false);

  // Step 2: The Vessel
  const [characterName, setCharacterName] = useState('');
  const [selectedRace, setSelectedRace] = useState('human');
  const [selectedArchetype, setSelectedArchetype] = useState('exiled-noble');
  const [stats, setStats] = useState<CharacterStats>(generateDefaultStats());
  const [pointsRemaining, setPointsRemaining] = useState(STAT_POINTS_AVAILABLE);

  // Step 3: The Gift (Talents)
  const [selectedTalents, setSelectedTalents] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState<CreationStep>('origin');

  // Click-hold state for faster stat adjustment
  const holdingRef = useRef<{ stat: keyof CharacterStats; direction: number; interval: NodeJS.Timeout } | null>(null);

  const handleStatMouseDown = (stat: keyof CharacterStats, direction: number) => {
    handleStatChange(stat, direction);
    // After 500ms, start rapid incrementing
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        setStats(prevStats => {
          const newStats = { ...prevStats };
          const newValue = (newStats[stat] as number) + direction;
          if (direction > 0 && pointsRemaining <= 0) return prevStats;
          if (newValue >= 1 && newValue <= 20) {
            (newStats[stat] as number) = newValue;
            const total = Object.values(newStats).reduce((a, b) => a + b, 0);
            setPointsRemaining(Math.max(0, STAT_POINTS_AVAILABLE - (total - 70)));
            return newStats;
          }
          return prevStats;
        });
      }, 100);
      holdingRef.current = { stat, direction, interval };
    }, 500);
  };

  const handleStatMouseUp = () => {
    if (holdingRef.current?.interval) {
      clearInterval(holdingRef.current.interval);
      holdingRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (holdingRef.current?.interval) {
        clearInterval(holdingRef.current.interval);
      }
    };
  }, []);

  const races = useMemo(() => getAvailableRaces(), []);
  const archetypes = useMemo(() => getAvailableArchetypes(), []);
  const talents = useMemo(() => getAvailableTalents(), []);
  const selectedArchetypeInfo = useMemo(() => getArchetype(selectedArchetype), [selectedArchetype]);

  const handleGenerateStory = async () => {
    setIsGeneratingStory(true);
    try {
      const story = await generateOriginStory({
        archetype: selectedArchetype,
        race: selectedRace,
        characterName: characterName || 'Unknown Hero',
        additionalContext: aiPrompt || undefined
      });
      setOriginStory(story);
      setAiPrompt('');
    } catch (error) {
      alert(`${error instanceof Error ? error.message : 'Failed to generate story'}`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleRefineStory = async () => {
    if (!originStory.trim()) {
      alert('Please write or generate a story first');
      return;
    }
    if (!aiPrompt.trim()) {
      alert('Please enter how you want to improve the story');
      return;
    }
    setIsGeneratingStory(true);
    try {
      const refinedStory = await refineOriginStory({
        currentStory: originStory,
        refinementPrompt: aiPrompt,
        archetype: selectedArchetype
      });
      setOriginStory(refinedStory);
      setAiPrompt('');
    } catch (error) {
      alert(`${error instanceof Error ? error.message : 'Failed to refine story'}`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const handleStatChange = (stat: keyof CharacterStats, delta: number) => {
    if (delta > 0 && pointsRemaining <= 0) return;
    const newStats = { ...stats };
    (newStats[stat] as number) = Math.max(1, (newStats[stat] as number) + delta);

    if (validateStatAllocation(newStats)) {
      setStats(newStats);
      // Recalculate points remaining (7 * 10 = 70 base)
      const total = Object.values(newStats).reduce((a, b) => a + b, 0);
      setPointsRemaining(STAT_POINTS_AVAILABLE - (total - 70));
    }
  };

  const handleTalentToggle = (talentId: string) => {
    setSelectedTalents(prev => {
      const isSelected = prev.includes(talentId);
      // Allow up to 3 talents
      if (isSelected) {
        return prev.filter(id => id !== talentId);
      } else if (prev.length < 3) {
        return [...prev, talentId];
      }
      return prev;
    });
  };

  const handleCreateCharacter = async () => {
    if (!characterName.trim()) {
      alert('Please enter a character name');
      return;
    }

    setIsGeneratingStory(true); // Re-use for the creation process
    
    // Phase 7: Live AI Synthesis - Interpret story into world seeds
    let narrativeSeeds = { reputation: {}, narrativeFlags: {} };
    try {
      narrativeSeeds = await analyzeStoryForSeeds(originStory, selectedArchetype);
      console.log('AI Narrative Analysis:', narrativeSeeds);
    } catch (e) {
      console.warn('AI analysis skipped, using static defaults');
    }

    const archetype = selectedArchetypeInfo;
    const startingLocation = archetype?.startingLocation || 'Eldergrove Village';

    try {
      const character = createPlayerCharacter(
        characterName,
        selectedRace,
        stats,
        startingLocation,
        originStory,
        selectedArchetype,
        selectedTalents,
        worldTemplate  // Phase 47: Pass template for ancestry tree initialization
      );
      
      // Inject AI interpreted seeds into the character before finalizing
      // Use "reputation" as initialReputation if detected
      if (narrativeSeeds.reputation) {
        character.reputation = { ...character.reputation, ...narrativeSeeds.reputation };
      }
      
      onCharacterCreated?.(character);
    } catch (error) {
      alert(`Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingStory(false);
    }
  };

  const containerStyle: React.CSSProperties = {
    maxWidth: window.innerWidth < 768 ? '95vw' : '85vw',
    maxHeight: '90vh',
    margin: '0 auto',
    padding: window.innerWidth < 768 ? '1rem' : '1.5rem',
    background: themeStyles.background,
    color: themeStyles.textColor,
    fontFamily: themeStyles.fontSize,
    border: `2px ${themeStyles.borderStyle} ${themeStyles.borderColor}`,
    borderRadius: theme === 'digital' ? '0' : '8px',
    boxSizing: 'border-box',
    overflowY: 'auto',
    overflowX: 'hidden'
  };

  const headingStyle: React.CSSProperties = {
    color: themeStyles.accent,
    textAlign: 'center',
    marginBottom: '1.2rem',
    fontSize: '1.5rem',
    textShadow: theme === 'digital' ? `0 0 10px ${themeStyles.accent}` : 'none'
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '1rem',
    padding: '1rem',
    border: `1px ${themeStyles.borderStyle} ${themeStyles.borderColor}`,
    borderRadius: theme === 'digital' ? '0' : '4px'
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0.6rem 1rem',
    marginRight: '0.6rem',
    marginTop: '0.5rem',
    background: themeStyles.accent,
    color: themeStyles.background,
    border: 'none',
    borderRadius: theme === 'digital' ? '0' : '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    textTransform: 'uppercase'
  };

  const statRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    padding: '0.4rem',
    border: `1px solid ${themeStyles.borderColor}`,
    borderRadius: theme === 'digital' ? '0' : '4px'
  };

  const stepIndicatorStyle: React.CSSProperties = {
    textAlign: 'center',
    marginBottom: '0.8rem',
    fontSize: '0.8rem',
    opacity: 0.8
  };

  const talentGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: window.innerWidth < 768 ? '1fr' : 'repeat(2, 1fr)',
    gap: '0.7rem',
    marginTop: '0.7rem'
  };

  const talentCardStyle = (isSelected: boolean): React.CSSProperties => ({
    padding: '0.75rem',
    border: `2px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? themeStyles.accent : themeStyles.borderColor}`,
    borderRadius: theme === 'digital' ? '0' : '4px',
    cursor: 'pointer',
    background: isSelected ? `${themeStyles.accent}22` : 'transparent',
    transition: 'all 0.3s ease'
  });

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>⚔️ THE HEROIC AWAKENING ⚔️</h1>
      <p style={stepIndicatorStyle}>
        Step {currentStep === 'origin' ? 1 : currentStep === 'vessel' ? 2 : currentStep === 'gift' ? 3 : 4} of 4: {
          currentStep === 'origin' ? 'The Origin' :
          currentStep === 'vessel' ? 'The Vessel' :
          currentStep === 'gift' ? 'The Gift' :
          'Review & Awaken'
        }
      </p>

      {/* STEP 1: THE ORIGIN */}
      {currentStep === 'origin' && (
        <div style={sectionStyle}>
          <h2 style={{ color: themeStyles.accent }}>📖 Step 1: The Origin</h2>
          <p>Tell us your story. How did you arrive at this moment? What was your life before the Awakening?</p>
          
          <div style={{ marginBottom: '1rem' }}>
            <textarea
              value={originStory}
              onChange={(e) => setOriginStory(e.target.value)}
              placeholder="Write your background story (100-500 characters)..."
              style={{
                width: '100%',
                minHeight: '100px',
                maxHeight: '120px',
                padding: '0.8rem',
                fontFamily: themeStyles.fontSize,
                backgroundColor: theme === 'digital' ? '#000' : '#fff',
                color: themeStyles.textColor,
                border: `1px solid ${themeStyles.borderColor}`,
                borderRadius: theme === 'digital' ? '0' : '4px',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
                resize: 'vertical'
              }}
              maxLength={500}
            />
            <p style={{ fontSize: '0.9rem', opacity: 0.7, margin: '0.5rem 0 0 0' }}>
              {originStory.length} / 500 characters
            </p>
          </div>

          {/* AI Story Generation Section */}
          <div style={{
            padding: '0.8rem',
            background: `${themeStyles.accent}11`,
            border: `1px dashed ${themeStyles.accent}`,
            borderRadius: theme === 'digital' ? '0' : '4px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: themeStyles.accent }}>
              ✨ AI Story Assistant
            </h4>
            
            <p style={{ fontSize: '0.85rem', marginBottom: '0.6rem' }}>
              {originStory.length === 0 
                ? 'Use AI to generate a unique origin story, or describe what kind of story you want.'
                : 'Describe how you\'d like to refine or improve your story.'}
            </p>

            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder={originStory.length === 0
                ? "E.g., 'Make me a cursed blacksmith from a destroyed forge' or leave blank for random generation"
                : "E.g., 'Make it more dramatic' or 'Add more about my tragic past'"}
              style={{
                width: '100%',
                minHeight: '60px',
                maxHeight: '80px',
                padding: '0.6rem',
                fontFamily: themeStyles.fontSize,
                backgroundColor: theme === 'digital' ? '#000' : '#fff',
                color: themeStyles.textColor,
                border: `1px solid ${themeStyles.borderColor}`,
                borderRadius: theme === 'digital' ? '0' : '4px',
                fontSize: '0.85rem',
                boxSizing: 'border-box',
                marginBottom: '0.8rem',
                resize: 'vertical'
              }}
              maxLength={200}
            />

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerateStory}
              disabled={isGeneratingStory}
              style={{
                ...buttonStyle,
                opacity: isGeneratingStory ? 0.6 : 1,
                cursor: isGeneratingStory ? 'wait' : 'pointer'
              }}
            >
              {isGeneratingStory ? '⟳ Generating...' : '🎲 Generate Story'}
            </button>
            
            {originStory.length > 0 && (
              <button
                onClick={handleRefineStory}
                disabled={isGeneratingStory || !aiPrompt.trim()}
                style={{
                  ...buttonStyle,
                  background: 'transparent',
                  color: themeStyles.accent,
                  border: `1px solid ${themeStyles.accent}`,
                  opacity: (isGeneratingStory || !aiPrompt.trim()) ? 0.5 : 1,
                  cursor: (isGeneratingStory || !aiPrompt.trim()) ? 'not-allowed' : 'pointer'
                }}
              >
                {isGeneratingStory ? '⟳ Refining...' : '✏️ Refine Story'}
              </button>
            )}
          </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
            <button
              onClick={() => setCurrentStep('vessel')}
              style={buttonStyle}
              disabled={originStory.length < 20}
            >
              Continue →
            </button>
            
            {/* Emergency Skip Button */}
            <button
              onClick={() => {
                setOriginStory(originStory || `The journey that brought me here is long, but I am ready to face what comes.`);
                setCurrentStep('vessel');
              }}
              style={{
                ...buttonStyle,
                background: '#ff6b6b',
                fontSize: '0.85rem',
                padding: '0.5rem 0.8rem'
              }}
              title="Skip AI story generation and proceed with defaults"
            >
              ⚡ Skip Story
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: THE VESSEL */}
      {currentStep === 'vessel' && (
        <div style={sectionStyle}>
          <h2 style={{ color: themeStyles.accent }}>🗡️ Step 2: The Vessel</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="char-name" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.4rem' }}>Character Name</label>
            <input
              id="char-name"
              type="text"
              value={characterName}
              onChange={(e) => setCharacterName(e.target.value)}
              placeholder="Your name in this world..."
              maxLength={30}
              style={{
                width: '100%',
                padding: '0.8rem',
                marginTop: 0,
                fontFamily: themeStyles.fontSize,
                backgroundColor: theme === 'digital' ? '#000' : '#fff',
                color: themeStyles.textColor,
                border: `1px solid ${themeStyles.borderColor}`,
                borderRadius: theme === 'digital' ? '0' : '4px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem', display: 'grid', gridTemplateColumns: window.innerWidth < 768 ? '1fr' : '1fr 1fr', gap: '0.8rem' }}>
            <div>
              <label htmlFor="char-race" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Race</label>
              <select
                id="char-race"
                value={selectedRace}
                onChange={(e) => setSelectedRace(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  marginTop: 0,
                  fontFamily: themeStyles.fontSize,
                  backgroundColor: theme === 'digital' ? '#000' : '#fff',
                  color: themeStyles.textColor,
                  border: `1px solid ${themeStyles.borderColor}`,
                  borderRadius: theme === 'digital' ? '0' : '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              >
                {races.map(race => (
                  <option key={race.id} value={race.id}>
                    {race.name} - {race.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="char-archetype" style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>Archetype</label>
              <select
                id="char-archetype"
                value={selectedArchetype}
                onChange={(e) => setSelectedArchetype(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.8rem',
                  marginTop: 0,
                  fontFamily: themeStyles.fontSize,
                  backgroundColor: theme === 'digital' ? '#000' : '#fff',
                  color: themeStyles.textColor,
                  border: `1px solid ${themeStyles.borderColor}`,
                  borderRadius: theme === 'digital' ? '0' : '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              >
                {archetypes.map(arch => (
                  <option key={arch.id} value={arch.id}>{arch.name}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedArchetypeInfo && (
            <div style={{
              padding: '0.8rem',
              background: `${themeStyles.accent}11`,
              border: `1px dashed ${themeStyles.accent}`,
              borderRadius: theme === 'digital' ? '0' : '4px',
              marginBottom: '1rem'
            }}>
              <p><strong>{selectedArchetypeInfo.name}:</strong> {selectedArchetypeInfo.description}</p>
              <p style={{ fontSize: '0.9rem', opacity: 0.8 }}>
                📍 Starting Location: {selectedArchetypeInfo.startingLocation}
              </p>
            </div>
          )}

          <div>
            <label style={{ fontWeight: 'bold', display: 'block', marginBottom: '0.5rem' }}>
              The 8 Core Attributes (Points Remaining: <span style={{ color: themeStyles.accent }}>{pointsRemaining}</span> / {STAT_POINTS_AVAILABLE})
            </label>
            <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
              <strong>STR:</strong> Physical power | <strong>DEX:</strong> Precision | <strong>AGI:</strong> Agility & reflexes | <strong>CON:</strong> Constitution & health | <strong>INT:</strong> Intelligence & magic | <strong>WIS:</strong> Wisdom & insight | <strong>CHA:</strong> Charisma & influence | <strong>PER:</strong> Perception & awareness
            </div>

            <div>
              {(['STR', 'DEX', 'AGI', 'CON', 'INT', 'WIS', 'CHA', 'PER'] as const).map(statName => (
                <div key={statName} style={statRowStyle}>
                  <span style={{ fontWeight: 'bold', minWidth: '80px' }}>
                    {statName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <button
                      onMouseDown={() => handleStatMouseDown(statName, -1)}
                      onMouseUp={handleStatMouseUp}
                      onMouseLeave={handleStatMouseUp}
                      disabled={stats[statName] <= 1}
                      style={{ ...buttonStyle, padding: '0.4rem 0.8rem', marginRight: '0.5rem', marginTop: 0 }}
                      title="Click to decrease or hold to decrease faster"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      value={stats[statName]}
                      readOnly
                      style={{
                        width: '50px',
                        padding: '0.4rem',
                        textAlign: 'center',
                        backgroundColor: theme === 'digital' ? '#000' : '#fff',
                        color: themeStyles.textColor,
                        border: `1px solid ${themeStyles.borderColor}`,
                        borderRadius: theme === 'digital' ? '0' : '2px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      onMouseDown={() => handleStatMouseDown(statName, 1)}
                      onMouseUp={handleStatMouseUp}
                      onMouseLeave={handleStatMouseUp}
                      disabled={pointsRemaining <= 0}
                      style={{ ...buttonStyle, padding: '0.4rem 0.8rem', marginRight: 0, marginTop: 0 }}
                      title="Click to increase or hold to increase faster"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
            <button
              onClick={() => setCurrentStep('vessel')}
              style={{ ...buttonStyle, background: 'transparent', color: themeStyles.accent, border: `1px solid ${themeStyles.accent}`, marginRight: 0 }}
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep('gift')}
              style={buttonStyle}
              disabled={!characterName.trim() || pointsRemaining < 0}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: THE GIFT */}
      {currentStep === 'gift' && (
        <div style={sectionStyle}>
          <h2 style={{ color: themeStyles.accent }}>✨ Step 3: The Gift</h2>
          <p>Select up to 3 innate talents that define your unique essence.</p>

          <div style={talentGridStyle}>
            {talents.map(talent => (
              <div
                key={talent.id}
                onClick={() => handleTalentToggle(talent.id)}
                style={talentCardStyle(selectedTalents.includes(talent.id))}
              >
                <h4 style={{ margin: '0 0 0.5rem 0', color: selectedTalents.includes(talent.id) ? themeStyles.accent : 'inherit' }}>
                  {talent.name}
                  {selectedTalents.includes(talent.id) ? ' ✓' : ''}
                </h4>
                <p style={{ margin: 0, fontSize: '0.9rem', opacity: 0.8 }}>{talent.description}</p>
              </div>
            ))}
          </div>

          <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', opacity: 0.7 }}>
            Selected: {selectedTalents.length} / 3
          </p>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '0.8rem' }}>
            <button
              onClick={() => setCurrentStep('vessel')}
              style={{ ...buttonStyle, background: 'transparent', color: themeStyles.accent, border: `1px solid ${themeStyles.accent}`, marginRight: 0 }}
            >
              ← Back
            </button>
            <button
              onClick={() => setCurrentStep('review')}
              style={buttonStyle}
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW & AWAKEN */}
      {currentStep === 'review' && (
        <div style={sectionStyle}>
          <h2 style={{ color: themeStyles.accent }}>🔯 Step 4: Review & Awaken</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '1rem' }}>
            <div>
              <h4>Your Identity</h4>
              <p style={{ fontSize: '0.9rem' }}><strong>Name:</strong> {characterName}</p>
              <p style={{ fontSize: '0.9rem' }}><strong>Race:</strong> {races.find(r => r.id === selectedRace)?.name}</p>
              <p style={{ fontSize: '0.9rem' }}><strong>Archetype:</strong> {selectedArchetypeInfo?.name}</p>
              <p style={{ fontSize: '0.9rem' }}><strong>Location:</strong> {selectedArchetypeInfo?.startingLocation}</p>
            </div>

            <div>
              <h4>Your Attributes</h4>
              <div style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                <div>STR: {stats.STR} | DEX: {stats.DEX} | AGI: {stats.AGI} | CON: {stats.CON}</div>
                <div>INT: {stats.INT} | WIS: {stats.WIS} | CHA: {stats.CHA} | PER: {stats.PER}</div>
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4>Your Origin</h4>
            <p style={{ fontStyle: 'italic', opacity: 0.8, wordBreak: 'break-word' }}>"{originStory}"</p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <h4>Your Gifts ({selectedTalents.length})</h4>
            <ul style={{ margin: 0, marginLeft: '1.5rem', paddingLeft: 0 }}>
              {selectedTalents.map(talentId => {
                const talent = talents.find(t => t.id === talentId);
                return <li key={talentId}>{talent?.name}: {talent?.description}</li>;
              })}
            </ul>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={() => setCurrentStep('gift')}
              style={{ ...buttonStyle, background: 'transparent', color: themeStyles.accent, border: `1px solid ${themeStyles.accent}` }}
            >
              ← Back
            </button>
            <button
              onClick={handleCreateCharacter}
              style={{
                ...buttonStyle,
                background: themeStyles.accent,
                color: themeStyles.background,
                fontSize: '1rem',
                padding: '0.8rem 1.5rem'
              }}
            >
              🌟 AWAKEN 🌟
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
