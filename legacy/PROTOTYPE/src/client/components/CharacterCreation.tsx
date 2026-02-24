import React, { useState, useEffect } from 'react';
import { createPlayerCharacter, getAvailableRaces, generateDefaultStats, STAT_POINTS_AVAILABLE } from '../../engine/characterCreation';
import { getAllBloodlines } from '../../engine/saveLoadEngine';

interface CharacterCreationProps {
  onCharacterCreated?: (character: any) => void;
  startingLocation?: string;
}

interface BloodlineOption {
  chronicleId: string;
  bloodlineId: string;
  canonicalName: string;
  mythStatus: number;
  inheritedPerks: string[];
  epochsLived: number;
}

export default function CharacterCreation({ onCharacterCreated, startingLocation = 'Eldergrove Village' }: CharacterCreationProps) {
  const [name, setName] = useState('');
  const [selectedRace, setSelectedRace] = useState('human');
  const [stats, setStats] = useState(generateDefaultStats());
  const [pointsRemaining, setPointsRemaining] = useState(STAT_POINTS_AVAILABLE);
  const [showBloodlineSelection, setShowBloodlineSelection] = useState(false);
  const [availableBloodlines, setAvailableBloodlines] = useState<BloodlineOption[]>([]);
  const [selectedBloodline, setSelectedBloodline] = useState<BloodlineOption | null>(null);
  const races = getAvailableRaces();

  // Load available bloodlines on mount
  useEffect(() => {
    const allBloodlines = getAllBloodlines();
    const bloodlineArray = Object.values(allBloodlines);
    if (bloodlineArray && bloodlineArray.length > 0) {
      setAvailableBloodlines(bloodlineArray.map((b: any) => ({
        chronicleId: b.bloodlineId,
        bloodlineId: b.bloodlineId,
        canonicalName: b.bloodlineId || 'Unknown Ancestor',
        mythStatus: b.totalMythStatus || 0,
        inheritedPerks: b.legacyImpacts?.[b.legacyImpacts.length - 1]?.inheritedPerks || [],
        epochsLived: b.legacyImpacts?.length || 0,
      })));
      setShowBloodlineSelection(true);
    }
  }, []);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleRaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRace(e.target.value);
  };

  const handleStatChange = (stat: keyof typeof stats, delta: number) => {
    if (delta > 0 && pointsRemaining <= 0) return;
    const newStats = { ...stats, [stat]: Math.max(1, stats[stat] + delta) };
    const newPointsUsed = (newStats.str - 10) + (newStats.agi - 10) + (newStats.int - 10) + (newStats.cha - 10) + (newStats.end - 10) + (newStats.luk - 10);
    if (newPointsUsed <= STAT_POINTS_AVAILABLE) {
      setStats(newStats);
      setPointsRemaining(STAT_POINTS_AVAILABLE - newPointsUsed);
    }
  };

  const handleSelectBloodline = (bloodline: BloodlineOption) => {
    setSelectedBloodline(bloodline);
  };

  const handleCreateCharacter = () => {
    if (!name.trim()) {
      alert('Please enter a character name');
      return;
    }
    try {
      const character = createPlayerCharacter(name, selectedRace, stats, startingLocation);
      
      // Apply bloodline perks if selected
      if (selectedBloodline) {
        character.bloodlineData = {
          canonicalName: selectedBloodline.canonicalName,
          inheritedPerks: selectedBloodline.inheritedPerks,
          inheritedItems: [],
          mythStatus: selectedBloodline.mythStatus,
          epochsLived: selectedBloodline.epochsLived,
          deeds: [],
        };
        
        // Apply inherited perks to stats
        if (selectedBloodline.inheritedPerks.includes('bloodline_resilience')) {
          character.maxHp = Math.round(character.maxHp * 1.05); // +5% HP
          character.hp = character.maxHp;
        }
        if (selectedBloodline.inheritedPerks.includes('ancestral_wisdom')) {
          character.spellCooldownBonus = (character.spellCooldownBonus || 0) + 2;
        }
        if (selectedBloodline.inheritedPerks.includes('legendary_bearing')) {
          // NPC faction reputation starts at +20
          character.factionReputation = character.factionReputation || {};
          (character.factionReputation as Record<string, number>)['all'] = 20;
        }
      }
      
      onCharacterCreated?.(character);
    } catch (error) {
      alert(`Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const statTotal = stats.str + stats.agi + stats.int + stats.cha + stats.end + stats.luk;

  return (
    <div className="character-creation">
      <h2>Create Your Character</h2>

      {/* Bloodline Selection */}
      {showBloodlineSelection && availableBloodlines.length > 0 && (
        <div className="form-group" style={{ padding: 12, backgroundColor: '#f0f8ff', borderRadius: 8, marginBottom: 16, border: '2px solid #4a90e2' }}>
          <h3 style={{ marginTop: 0, color: '#2c3e50' }}>Lineage Selection (Optional)</h3>
          <p style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
            You carry the legacy of your ancestors. Select a bloodline to inherit their perks and history.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
            {availableBloodlines.map((bloodline) => (
              <div
                key={bloodline.bloodlineId}
                onClick={() => handleSelectBloodline(bloodline)}
                style={{
                  padding: 12,
                  border: selectedBloodline?.bloodlineId === bloodline.bloodlineId ? '2px solid #4a90e2' : '1px solid #ddd',
                  borderRadius: 6,
                  backgroundColor: selectedBloodline?.bloodlineId === bloodline.bloodlineId ? '#e8f4f8' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#2c3e50', marginBottom: 4 }}>
                  {bloodline.canonicalName}
                </div>
                <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>
                  Myth Status: <strong>{bloodline.mythStatus}</strong> | Epochs: <strong>{bloodline.epochsLived}</strong>
                </div>
                {bloodline.inheritedPerks.length > 0 && (
                  <div style={{ fontSize: 10, color: '#4a90e2' }}>
                    <strong>Perks:</strong>
                    <ul style={{ margin: '4px 0', paddingLeft: 16 }}>
                      {bloodline.inheritedPerks.map((perk) => (
                        <li key={perk} style={{ marginBottom: 2 }}>{perk.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {selectedBloodline && (
            <div style={{ padding: 8, backgroundColor: '#d4edda', borderRadius: 4, color: '#155724', fontSize: 12, marginBottom: 8 }}>
              ✓ {selectedBloodline.canonicalName}'s legacy will enhance your journey
            </div>
          )}
          
          <button
            onClick={() => setSelectedBloodline(null)}
            style={{ padding: 6, fontSize: 11, opacity: 0.7 }}
          >
            Start Fresh (No Bloodline)
          </button>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="char-name">Character Name</label>
        <input
          id="char-name"
          type="text"
          value={name}
          onChange={handleNameChange}
          placeholder="Enter your character name"
          maxLength={30}
        />
      </div>

      <div className="form-group">
        <label htmlFor="char-race">Race</label>
        <select id="char-race" value={selectedRace} onChange={handleRaceChange}>
          {races.map(race => (
            <option key={race.id} value={race.id}>
              {race.name} - {race.description}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Attributes</label>
        <p>Points Remaining: <strong>{pointsRemaining}</strong> / {STAT_POINTS_AVAILABLE}</p>
        <div className="stat-allocator">
          {(['str', 'agi', 'int', 'cha', 'end', 'luk'] as const).map(statName => (
            <div key={statName} className="stat-row">
              <span className="stat-label">{statName.toUpperCase()}</span>
              <button onClick={() => handleStatChange(statName, -1)} disabled={stats[statName] <= 1}>
                −
              </button>
              <input
                type="text"
                value={stats[statName]}
                readOnly
                className="stat-value"
              />
              <button onClick={() => handleStatChange(statName, 1)} disabled={pointsRemaining <= 0}>
                +
              </button>
            </div>
          ))}
        </div>
        <p>Total: {statTotal}</p>
      </div>

      <button
        onClick={handleCreateCharacter}
        className="create-button"
        disabled={!name.trim() || pointsRemaining < 0}
      >
        Create Character
      </button>
    </div>
  );
}
