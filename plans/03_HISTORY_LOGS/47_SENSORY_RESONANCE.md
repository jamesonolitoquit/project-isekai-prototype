# M47: Sensory Resonance (Visualizing the Unseen)

## Milestone Overview

**Status**: Phase A COMPLETE | Phases B-D IN PROGRESS

With **Milestones M44, M45, and M46** providing a simulation that breathes, deceives, and remembers across generations, **M47** refines the **UI/UX feedback** systems so players can *perceive* the invisible narrative threads.

Without M47, the "Belief Layer," "GOAP Goals," and "Social Autonomy" remain hidden operations. With M47, the world *feels* like a mystery waiting to be unraveled.

---

## Architecture Principle

**M47 = Visual Translation of M45-M46**

| Engine (M45-M46) | UI Visualization (M47) |
|------------------|------------------------|
| Belief Engine | Rumor Mill (A1) |
| Legacy Engine | Soul Mirror (A2) |
| WTOL Obfuscation | Perception Glitch (B1) |
| Intent Resolver | Micro-Expression Cues (C1) |
| World Fragments | Chronicle Map (D1) |

Each UI component **consumes** the underlying engine API and makes the abstract concrete.

---

## Phase A: The Cognitive UI ✅ (COMPLETE)

### M47-A1: The Rumor Mill (Journal Panel) ✅

**File**: [RumorMillUI.tsx](../../PROTOTYPE/src/client/components/RumorMillUI.tsx) (445 LOC)

**Purpose**: Display the belief layer visually. Transforms abstract rumors into a tangible "journal of whispers."

**Key Features**:

1. **Rumor Cards** with:
   - Rumor text + location
   - **Confidence Bar** (0-100%) showing how widely believed
   - **Distortion Level** (0-100%) showing how garbled the story is
   - Age indicator (how long ago heard)
   - Source (who told you)

2. **Status Badges**:
   - ✧ FACT ✧ (crystallized rumors = confirmed hard facts)
   - 🔍 INVESTIGATING (linked to investigation quests)
   - Default (active rumor being spread)

3. **Visual Encoding**:
   - Opacity = distortion (higher distortion = blurrier text)
   - Border color = confidence level (gold = highly believed, gray = whispers)
   - Investigation progress bar shows evidence accumulation

4. **Categorization System**:
   - Auto-groups rumors: Deaths & Disappearances, Treasures & Artifacts, Faction & Conflict, Magic & Mysteries, Locations & Routes, Character Rumors
   - Tabs let player browse by category
   - Categories only show if player perception is high enough

5. **Perception Filtering**:
   - Low perception players see fewer rumors
   - High perception players see detailed distortion info
   - Hard facts always visible (crystallized = truth)
   - Debug mode shows confidence thresholds

**UI/UX Insight**: Players now see **what the NPCs believe** vs. **what actually happened**, recreating the core tension of M45-A (belief layer).

---

### M47-A2: The Soul Mirror (Legacy UI) ✅

**File**: [SoulMirrorOverlay.tsx](../../PROTOTYPE/src/client/components/SoulMirrorOverlay.tsx) (520 LOC)

**Purpose**: Visualize inherited Soul Echoes. Turns meta-progression (stat bonuses from ancestors) into a *narrative journey* through generations.

**Key Features**:

1. **Soul Echo Cards** with:
   - Echo name + ancestor name
   - **Rarity tier** (Common → Uncommon → Rare → Legendary)
   - **Power Level** (0-100%) showing strength of connection
   - **Spirit Trace** bar showing bond strength to ancestor (how fresh is the connection?)
   - Generational distance (1, 2, 3+ generations removed)

2. **Ancestral Context**:
   - "The Deed" section shows what the ancestor did
   - **Mechanical Effect**: Game stats/abilities granted
   - **Narrative Effect**: Story flavor justifying the mechanic

3. **Visual Hierarchy**:
   - Legendary echoes: Gold borders + mystical glow
   - Rare echoes: Purple borders
   - Uncommon echoes: Blue borders
   - Common echoes: Gray borders
   - Glow intensity = power level

4. **Ancestral Timeline**:
   - Shows lineage of heroes
   - Generation markers (1, 2, 3+)
   - Myth status for each ancestor
   - Deed count

5. **Progression System**:
   - "Echoes Unlocked: 3/6" progress bar
   - Locked echoes teaser shows remaining slots
   - Encourages player to pursue great deeds

**UI/UX Insight**: Players now see **where their power comes from**—not abstract bonuses, but the legacy of heroes. Makes generational play *feel* meaningful.

---

## Phase B: The Obfuscation Layer 🔄 (IN PROGRESS)

### M47-B1: The Perception Glitch (World HUD)

**Planned File**: `PerceptionGlitchEffect.tsx`

**Purpose**: Visualize WTOL (World Truth Obfuscation Layer) in real-time.

**Concept**:
- When player looks at a location/NPC/item that is a "rumor" (not ground truth), add **CSS shimmer/glitch effect**
- High perception allows player to see **through** the glitched overlay to the truth
- Creates visual feedback: "This might not be real..."

**Implementation Plan**:
1. Query WTOL filter for each visible entity
2. If entity is "rumored" (not confirmed fact):
   - Apply `@keyframes glitch` animation
   - Flicker text between "rumored" and "actual" versions
   - Opacity tied to player perception level
3. Hover to reveal confidence level

**Example**: 
- Location shows as "Mysterious Ruins" (rumor)
- Perception > 70%: Glitch reveals "Old Monastery"
- Perception < 30%: Completely obscured

---

## Phase C: Social Feedback 🔄 (IN PROGRESS)

### M47-C1: Micro-Expression Cues (Dialogue UI)

**Planned File**: `DialogueEnhancedUI.tsx` (extend existing DialogPanel.tsx)

**Purpose**: Visualize intentResolverEngine and GOAP goals during dialogue.

**Concept**:
- During NPC dialogue, display **subtle iconography** showing:
  - NPC's current GOAP goal (wealth icon, faith icon, power icon)
  - Intent resolver "stress level" (how nervous/confident is the NPC?)
  - Emotional state (existing, but enhance)

**Icon System**:
- 💰 Wealth-focused NPC
- ⛪ Faith-focused NPC
- ⚔️ Power-focused NPC
- 💕 Relationship-focused NPC
- 🔍 Discovery-focused NPC
- Intensity of icon = priority of goal

**Stress Level Indicator**:
- Subtle pulsing red border if NPC is stressed
- Green aura if NPC is calm
- Helps player intuit DC difficulty

**Example**:
```
[NPC Name] 💰 (stressed)
"Yes, I'd love to help... *nervous laugh*"
```

---

## Phase D: Spatial Legacy & World Fragments 🔄 (IN PROGRESS)

### M47-D1: The Chronicle Map (Persistent Ruins)

**Planned File**: `ChronicleMapOverlay.tsx`

**Purpose**: Integrate dungeonGenerator (M46-B1) and worldFragmentEngine into the map view.

**Concept**:
- Historical sites, ruins, monuments appear on map as **custom icons**
- Icons based on "Narrative Density" (how much history happened there?)
- Hover to hear legend (pulls from chronicleEngine)
- Click to fast-travel to dungeon entrance

**Icon System**:
- 🏚️ Ruin (weak narrative density)
- ⛩️ Shrine (spiritual significance)
- 🪦 Tomb (undead presence)
- 🗿 Monument (strong lore)
- ⭐ Legend (multiple events)
- 👁️ Sacred (unique/rare)

**Narrative Density Scaling**:
- 1 event: Small icon
- 3+ events: Larger icon
- 10+ events: Glowing icon
- Reflects that old places accumulate stories

**Example**: 
- Hover over "Northern Peak": "Dragon Slayer's Final Battle (50 years ago)"
- Click: Transport to fragment dungeon

---

## File Hygiene Requirements

All M47 files follow the **Mandatory Hygiene Rule**:

✅ **Code Files**: `src/client/components/` and `src/engine/`
✅ **Documentation**: `plans/milestones/`
❌ **NO stray files in project root**

### Current File Locations

```
✅ src/client/components/
  - RumorMillUI.tsx (445 LOC) - M47-A1
  - SoulMirrorOverlay.tsx (520 LOC) - M47-A2
  - (Pending) PerceptionGlitchEffect.tsx - M47-B1
  - (Pending) DialogueEnhancedUI.tsx - M47-C1
  - (Pending) ChronicleMapOverlay.tsx - M47-D1

✅ src/engine/
  - (No new engines for M47 - reuses M45-B/M46-C)

✅ plans/milestones/
  - 47_SENSORY_RESONANCE.md (this file)
```

---

## Integration Points

### RumorMillUI → Belief Engine

```typescript
// In RumorMillUI.tsx
import { getBeliefEngine, type Rumor } from '../../engine/beliefEngine';

// Fetch rumors at player location
const rumors = getBeliefEngine().getRumorsAtLocation(playerLocationId);

// Filter by perception
const accessible = rumors.filter(r => 
  getBeliefEngine().canAccessFact(playerId, r.id, playerPerceptionLevel)
);

// Display with confidence bars
<ConfidenceBar value={rumor.confidence} />
```

### SoulMirrorOverlay → Legacy Engine

```typescript
// In SoulMirrorOverlay.tsx
import { legacyEngine } from '../../engine/legacyEngine';

// Get unlocked echoes for character
const echoes = legacyEngine.calculateUnlockedSoulEchoes(
  character.ancestorDeeds,
  character.mythStatus,
  generationsSince
);

// Display with narrative context
<SoulEchoCard echo={echo} />
```

### PerceptionGlitchEffect → Obfuscation Engine

```typescript
// In PerceptionGlitchEffect.tsx
import { applyWtolToState } from '../../engine/obfuscationEngine';

// Filter state through WTOL
const filtered = applyWtolToState(groundTruth, playerPerception);

// Apply visual glitch if entity is rumored
if (!filtered.accessibleFacts.includes(entityId)) {
  return <GlitchEffect rumor={filtered.rumoredFacts[entityId]} />;
}
```

---

## Design Principles for M47

1. **Aesthetic Consistency**: All UI should feel "mystical" with mystical symbols (✧ ◇ ☆ ◆)
2. **Progressive Disclosure**: Hide complexity from new players, reveal to experienced
3. **Visual Metaphor**: Rumors = hazy/distorted, Facts = clear/solid
4. **Agency Visibility**: Show what NPCs care about (goals) without breaking immersion
5. **Generational Narrative**: Make ancestry feel like active story, not passive bonus
6. **Glitch as Truth**: Visual artifacts = "something's wrong with my perception"

---

## Expected Player Experience

### Before M47 (Hidden Systems)
- Player increases perception stat
- Nothing visible changes
- Belief layer is invisible math

### After M47 (Visualized Systems)
- Player opens Rumor Mill
- Sees rumors + confidence bars
- Realizes: "Half the world believes false things!"
- Investigates rumors to find truth
- Opens Soul Mirror
- Sees: "I inherited Dragon Slayer power from my grandmother!"
- Feels generational connection
- Talks to NPC, sees: 💰 (greedy goal) + ⚔️ (warrior skill)
- Understands: "This merchant wants wealth—I can intimidate them"
- Looks at map, clicks on old ruin
- Sees: "Here, 3 ancient battles were fought..."
- Explores dungeon with thematic enemies

**This is emergence**: Player goes from passive observer to active investigator of a *belief-rich* world.

---

## Success Criteria

✅ M47-A1: RumorMillUI displays rumors with confidence/distortion bars
✅ M47-A2: SoulMirrorOverlay shows soul echoes with ancestral context
🔄 M47-B1: Perception glitch effect applied to world entities
🔄 M47-C1: NPC goal icons + stress indicators in dialogue
🔄 M47-D1: Chronicle map with fragment dungeon icons

---

## Session Roadmap

**Current**: M47-A (Cognitive UI) ✅ **Complete**
**Next**: M47-B (Obfuscation Layer Visualization)
**Then**: M47-C (Social Feedback Enhancement)
**Final**: M47-D (Spatial Integration)

---

## Next Steps

1. **Test M47-A1**: RumorMillUI integration with mock data
2. **Test M47-A2**: SoulMirrorOverlay display in character screen
3. **Begin M47-B1**: Perception glitch shader effects
4. **Extend DialogPanel.tsx**: Add GOAP goal icons + stress levels
5. **Create ChronicleMapOverlay**: Integrate fragment dungeons

---

*Milestone M47 Phase A: Complete* ✅
*Status: Ready for Phase B implementation*
