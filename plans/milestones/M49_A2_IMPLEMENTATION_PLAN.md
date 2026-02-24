# M49-A2: Rumor Investigation Pipeline - Implementation Plan

**Phase**: M49 Alpha Phase 2 | **Status**: PLANNED | **Priority**: HIGH
**Prerequisite**: M49-A1 (Faction Territory Sovereignty) ✅ COMPLETE

## Overview

**M49-A2** implements a **Rumor Investigation System** that brings dynamic storytelling to the living world. NPCs actively disseminate rumors about faction territorial changes, political intrigue, and world events. Players engage in investigation quests that culminate in crystallized rumors - persistent narrative artifacts that shape faction relationships and world perception.

### Design Philosophy

"Rumors are the currency of influence. What players believe shapes the world as much as what actually happened."

- **NPCs as Storytellers**: Faction members gossip about territory control changes
- **Investigative Gameplay**: Player follows rumors to truth or conspiracy
- **Crystallization**: Rumors become persistent world artifacts affecting reputation
- **Cascading Effects**: One resolved rumor triggers others, creating narrative chains

## High-Level Architecture

```
NPC Rumor Generation
  ├─ Territory Control Events (from M49-A1)
  ├─ Faction Reputation Changes
  ├─ Time-based Rumor Decay
  └─ Player Action Triggers

    ↓

Rumor Dissemination
  ├─ NPC Dialogue Hooks
  ├─ Faction-specific Rumors
  ├─ Location-based Rumors
  └─ Time Window Tracking

    ↓

Investigation Phase
  ├─ Player Collects Evidence
  ├─ NPC Interview Quests
  ├─ Evidence Cross-referencing
  └─ Truth vs Deception Tracking

    ↓

Crystallization
  ├─ Rumor Resolution
  ├─ Reputation Impact Calculation
  ├─ World State Updates
  └─ Persistent Artifact Creation
```

## System Components

### 1. Rumor Engine (`rumorEngine.ts` - NEW)

**Core Data Structures**:

```typescript
export interface Rumor {
  id: string;                    // Unique rumor identifier
  title: string;                 // "The Silver Flame Seizes Moonwell"
  narrative: string;             // Full rumor text
  factionId: string;             // Source faction
  affectedLocationId: string;    // Location involved
  createdAt: number;             // Creation tick
  expiresAt: number;             // Auto-expire ASAP-if-not-investigated
  type: 'territory_claim' | 'alliance' | 'betrayal' | 'treasure' | 'curse';
  authenticity: number;          // 0-100: How true is this rumor?
  propagationCells: string[];    // NPC IDs spreading this rumor
  evidence: {
    npcId: string;              // Witness/source
    description: string;
    weight: -50 to 50;          // -50: Contradicts, 0: Neutral, 50: Confirms
  }[];
  investigationStatus: 'unheard' | 'spreading' | 'investigating' | 'crystallized';
  resolution?: {
    resolved: boolean;
    truthfulness: number;       // Final authenticity after investigation
    reputationImpact: Record<string, number>;  // Faction reputation changes
  };
}

export interface CrystallizedRumor extends Rumor {
  investigationStatus: 'crystallized';
  resolution: Required<Rumor['resolution']>;
  persistenceLevel: number;     // 0-100: How long does this remain in world?
  worldImpact: string;          // Description of how world changed
}
```

**Key Functions**:

```typescript
// Generate new rumor from territory event
export function generateTerritoryRumor(
  state: WorldState,
  territory: string,
  faction: Faction,
  eventType: 'control_gained' | 'control_lost' | 'contested'
): Rumor

// Get active rumors available to player
export function getAvailableRumors(
  state: WorldState,
  playerLocationId: string
): Rumor[]

// Add evidence to rumor investigation
export function addRumorEvidence(
  rumor: Rumor,
  npcId: string,
  evidence: string,
  weight: number
): void

// Crystallize rumor with resolution
export function crystallizeRumor(
  state: WorldState,
  rumor: Rumor,
  playerTruthfulness: number  // 0-100: How well did player determine truth?
): CrystallizedRumor

// Calculate reputation impact from rumor
export function calculateRumorReputationImpact(
  rumor: CrystallizedRumor,
  factionId: string
): number
```

### 2. NPC Rumor Integration

**Modifications to `npcEngine.ts`**:

```typescript
// New NPC properties
interface NPC {
  // ... existing properties ...
  rumors?: string[];           // Array of rumor IDs this NPC knows
  rumorCooldown?: number;      // Ticks until NPC will discuss rumors again
  gossipFrequency?: number;    // 0-100: How chatty is this NPC?
  facitality?: number;         // 0-100: How likely to lie?
}

// New dialogue generation
export function generateRumorDialogue(
  npc: NPC,
  playState: WorldState,
  rumor: Rumor
): DialogueOption[]

// Check if NPC will gossip
export function shouldNpcGossip(npc: NPC, state: WorldState): boolean

// Get rumor from NPC conversation
export function extractRumorFromDialogue(
  npc: NPC,
  choiceId: string
): Rumor | null
```

### 3. Investigation Quest System

**New quest type in questEngine (if exists) or actionPipeline**:

```typescript
// Investigation action type
case 'INVESTIGATE_RUMOR': {
  const rumorId = action.payload?.rumorId;
  const npcId = action.payload?.npcId;      // NPC to interview
  
  // 1. Find rumor in world state
  // 2. Get NPC evidence
  // 3. Calculate evidence credibility
  // 4. Update investigation progress
  // 5. Emit RUMOR_EVIDENCE_GATHERED or RUMOR_CONTRADICTION events
}

// Evidence verification
export function verifyRumorEvidence(
  state: WorldState,
  rumor: Rumor,
  npcId: string
): {
  isReliable: boolean;
  credibility: number;
  contradiction?: string;
}

// Investigation completion check
export function isRumorInvestigationComplete(rumor: Rumor): boolean
```

### 4. Rumor UI Components

**New Component**: `RumorBoard.tsx`

```tsx
interface RumorBoardProps {
  rumors: Rumor[];
  onSelectRumor: (rumorId: string) => void;
  playerReputation: Record<string, number>;
}

// Displays:
// - Active rumors in player location
// - Investigation progress bars
// - Faction associations
// - Time to expiration
// - Evidence count
```

**Modified Component**: `NPC Dialogue System`

```tsx
// Add rumor disclosure option in dialogue tree
// "What have you heard about...?"
//   - Triggers RUMOR_HEARD event
//   - Adds rumor to player's knowledge
//   - NPC gossip cooldown triggered
```

## Implementation Flow

### Phase 1: Rumor Generation (Days 1-2)

1. Create `rumorEngine.ts` with core data structures
2. Implement `generateTerritoryRumor()` function
3. Wire territory events (from M49-A1) to rumor generation
4. Create sample rumor templates for each faction

**Example Territory Rumor**:
```
Territory: "moonwell-shrine" got conquered by "silver-flame"
Generated Rumor:
  title: "The Silver Flame's Divine Ascendancy"
  narrative: "Rumors speak of a miraculous conquest..."
  type: 'territory_claim'
  authenticity: 85  // High because it's true
  propagationCells: [npc_mystic, npc_elder]
```

### Phase 2: NPC Integration (Days 2-3)

1. Modify `npcEngine.ts` to include rumor knowledge
2. Update NPC dialogue generation with gossip options
3. Implement `generateRumorDialogue()` function
4. Create NPC rumor cooldown mechanics

**Example NPC Dialogue**:
```
Player: "What's new in the lands?"
NPC: "Have you heard? The Silver Flame
      has seized control of Moonwell Shrine!
      Some say it was divine will..."

Player Options:
  → "Tell me more about this conquest"
  → "Why would they want that shrine?"
  → "I don't believe you"
```

### Phase 3: Investigation System (Days 3-5)

1. Create `INVESTIGATE_RUMOR` action type in actionPipeline
2. Implement evidence collection mechanics
3. Add credibility verification for NPC testimony
4. Create investigation progress tracking

**Investigation Flow**:
```
Player discovers rumor from NPC1
  ↓
Player: "INVESTIGATE_RUMOR" with NPC2 as evidence source
  ↓
NPC2: "Yes, I saw them march toward the shrine"
  → Weight: +30 (moderately reliable source)
  ↓
Player: "INVESTIGATE_RUMOR" with NPC3 (contradicting source)
  ↓
NPC3: "No, they were at Forge Summit that day!"
  → Weight: -25 (contradicts prior evidence)
  ↓
Investigation shows: 60% authenticity
  (Player must decide: trust or distrust)
```

### Phase 4: Crystallization (Days 5-6)

1. Implement `crystallizeRumor()` function
2. Calculate reputation impacts
3. Create CrystallizedRumor artifacts in world state
4. Wire to world state persistence

**Crystallization Example**:
```
Player resolves mystery about silver-flame conquest:
  - Rumor authenticity: 75%
  
Crystallized:
  - silver-flame reputation +15 (true conquest)
  - moonwell-shrine location flagged (silver-flame control)
  - CrystallizedRumor artifact created (persistent)
  - worldImpact: "The Silver Flame's claim over
    Moonwell Shrine strengthened public perception"
  - persistenceLevel: 90 (will affect perception for ~18 days)
```

### Phase 5: UI & Polish (Days 6-7)

1. Create `RumorBoard.tsx` component
2. Add rumor display to NPC dialogue
3. Create investigation progress UI
4. Add sound/visual feedback for rumor events

**UI Elements**:
- Rumor board showing active rumors
- Investigation progress bar
- Evidence counter
- Source credibility indicator
- Crystallization animation

## Integration Points

### With M49-A1 (Faction Territory Sovereignty)

```typescript
// When territory event triggered:
if (event.type === 'TERRITORY_ENTERED') {
  const rumor = generateTerritoryRumor(
    state,
    event.locationId,
    controllingFaction,
    'control_gained'
  );
  state.activeRumors.push(rumor);
  spreadRumorToNpcs(state, rumor);
}
```

### With Faction Engine

```typescript
// Crystallized rumors affect faction relationships
if (rumor.resolution) {
  for (const [factionId, impact] of 
       Object.entries(rumor.resolution.reputationImpact)) {
    state.player.factionReputation[factionId] += impact;
  }
}
```

### With NPC Engine

```typescript
// NPC dialogue includes rumor options
if (npc.rumors?.length) {
  for (const rumorId of npc.rumors) {
    const rumor = state.activeRumors.find(r => r.id === rumorId);
    if (rumor) {
      addDialogueOption(npc, `"${rumor.title}"...`);
    }
  }
}
```

### With Event System

**New Event Types**:
```typescript
'RUMOR_HEARD'              // Player learns of rumor
'RUMOR_EVIDENCE_GATHERED'  // Evidence collected
'RUMOR_CONTRADICTION'      // Evidence contradicts
'RUMOR_CRYSTALLIZED'       // Rumor resolved
'RUMOR_EXPIRED'            // Rumor forgotten
```

## Rumor Types & Templates

### Type 1: Territory Claims (40% of rumors)
```
"[Faction] seizes control of [Location]"
- High initial authenticity if true event occurred
- Spreads among rival factions quickly
- Can be disproven if false claim
```

### Type 2: Alliance Pacts (20% of rumors)
```
"[Faction1] and [Faction2] have formed alliance"
- Creates political intrigue
- Affects faction behavior for investigation duration
- May be completely fabricated
```

### Type 3: Betrayals (20% of rumors)
```
"[NPC] betrayed [Faction] to [Rival Faction]"
- Personal stakes for investigation
- High variation in authenticity
- NPC dialogue changes based on rumor status
```

### Type 4: Treasure Locations (15% of rumors)
```
"A hidden cache was found at [Location]"
- Leads to treasure hunt quests
- Map clues from investigation evidence
- Links to world fragment system
```

### Type 5: Mystical Curses (5% of rumors)
```
"[Location] is cursed by [Faction]'s dark rituals"
- Environmental effects if believed
- Affects player perception of location
- Investigation leads to curse breaking quests
```

## Reputation Impact System

```typescript
// Reputation multipliers based on investigation outcome:

Rumor authenticity CONFIRMED (>80%):
  → Faction involved: +20 reputation
  → Rival factions: -10 reputation
  → Neutral factions: 0

Rumor authenticity DISPUTED (40-80%):
  → Faction involved: +5 reputation
  → Rival factions: -5 reputation
  → Investigation success: Player reputation +10

Rumor authenticity DEBUNKED (<40%):
  → Originating faction: -20 reputation
  → Truth-revealer: +10 reputation
  → Rival factions: +5 reputation
```

## Performance Considerations

- **Rumor Storage**: Store only active + recently crystallized rumors
- **NPC Gossip Cooldown**: Prevent rumor spam (minimum 120 ticks between gossip)
- **Investigation Timeout**: Auto-expire unexamined rumors after 480 ticks
- **Evidence Lookup**: Cache evidence credibility calculations

## Testing Framework

**Unit Tests**:
- Rumor generation from territory events
- Evidence weight calculations
- Reputation impact determination
- Crystallization logic

**Integration Tests**:
- NPC dialogue includes rumors
- Investigation progression
- Reputation changes affect future rumors
- Crystallized rumors persist

**User Tests**:
- Rumor board UI clarity
- Investigation flow intuitive
- Outcome feel impactful
- No performance drops during rumors

## Success Criteria

✅ Rumors automatically generated from territory events
✅ NPCs discuss rumors in dialogue
✅ Investigation quests completable
✅ Reputation changes observable after crystallization
✅ UI clearly shows rumor status
✅ Zero TypeScript errors
✅ Performance: <5ms rumor lookup overhead

## Estimated Timeline

| Phase | Component | Est. Time | Dependencies |
|-------|-----------|-----------|--------------|
| 1 | rumorEngine.ts | 4-6 hours | None |
| 2 | NPC Integration | 4-6 hours | rumorEngine |
| 3 | Investigation System | 6-8 hours | rumorEngine + NPC |
| 4 | Crystallization | 4-6 hours | Investigation |
| 5 | UI Components | 4-6 hours | All above |
| 6 | Testing & Polish | 4-6 hours | All systems |

**Total Estimated Duration**: 26-38 hours (3-4 days)

## Risk Mitigation

**Risk**: Rumors spread too fast, UI overwhelmed
**Mitigation**: Implement NPC gossip cooldown (120 ticks minimum between spread)

**Risk**: Investigation feels tedious
**Mitigation**: Keep quests short (1-3 NPC interviews), auto-expire after 480 ticks

**Risk**: Reputation changes unpredictable
**Mitigation**: Show calculation breakdown, log all reputation deltas

**Risk**: Performance impact from active rumors
**Mitigation**: Limit active rumors to 5-10, cache evidence lookups

## Next Steps

1. ✅ M49-A1 complete and tested
2. → Create `rumorEngine.ts` with core functions
3. → Integrate with existing NPC dialogue hooks
4. → Implement investigation action type
5. → Build UI components
6. → Full testing & deployment

---

**M49-A2 Status**: Ready for implementation phase
**Depends On**: M49-A1 ✅
**Leads To**: M49-A3 (GOAP Autonomous Scheduling)
