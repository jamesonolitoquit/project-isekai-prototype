import React, { useState } from 'react';
import { createPlayerCharacter, getAvailableRaces, generateDefaultStats, STAT_POINTS_AVAILABLE } from '../../engine/characterCreation';

interface CharacterCreationProps {
  onCharacterCreated?: (character: any) => void;
  startingLocation?: string;
}

export default function CharacterCreation({ onCharacterCreated, startingLocation = 'Eldergrove Village' }: CharacterCreationProps) {
  const [name, setName] = useState('Adventurer');
  const [selectedRace, setSelectedRace] = useState('human');
  const [stats, setStats] = useState(generateDefaultStats());
  const [pointsRemaining, setPointsRemaining] = useState(STAT_POINTS_AVAILABLE);
  const races = getAvailableRaces();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleRaceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRace(e.target.value);
  };

  const handleStatChange = (stat: keyof typeof stats, delta: number) => {
    if (delta > 0 && pointsRemaining <= 0) return;
    const newStats = { ...stats, [stat]: Math.max(1, stats[stat] + delta) };
    // Calculate points used for the 8 core stats (excluding LCK which is auto-generated)
    const newPointsUsed = (newStats.STR - 10) + (newStats.DEX - 10) + (newStats.AGI - 10) + (newStats.CON - 10) + (newStats.INT - 10) + (newStats.WIS - 10) + (newStats.CHA - 10) + (newStats.PER - 10);
    if (newPointsUsed <= STAT_POINTS_AVAILABLE) {
      setStats(newStats);
      setPointsRemaining(STAT_POINTS_AVAILABLE - newPointsUsed);
    }
  };

  const handleCreateCharacter = () => {
    if (!name.trim()) {
      alert('Please enter a character name');
      return;
    }
    try {
      const character = createPlayerCharacter(name, selectedRace, stats, startingLocation);
      onCharacterCreated?.(character);
    } catch (error) {
      alert(`Failed to create character: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const statTotal = stats.STR + stats.DEX + stats.AGI + stats.CON + stats.INT + stats.WIS + stats.CHA + stats.PER;

  return (
    <div className="character-creation">
      <h2>Create Your Character</h2>

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
          {(['STR', 'DEX', 'AGI', 'CON', 'INT', 'WIS', 'CHA', 'PER'] as const).map(statName => (
            <div key={statName} className="stat-row">
              <span className="stat-label">{statName}</span>
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
