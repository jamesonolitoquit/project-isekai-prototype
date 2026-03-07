# Phase 11: The Weight of Influence — Implementation Plan

> **Status:** ACTIVE
> **Category:** IMPLEMENTATION
> **Updated:** February 16, 2026

---

**Status:** In Progress (Foundation Complete ✓)  
**Date Started:** February 13, 2026

## Overview
Phase 11 implements **Faction Power Dynamics** — a macro-scale political system where organized factions vie for control, resources, and influence across the world. This system integrates with Phase 10's WTOL to create "faction-gated truths" where NPC loyalty and information availability depend on player reputation with factions.

---

## Core Systems

### 1. Faction Engine (✓ COMPLETE)
**File:** `PROTOTYPE/src/engine/factionEngine.ts` (400+ lines)

**Implemented:**
- `Faction` type with power scoring, belief alignment, controlled territories
- `FactionRelationship` tracking (alliance, rivalry, war, neutral, dependency)
- `FactionConflict` system for dynamic inter-faction struggles
- `calculatePowerShift()` - update faction influence
- `calculateFactionTension()` - predict conflict likelihood
- `checkForFactionConflict()` - random conflict generation
- `resolveFactionConflict()` - apply conflict outcomes
- `updateTerritoryControl()` - dynamic location ownership
- `getFactionAttitude()` - player rep → allied/neutral/hostile
- `canAccessFactionContent()` - faction-gated content
- `initializeFactions()` - create 5 base factions:
  1. **Silver Flame** (Religious, Good) - Healers & Protectors
  2. **Ironsmith Guild** (Adventure, Neutral) - Crafters & Merchants
  3. **Luminara Mercantile Consortium** (Political, Neutral) - Traders
  4. **Shadow Conclave** (Shadow, Evil) - Forbidden Knowledge
  5. **Adventurers' League** (Adventure, Chaotic) - Freedom Seekers

**Base Relationships:**
- Silver Flame ↔ Ironsmith: ALLIANCE (+70)
- Silver Flame ↔ Shadow: WAR (-85)
- Adventurers ↔ Silver Flame: ALLIANCE (+55)
- Luminara ↔ Ironsmith: ALLIANCE (+60)
- Luminara ↔ Shadow: NEUTRAL (+10)

### 2. World State Integration (✓ COMPLETE)
**File:** `PROTOTYPE/src/engine/worldEngine.ts`

**Added to WorldState:**
- `factions: Faction[]` - array of faction entities
- `factionRelationships: FactionRelationship[]` - inter-faction graph
- `factionConflicts: FactionConflict[]` - active conflicts
- `lastFactionTick: number` - when faction events last processed

**Added to PlayerState:**
- `factionReputation: Record<string, number>` - reputation with each faction (-100 to +100)

**Added to NPC:**
- `factionId?: string` - which faction the NPC belongs to
- `factionRole?: string` - role within faction (leader, soldier, informant, etc.)

**Updated luxfier-world.json:**
- Brother Theron: `factionId: 'silver-flame'`, `factionRole: 'leader'`
- Smitty Ironhammer: `factionId: 'ironsmith-guild'`, `factionRole: 'leader'`
- Sergeant Brynn: `factionId: 'luminara-mercantile'`, `factionRole: 'soldier'`

### 3. NPC Faction Awareness
**File:** `PROTOTYPE/src/engine/npcEngine.ts` (TODO)

**To Implement:**
- Dialogue gated by faction reputation (requires `factionReputation[factionId] >= threshold`)
- NPC bias/prejudice based on player faction relationships
- Dialogue variations based on faction conflict status
- Quest gatekeeping - only available to certain faction reputations

### 4. Faction Ticks & Events
**File:** `PROTOTYPE/src/engine/worldEngine.ts` (TODO - in advanceTick)

**To Implement:**
- Every 24 game hours: trigger `FACTION_STRUGGLE` event
- Check for conflicts between rival factions
- Apply power shifts from player actions
- Generate `LOCATION_CONTROL_CHANGED` events
- Emit `FACTION_POWER_SHIFT` events

### 5. Obfuscation Integration
**File:** `PROTOTYPE/src/engine/obfuscationEngine.ts` (TODO)

**To Implement:**
- If faction is "Hostile": NPCs display as "??? (Unknown)" regardless of IDENTIFY
- If faction is "Allied": player automatically discovers all faction members
- Faction-gated beliefs in BeliefLayer

### 6. Action Pipeline Events
**File:** `PROTOTYPE/src/engine/actionPipeline.ts` (TODO)

**To Implement Events:**
- `FACTION_QUEST_COMPLETED` - grant faction power + reputation
- `FACTION_QUEST_REJECTED` - lose faction reputation
- `FACTION_ALLY_KILLED` - lose rep + trigger conflict
- `FACTION_ENEMY_DEFEATED` - gain rep + power
- `FACTION_STRUGGLE` - triggered by faction ticks
- `FACTION_POWER_SHIFT` - power changes
- `LOCATION_CONTROL_CHANGED` - territory shifts hands

### 7. State Rebuilder
**File:** `PROTOTYPE/src/engine/stateRebuilder.ts` (TODO)

**To Implement Event Handlers:**
- `FACTION_QUEST_COMPLETED` - update playerReputation + factionReputation
- `FACTION_POWER_SHIFT` - update faction.powerScore
- `FACTION_STRUGGLE` - create conflict
- `LOCATION_CONTROL_CHANGED` - update faction.controlledLocationIds
- `FACTION_ALLY_KILLED` - apply consequence to player rep

### 8. UI: Faction Panel
**File:** `PROTOTYPE/src/client/components/FactionPanel.tsx` (TODO)

**To Display:**
- Faction list with power scores (visual bars)
- Player reputation with each faction (-100 to +100)
- Faction attitude (Allied/Neutral/Hostile) with color coding
- Key members of faction from knowledgeBase
- Relationships between factions
- Recent faction events/conflicts

---

## Integration Points

### With Phase 10 (WTOL)
- Hostile factions: information obscured even after IDENTIFY
- Allied factions: automatic knowledge discovery
- Suspicion level affected by faction conflicts

### With Phase 9 (Magic System)
- Faction leaders may teach restricted spells
- Membership grants access to unique spell trees

### With Core Systems
- Combat: Enemy faction NPCs drop faction-specific loot
- Quests: Faction quest chains available
- Dialogue: NPC approach depends on player faction standing
- Reputation: NPC rep now linked to faction affiliation

---

## Acceptance Criteria

- [ ] All 5 factions appear in world state with correct power scores
- [ ] Faction Panel displays all factions filtered by player knowledge
- [ ] Player reputation system tracks faction affiliation independently
- [ ] Faction ticks trigger every 24 game hours
- [ ] FACTION_STRUGGLE events generate conflicts
- [ ] Territory control changes hands based on conflicts
- [ ] Power shifts apply to factions after events
- [ ] NPC dialogue respects faction reputation gates
- [ ] Hostile faction NPCs remain masked in UI
- [ ] Allied faction members auto-discovered
- [ ] Completing faction quests grant reputation
- [ ] High reputation unlocks faction-specific quests/items/areas
- [ ] Low reputation can trigger escort quests, bounties
- [ ] Faction war affects NPC locations/availability
- [ ] Exhaustive event logging in Political Log

---

## Implementation Sequence

1. ✓ Create factionEngine.ts with core types & functions
2. ✓ Add Faction fields to WorldState & PlayerState
3. ✓ Update luxfier-world.json with faction data
4. [ ] Add faction ticks to worldEngine.ts advanceTick loop
5. [ ] Update npcEngine.ts dialogue for faction gates
6. [ ] Create FactionPanel.tsx UI component
7. [ ] Update obfuscationEngine.ts for faction logic
8. [ ] Add faction events to actionPipeline.ts
9. [ ] Add faction event handlers to stateRebuilder.ts

---

## Testing Checklist

**Unit Tests:**
- [ ] `calculatePowerShift()` correctly updates scores
- [ ] `calculateFactionTension()` produces reasonable values
- [ ] `checkForFactionConflict()` generates expected conflict types
- [ ] Territory updates work correctly

**Integration Tests:**
- [ ] World initializes with 5 factions
- [ ] Player starts with 0 reputation (neutral)
- [ ] Faction ticks fire every 24 hours
- [ ] Conflicts generate and resolve correctly
- [ ] NPC dialogue gates work
- [ ] Power scores change after events
- [ ] Obfuscation respects faction gates

**Manual Verification:**
- [ ] Quest for faction grants reputation
- [ ] Reputation changes manifest in NPC behavior
- [ ] Faction wars affect location safety
- [ ] Political log shows major events
- [ ] Save/load preserves faction state

---

## Known Limitations & Future Work

- **Faction Defection:** NPCs don't switch sides (Phase 12+)
- **Sub-Factions:** Only top-level factions implemented
- **Economic System:** Basic power scoring; actual trade routes in Phase 13
- **Prophecy/Relic Control:** Relics don't confer faction power yet
- **Player Faction Membership:** Can't formally join factions (Phase 12+)

---

## References

- **Plan 07:** Factions, Politics & Power Graphs
- **Plan 16:** Faction Power Dynamics
- **Plan 06:** Belief Layer & WTOL
- **Phase 10 Implementation:** obfuscationEngine.ts, BeliefLayer
- **Phase 9 Implementation:** magicEngine.ts, spell system
