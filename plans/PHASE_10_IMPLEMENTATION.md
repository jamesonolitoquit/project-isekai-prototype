# Phase 10: The Veil of Belief - Implementation Summary

## Overview
Phase 10 implements the **World Truth Obfuscation Layer (WTOL)** - an information filtering system that masks player knowledge to prevent metagaming while maintaining deterministic game simulation.

## Core Mechanics

### 1. Information Masking (`obfuscationEngine.ts`)
- **filterStateForPlayer()**: Main function that converts raw game state to player-visible state
- **NPC Masking**: Unknown NPCs display as "??? (Unknown)" until identified
- **Health Descriptions**: NPC health shown as vague descriptions ("Healthy", "Wounded", "Near Death") instead of exact numbers
- **getMaskedHealthStatus()**: Returns "?" for unidentified entities
- **Belief Layer**: Tracks false NPC locations and suspicion level for metagaming detection

### 2. Knowledge Tracking
- **knowledgeBase**: Set<string> tracking discovered entities (npc:ID, item:ID, location:ID)
- **visitedLocations**: Set<string> tracking places player has physically visited
- **beliefLayer**: Tracks player suspicions, false beliefs, and facts learned

### 3. Identification Spells
- **Identify** (15 mana, INT 6): Reveals single target NPC's true name and stats
- **True Sight** (50 mana, INT 12): Reveals all entities for 3 turns, pierces deception
- Both spells trigger TRUTH_REVEALED and NPC_IDENTIFIED events

### 4. Metagame Validation (`validateMetagaming()` in actionPipeline.ts)
Detects suspicious player actions:
- **Moving to undiscovered locations**: Flags as suspicious
- **Interacting with unknown NPCs**: Triggers suspicion event
- **Casting spells on revealed targets before discovering them**: Penalizes suspicion
- **Suspicion accumulation**: Each violation adds 10 suspicion points
- **DM Interference**: At 30+ suspicion, triggers META_SUSPICION event for environmental consequences

## Implementation Details

### State Changes
- **PlayerState**: Added optional knowledgeBase, visitedLocations, beliefLayer fields
- **PlayerCharacter**: Initialize with knowledge/belief system data at character creation
- **Event Types**: New events - TRUTH_REVEALED, NPC_IDENTIFIED, IDENTIFY_FAILED, META_SUSPICION, SPELL_CAST, MANA_DRAINED

### State Rebuilder Updates (`stateRebuilder.ts`)
Added event handlers for:
- **SPELL_CAST**: Apply damage/healing/status effects from spell resolution
- **SPELL_CAST_FAILED**: Log spell failure
- **MANA_DRAINED**: Update player mana from spirit density drain
- **DRAIN_MANA_FAILED**: Log drain failure
- **TRUTH_REVEALED**: Add entity to knowledgeBase
- **NPC_IDENTIFIED**: Add NPC to knowledgeBase with stats revealed
- **IDENTIFY_FAILED**: Track failed identification
- **META_SUSPICION**: Update player suspicion level
- **PLAYER_REST**: Added mana restoration (25% per hour rest)

### UI Component Updates
- **CombatArena.tsx**: Mask unknown NPC names, show health as descriptions
- **DialogPanel.tsx**: Hide NPC identities until discovered
- **Codex.tsx**: NEW - Knowledge tracker showing discovered entities, knowledge base progress

## Gameplay Flow

### Discovery Process
1. Player encounters NPC in world → Displayed as "??? (Unknown)"
2. Player casts IDENTIFY spell (15 mana) → NPC_IDENTIFIED event
3. NPC added to knowledgeBase → True name and stats revealed
4. Codex updates with new discovery

### Metagaming Prevention
1. Player tries to target hidden NPC in combat
2. Suspicion +10 event triggered
3. At 30+ suspicion, META_SUSPICION event fires
4. DM interference: Environmental anomaly or hostile manifestation
5. Player must play legitimately to avoid interference

### Location Discovery
- Player moves to new location → visitedLocations updated
- Unknown locations cannot be navigated to without discovery
- Codex shows visited vs unvisited locations

## Files Created/Modified

### New Files
- `src/engine/obfuscationEngine.ts` (400+ lines)
- `src/client/components/Codex.tsx` (300+ lines)

### Modified Files
- `src/engine/worldEngine.ts` - Added BeliefLayer type, updated PlayerState
- `src/engine/characterCreation.ts` - Added knowledge/belief initialization
- `src/engine/actionPipeline.ts` - Added validateMetagaming(), REVEAL_TRUTH, IDENTIFY, META_SUSPICION handling
- `src/engine/stateRebuilder.ts` - Added 8+ event handlers for Phase 10
- `src/client/components/CombatArena.tsx` - Added NPC name masking
- `src/client/components/DialogPanel.tsx` - Added NPC identity masking
- `src/data/spells.json` - Added Identify and True Sight spells

## Integration Points

### With Phase 9 (Magic System)
- Identification spells use magic cost system (mana, INT requirements)
- Spell resolution integrates with WTOL through filtered targeting
- Spell events properly update knowledgeBase through stateRebuilder

### With Combat System
- Unknown enemies show masked names in CombatArena
- Spell targeting triggers metagame validation
- Spell damage/healing properly applied to NPC state

### With Dialogue System
- NPC names masked in DialogPanel until identified
- Dialogue responses can be conditioned on knowledgeBase membership
- Reputation tracking independent from NPC identity

## Validation & Testing

### Compilation
✓ TypeScript build successful with all type safety
✓ No errors in stateRebuilder.ts event handling
✓ No errors in UI components
✓ Production build completes successfully

### Logic
✓ Metagame validation catches suspicious patterns
✓ Suspicion accumulation and thresholds working
✓ Knowledge base properly tracks discoveries
✓ Spell identification triggers proper events

## Next Steps (Future Phases)
- NPC behavior responds to beliefLayer suspicion
- Dynamic dialogue changes based on knowledgeBase
- Consequences for high suspicion (NPCs become hostile, paths blocked)
- Item identification system similar to NPC identification
- Codex expansion with lore entries discovered through dialogue
- Achievement system for discovering all entities
