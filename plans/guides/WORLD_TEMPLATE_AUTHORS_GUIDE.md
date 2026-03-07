# Luxfier Alpha: World Template Authoring Guide (v2.0)

> **Status:** ACTIVE  
> **Category:** GUIDE  
> **Version:** 2.0 (Milestones M44-M46 Integrated)  
> **Updated:** February 17, 2026  
> **Scope:** Belief Layer, GOAP Autonomy, Soul Echoes, World Persistence, Investigation Pipeline

---

This is the comprehensive authoring guide for world architects building Luxfier templates. Templates encode narrative systems, simulation layers, and generational legacy across multiple engine subsystems. This v2.0 guide incorporates:

- **M44 Simulation** (Warfare, Weather, Economy, Macro Events)
- **M45 Narrative** (Belief Layer, Intent Resolver, Obfuscation, Whispers, Legacy)
- **M46 Proceduralism** (GOAP Autonomy, Quest Synthesis, Investigations, Dungeons, Social)
- **M47 Sensory Resonance** (UI Visualization of narrative systems)

Templates are written in JSON and must adhere to the `luxfier-world.schema.json` validation. This guide explains *why* each field matters and how to leverage deep systems for authorship.

---

## Table of Contents

1. [World Identity & Fundamentals](#1-world-identity--fundamentals)
2. [Geography & Location Design](#2-geography--location-design)
3. [NPCs & Character Design (AI DM Integration)](#3-npcs--character-design-ai-dm-integration)
4. [The Belief Layer: Hard Facts & Rumors](#4-the-belief-layer-hard-facts--rumors)
5. [NPCs & GOAP Personality (M46-C1)](#5-npcs--goap-personality-m46-c1)
6. [NPC Social Autonomy (M46-C2)](#6-npc-social-autonomy-m46-c2)
7. [Soul Echoes & Legacy Catalog (M45-C1)](#7-soul-echoes--legacy-catalog-m45-c1)
8. [Economic Faction Modifiers (M44-D2)](#8-economic-faction-modifiers-m44-d2)
9. [Causal Weather Rule Logic (M44-D1)](#9-causal-weather-rule-logic-m44-d1)
10. [World Fragment Persistence (M43-A4)](#10-world-fragment-persistence-m43-a4)
11. [Investigation Pipeline Setup (M46-A2)](#11-investigation-pipeline-setup-m46-a2)
12. [Quest Construction & Synthesis](#12-quest-construction--synthesis)
13. [Faction Warfare & Territorial Control](#13-faction-warfare--territorial-control)
14. [Multi-Generation Chronicle Epochs](#14-multi-generation-chronicle-epochs)
15. [Module & Version Identification](#15-module--version-identification)
16. [Localization Patterns](#16-localization-patterns)
17. [Performance Guardrails](#17-performance-guardrails)
18. [Boilerplate Template](#18-boilerplate-template)

---

## 1. World Identity & Fundamentals

Every world starts with its basic identity and starting conditions.

| Property | Type | Description |
| :--- | :--- | :--- |
| `name` | String | The official title of the world/module. Must be unique across all templates. |
| `description` | String | A high-level narrative overview (visible to players and in chronicle). |
| `version` | String | Semantic version of the template (e.g., `"2.0"`). Used for upgrade detection. |
| `season` | Enum | The starting season: `winter`, `spring`, `summer`, `autumn`. Drives initial weather. |
| `multiEpochEnabled` | Boolean | If `true`, allows template to persist across player deaths with legacy systems. Default: `false`. |
| `baseEpoch` | String | The epoch ID this template uses as default (e.g., `"epoch_i_fracture"`). Links to Chronicle sequence. |

### Example:
```json
{
  "name": "Luxfier Alpha Prototype",
  "description": "A nascent world where magic stirs and factions vie for control.",
  "version": "2.0",
  "season": "spring",
  "multiEpochEnabled": true,
  "baseEpoch": "epoch_i_fracture"
}
```

---

## 2. Geography & Location Design

Locations define the physical stage and environmental context. They drive NPC routines, quest objectives, particle effects, and faction influence.

### Core Location Properties

| Property | Type | Purpose |
| :--- | :--- | :--- |
| `id` | String | Unique identifier (e.g., `eldergrove-village`). Used in NPC routines, quests, travel matrix. |
| `name` | String | Display name for players. |
| `spiritDensity` | Number (0-1) | Intensity of environmental particle effects (fog, embers, spiritual shimmer). Higher = more visual complexity. |
| `biome` | String | `forest`, `cave`, `village`, `corrupted`, `shrine`, `maritime`, `mountain`, `plains`, `dungeon`. Affects weather applicability and visuals. |
| `conditionalSeason` | String (optional) | If set, location only appears/changes during specific season (e.g., `"winter"` for frozen lake). |
| `description` | String | Flavor text NPCs might reference. Seen by Al DM during roleplay. |
| `environmentalEffects` | Array | Status effects or modifiers: `["reduced_hearing", "spirit_amplification", "corrupted_mana", "peaceful_aura"]`. |

### Sub-Areas (Hidden Depths)

Locations can nest `subAreas` to represent exploration and discovery:

```json
{
  "id": "thornwood-depths",
  "name": "Thornwood Depths",
  "subAreas": [
    {
      "id": "thorns-inner-sanctum",
      "name": "Inner Sanctum",
      "difficulty": 15,
      "discoveryReward": 50,
      "environmentalEffects": ["spirit_amplification"],
      "description": "A hidden chamber where ancient spirits linger."
    }
  ]
}
```

- **`difficulty`** (DC 10-25): Perception check to discover. Higher = more hidden.
- **`discoveryReward`**: XP bonus when first discovered.
- **`description`**: Flavor when entering.

---

## 3. NPCs & Character Design (AI DM Integration)

NPCs are the heart of Luxfier's reactivity. Instead of scripted dialogue, the AI DM uses a "Mental Blueprint" to roleplay characters dynamically.

### A. Core NPC Identity

| Property | Type | Purpose |
| :--- | :--- | :--- |
| `id` | String | Unique NPC identifier (e.g., `brother-theron`). |
| `name` | String | Display name. |
| `locationId` | String | Primary location where NPC is often found. |
| `factionId` | String | Which faction does this NPC represent? |
| `factionRole` | String | `leader`, `soldier`, `merchant`, `civilian`, `outsider`. Affects how other faction NPCs treat them. |

### B. Persona & Voice (M45-B2: Narrative Layer)

The AI DM uses these fields to understand and roleplay the character:

```json
{
  "persona": "A bitter veteran of the Silver War who just wants to protect his tavern but sees darkness rising.",
  "quirks": [
    "refers to himself in the third person when nervous",
    "constantly cleaning a glass or polishing a blade",
    "winks when lying or being strategic"
  ],
  "voiceDescriptor": "Low, gravelly, with a heavy West-Isle accent. Speaks in fragments when stressed.",
  "emotionalTone": "Weary but principled. Protective toward those he trusts."
}
```

**Why it matters:** The AI DM injects these descriptors into its prompt, ensuring consistent character portrayal across dialogue. Higher detail = more consistent roleplay.

### C. Routine (24-Hour Clock)

NPCs follow schedules to populate locations naturally:

```json
{
  "routine": {
    "6-12": "eldergrove-village",
    "12-18": "moonwell-shrine",
    "18-20": "eldergrove-village",
    "20-6": "home-location"
  }
}
```

- Hours are 0-23 (24-hour format).
- Must have `travelMatrix` entry between locations (cost in ticks).
- If not in routine, NPC is unavailable (e.g., sleeping).

### D. Emotional State (M45-B1: Resonance Metrics)

NPCs have emotional metrics (0-100) that evolve and gate dialogue:

```json
{
  "emotionalState": {
    "trust": 50,      // Unlocks rare dialogue; affects prices
    "fear": 10,       // Causes fleeing; increases healing costs
    "gratitude": 0,   // Earned via quests; prevents resentment decay
    "resentment": 0   // Triggers bounty hunters if high
  }
}
```

- **`trust` > 70**: NPC gives discounts, shares secrets, offers rare quests.
- **`fear` > 70**: NPC flees or demands payment to interact.
- **`resentment` > 80**: NPC may refuse service or attack.

### E. Availability & Rep Gates

```json
{
  "availability": {
    "startHour": 6,
    "endHour": 20,
    "requiresReputation": 0,          // Faction reputation needed to talk (-100 to +100)
    "requiresQuestStatus": "herbs-for-the-healer"  // Must have quest enabled
  }
}
```

### F. Dialogue Variations (Context-Aware Responses)

NPCs respond differently to weather, season, quest states, and time of day:

```json
{
  "dialogueVariations": {
    "default": [
      "Welcome, traveler.",
      "What brings you to our village?"
    ],
    "rain": [
      "Stay dry, friend! The rains can be treacherous.",
      "Perfect weather for tending the medicinal herbs."
    ],
    "winter": [
      "The season of rest and reflection is upon us.",
      "Many come seeking warmth in winter."
    ],
    "quest_completed_herbs-for-the-healer": [
      "Thanks again for those herbs. They're already helping the village.",
      "Your gathering effort saved many lives."
    ]
  }
}
```

**Priority order:** quest completion → weather → season → default.

---

## 4. The Belief Layer: Hard Facts & Rumors (M45-A1)

The Belief Layer separates "truth" from "distorted perception." NPCs share rumors that degrade with distance and faction bias. Players discover hard facts through investigation.

### A. Hard Facts Registry (`hardFacts`)

Hard facts are events that actually occurred in the world. Define them in the template to seed the belief layer:

```json
{
  "hardFacts": [
    {
      "id": "fact-king-death",
      "eventType": "death",
      "description": "The King fell to a poisoned blade during the Grand Feast.",
      "originLocationId": "luminara-grand-market",
      "originEpochTick": 0,
      "factionIds": ["silver-flame", "luminara-mercantile"],
      "severity": 85,
      "truthRadius": 500,
      "truthDecayRate": 0.2,
      "timestamp": 0
    }
  ]
}
```

| Field | Purpose |
| :--- | :--- |
| `eventType` | Categorizes the fact: `death`, `siege`, `miracle`, `catastrophe`, `discovery`, `treaty`, `betrayal`. |
| `severity` | 0-100. Higher = spreads faster as rumors, more NPC memory. |
| `truthRadius` | Distance (in game units) from origin where 100% accurate rumors spread. Beyond this, noise increases. |
| `truthDecayRate` | How quickly confidence drops with distance (0-1). Higher = faster degradation. |

**How it works:**
1. When a hard fact is recorded, the Belief Engine automatically creates 3 rumor "rings":
   - **Inner ring** (80% confidence): ~truthRadius
   - **Middle ring** (40% confidence): ~truthRadius × 1.5
   - **Outer ring** (10% confidence): ~truthRadius × 2

2. Distant NPCs hear corrupted versions with location/faction distortion.
3. Players investigate rumors to confirm hard facts (via Investigation Pipeline).

### B. Rumor Distortion Mechanics

When NPCs retell stories, randomized noise is added:

- **Word Scrambling**: "The King fell" → "Ze Kning fawl"
- **Location Distortion**: Actual fate at Castle Blue → "Somewhere in the mountains"
- **Faction Confusion**: Silver Flame involved → "Shadow Conclave arranged it"

This is **automatic** based on distance and faction bias. Authors don't need to script each rumor.

### C. Seeding Rumors Directly (`rumors`)

For immediate narrative stakes, you can pre-seed rumors:

```json
{
  "rumors": [
    {
      "id": "rumor-dragon-sighting",
      "originalFactId": "fact-dragon-awakened",
      "description": "A great dragon has awakened in the northern peaks.",
      "claimedLocationId": "frozen-lake",
      "claimedFactionIds": ["shadow-conclave"],
      "confidenceLevel": 45,
      "distanceFromOrigin": 200,
      "factionRelevance": 0.6,
      "createdAt": 100,
      "spreadsToLocations": ["eldergrove-village", "luminara-grand-market"],
      "sourceNpcIds": ["brother-theron", "smitty-ironhammer"]
    }
  ]
}
```

---

## 5. NPCs & GOAP Personality (M46-C1)

**GOAP = Goal-Oriented Action Planning.** NPCs have autonomous goals that drive their behavior. Instead of scripted routines, NPCs pursue goals using available actions.

### A. Personality Weights

Each NPC has 6 personality traits (0-100 scale) that influence which goals they prioritize and how they react in combat.

#### GOAP Traits (M46-C1)
These 6 dimensions drive the autonomous planning engine:

```json
{
  "personality": {
    "boldness": 30,        // willingness to take risks
    "caution": 70,         // tendency to avoid danger
    "sociability": 20,     // preference for interaction
    "ambition": 40,        // drive for power/status
    "curiosity": 60,       // desire to explore/learn
    "honesty": 90          // adherence to truth/ethics
  }
}
```

#### Combat Archetypes (`type`)
In addition to GOAP traits, a `type` can be assigned to simplify combat-only logic:

- **`aggressive`**: Continues attacking until 30% HP.
- **`cautious`**: Retreats or starts defending at 60% HP.
- **`tactical`**: Alternates between defense and offense based on opponent stats.
- **`healer`**: Prioritizes supporting allies once their HP drops below 50%.
- **`balanced`**: Standard behavior with moderate thresholds.

**How it works:**
- If `ambition > 40` → NPC gets a **Power Goal** (recruit allies, gain influence)
- If `sociability > 50` → NPC gets a **Relationship Goal** (befriend other NPCs)
- If `caution > 60` → NPC will likely choose `DEFEND` even with moderate HP in combat.

### B. Goal Priorities

Each goal has a `priority` (0-100) and `weight`:

```json
{
  "goals": [
    {
      "type": "wealth",
      "priority": 80,
      "weight": 0.8,      // Greedy NPC cares a lot
      "targetValue": 1000,
      "currentValue": 100
    },
    {
      "type": "faith",
      "priority": 30,
      "weight": 0.3,
      "targetValue": 100,
      "currentValue": 20
    }
  ]
}
```

### C. Available Actions

NPCs use actions to achieve goals. Actions have:

- **Preconditions** (e.g., needs 100+ gold to trade)
- **Effects** (e.g., +50 gold, +20 faith)
- **Probability** (0-1 success chance)
- **Tick Cost** (how long execution takes)

**Standard Actions Library:**
| Action | Goal | Cost | Effect |
| :--- | :--- | :--- | :--- |
| `trade` | wealth | 100 ticks | +50 gold (80% success) |
| `preach` | faith | 200 ticks | +30 faith (60% success) |
| `recruit` | power | 200 ticks | +40 power at 200 gold cost (65% success) |
| `negotiate` | relationship | 100 ticks | +20 reputation with target NPC (50% success) |
| `research` | discovery | 300 ticks | +20 power, +10 faith, -50 gold (70% success) |

**Why it matters:** This makes NPCs behave dynamically. A greedy merchant prioritizes trading over preaching, but a pious cleric pursues faith goals even if poor.

---

## 6. NPC Social Autonomy (M46-C2)

NPCs interact with each other using **Complex Intent Types**, creating emergent social dynamics.

### A. Social Intents

When two NPCs meet, the first NPC selects an intent based on personality and relationship:

| Intent | Effect | Requires |
| :--- | :--- | :--- |
| `PERSUADE` | Target gains trust, agrees to favor | High charisma |
| `DECEIVE` | Target gains fear, becomes suspicious | High deceptiveness |
| `INTIMIDATE` | Target gains fear, obeys orders | High strength |
| `CHARM` | Target gains positive affinity | High charisma |
| `NEGOTIATE` | Both gain mutual reputation | Medium charisma |
| `MANIPULATE` | Target becomes pliable, memory scar forms | High ambition |
| `INSPIRE` | Target gains motivation, joins causes | High faith/piety |

### B. Relationship Tracking

NPCs maintain relationships with each other:

```json
{
  "relationships": [
    {
      "fromNpcId": "smitty-ironhammer",
      "toNpcId": "brother-theron",
      "trust": 35,        // -100 to +100 (>0 means trusts)
      "affinity": 50,     // -100 to +100 (likes or dislikes)
      "debt": 5,          // Favors owed (positive = creditor)
      "status": "neutral",  // neutral, allied, hostile, rival
      "recentInteractions": ["interaction_123", "interaction_124"],
      "conflictCount": 2,
      "cooperationCount": 8
    }
  ]
}
```

**Trust > 50** → NPC listens to social intents, offers discounts.
**Trust < -50** → NPC is suspicious, may refuse interaction.

### C. Belief Layer Integration

When an NPC is **deceived** successfully, the Belief Engine creates a rumor:

```
"Smitty Ironhammer deceived Brother Theron about the fire at the shrine..."
```

This rumor spreads and other NPCs hear about it, affecting their trust relationships dynamically.

### B. Social Scars & Relationship Tiers (M44-T1)

Relationships are more than simple numbers; they are built on a history of mutual interactions and psychological scars.

#### Social Scars (`socialScars`)
Scars are long-term psychological impacts from traumatic or significant events (betrayals, major losses). They affect an NPC's `apparitionChance` (likelihood of the memory surfacing in dialogue) and can gate specific actions.

```json
{
  "socialScars": [
    {
      "id": "scar-stonepeak-loss",
      "npcId": "captain-valerius",
      "scarType": "trauma",
      "description": "Lost his entire squad to a Void Cult ambush 10 years ago.",
      "severity": 85,
      "causedByNpcId": "void-acolyte-unknown",
      "apparitionChance": 0.4,
      "activeEffects": ["fear_of_darkness", "mistrust_of_strangers"],
      "discoveryStatus": "active"
    }
  ]
}
```

| Field | Description |
| :--- | :--- |
| `scarType` | `trauma`, `betrayal`, `shame`, `regret`, `guilt`. |
| `severity` | 0-100. Higher severity makes the scar harder to heal and more likely to trigger negative status effects. |
| `apparitionChance` | 0-1. Probability that this scar will be referenced in dynamic dialogue or influence a GOAP decision. |
| `activeEffects` | Unique tags that the engine uses to modify NPC behavior (e.g., `mistrust_of_strangers` might increase the difficulty of `PERSUADE` actions). |

#### Relationship Tiers
The engine automatically categorizes relationships based on a combination of `trust`, `affinity`, and shared `mutualMemories`.

- **Hostile**: (< -75) Active conflict, will attack or sabotage.
- **Wary**: (-75 to -25) Suspects motives, limited interaction.
- **Neutral**: (-25 to +25) Default starting state.
- **Friendly**: (+25 to +75) Willing to share rumors and offer fair prices.
- **Allied**: (> +75) Will participate in shared goals and offer significant discounts.

---

## 7. Soul Echoes & Legacy Catalog (M45-C1)

**Soul Echoes** are ancestral perks and relics that pass from one generation to the next. They manifest based on heroic deeds and are gated by "Myth Status" (legendary power rating).

### A. Soul Echo Definitions

Define potential soul echoes in your template:

```json
{
  "soulEchoes": [
    {
      "id": "echo-dragon-slayer",
      "name": "Echo of the Dragon Slayer",
      "description": "Your ancestor slew a great dragon. Their triumph echoes through your blood.",
      "ancestorName": "Ancient Dragon Slayer",
      "deedTriggered": "DEFEAT_GREAT_DRAGON",
      "echoType": "relic_item",
      "rarity": "legendary",
      "powerLevel": 85,
      "mechanicalEffect": "+20% damage vs. dragons, +2 fire resistance",
      "narrativeEffect": "You feel dragon fire no longer touches you. Your ancestor's victory burns eternal.",
      "requiresMythStatus": 70,
      "generationsOld": 3,
      "visualMarker": "🐉",
      "audioMarker": "Distant draconic roar"
    },
    {
      "id": "echo-liberator",
      "name": "Echo of the Liberator",
      "description": "Your ancestor freed an entire people from oppression.",
      "ancestorName": "The Great Liberator",
      "deedTriggered": "FREE_ENSLAVED_KINGDOM",
      "echoType": "bloodline_blessing",
      "rarity": "epic",
      "powerLevel": 75,
      "mechanicalEffect": "+15 charisma for persuasion, +50 reputation with liberated factions",
      "narrativeEffect": "The gratitude of millions flows through your veins.",
      "requiresMythStatus": 60,
      "generationsOld": 2,
      "visualMarker": "⚔️",
      "audioMarker": "Chains breaking"
    }
  ]
}
```

### B. Soul Echo Properties

| Field | Purpose |
| :--- | :--- |
| `echoType` | `relic_item` (special inventory), `ethereal_power` (stat bonus), `bloodline_blessing` (passive), `ancestral_memory` (special ability). |
| `rarity` | `rare`, `epic`, `legendary`, `mythic`. Higher rarity = more powerful. |
| `powerLevel` | 0-100. Combined with other echoes for meta-progression. |
| `requiresMythStatus` | Ancestor must have achieved this "legend rating" to unlock. |
| `generationsOld` | How many generations back? Echoes fade over time. |
| `deedTriggered` | Which heroic deed unlocks this? (e.g., `DEFEAT_GREAT_DRAGON`, `FREE_ENSLAVED_KINGDOM`). |

### C. How Inheritance Works

When a character dies:

1. **Myth Status Calculation**: Based on deeds (quest completions, faction influence, world impact).
2. **Soul Echo Unlock**: For each deed, check if it matches an echo's `deedTriggered` and if myth status ≥ `requiresMythStatus`.
3. **Next Generation**: New character inherits unlocked echoes, gaining permanent stat bonuses or special items.
4. **Generational Decay**: Echoes become less powerful if ancestor was too long ago.

**Example:** Player defeats a dragon (myth status 75). Next generation inherits Echo of the Dragon Slayer (+20% damage vs. dragons). If they live to play another generation, the echo fades slightly but remains accessible.

---

## 8. Economic Faction Modifiers (M44-D2)

Factions control prices differently based on ideology and alignment. Faction modifiers create economic pressure as gameplay.

### A. Faction Pricing Rules

Define how each faction prices item categories:

```json
{
  "factionPricingRules": {
    "silver-flame": {
      "name": "The Silver Flame",
      "economicModel": "militant",
      "baseTaxRate": 0.12,
      "modifiers": {
        "holy": { "baseModifier": 0.5, "reason": "faction_favor", "description": "Holy items 50% off" },
        "shadow": { "baseModifier": 3.0, "reason": "illegal", "description": "Shadow items 300% tax" },
        "luxury": { "baseModifier": 1.0, "reason": "faction_tax", "description": "Luxury items standard" },
        "common": { "baseModifier": 1.0, "reason": "faction_tax", "description": "Common items standard" }
      }
    },
    "shadow-conclave": {
      "name": "Shadow Conclave",
      "economicModel": "mercantile",
      "baseTaxRate": 0.18,
      "modifiers": {
        "shadow": { "baseModifier": 0.4, "reason": "faction_favor", "description": "Shadow items 40% off" },
        "holy": { "baseModifier": 2.5, "reason": "illegal", "description": "Holy items 250% tax" },
        "luxury": { "baseModifier": 1.8, "reason": "faction_tax", "description": "Luxury premium" }
      }
    }
  ]
}
```

### B. Price Formula

```
finalPrice = basePrice × modifierMultiplier × (1 + baseTaxRate)
```

**Example:** 100 gold Holy Item in Silver Flame zone:
```
= 100 × 0.5 (holy discount) × (1 + 0.12 tax)
= 50 × 1.12
= 56 gold
```

### C. Modifier Categories

Define which item categories your economy recognizes:

- `holy` - Religious items, sacred relics
- `shadow` - Dark magic items, forbidden knowledge
- `nature` - Herbs, potions, natural materials
- `luxury` - Fine goods, art, rare items
- `common` - Basic supplies, food, mundane items
- `rare` - Unique or hard-to-find items
- `legendary` - Artifacts, extremely powerful items
- `cursed` - Dangerous or corrupted items

---

## 9. Causal Weather Rule Logic (M44-D1)

Weather isn't random—it's driven by world state. High faction contention triggers ash storms; magical surges create mana-static.

### A. Weather Types

Standard weather types:
- `clear` - Calm conditions
- `snow` - Winter snowfall
- `rain` - Precipitation
- `ash_storm` - Conflict-driven environmental hazard
- `cinder_fog` - Moderate magical/conflict effects
- `mana_static` - Magical surge distortion

### B. Causal Rules

Define rules that trigger weather:

```json
{
  "causalWeatherRules": [
    {
      "id": "ash_storm_high_contention",
      "name": "Ash Storm",
      "condition": "high_contention",
      "triggerThreshold": 0.7,
      "weatherResult": "ash_storm",
      "intensity": "heavy",
      "duration": 5000,
      "priority": 50,
      "narrative": "Ash swirls in the conflict zone as factions wage unseen warfare..."
    },
    {
      "id": "clear_skies_peace",
      "name": "Clear Skies",
      "condition": "low_contention",
      "triggerThreshold": 0.2,
      "weatherResult": "clear",
      "intensity": "light",
      "duration": 999999,
      "priority": 10,
      "narrative": "The sky is clear and peaceful."
    },
    {
      "id": "mana_static_surge",
      "name": "Mana-Static",
      "condition": "magical_surge",
      "triggerThreshold": 0.6,
      "weatherResult": "mana_static",
      "intensity": "heavy",
      "duration": 2000,
      "priority": 80,
      "narrative": "Reality crackles with arcane energy!"
    }
  ]
}
```

| Field | Purpose |
| :--- | :--- |
| `condition` | Trigger type: `high_contention`, `low_contention`, `magical_surge`, `faction_victory`, `epoch_transition`. |
| `triggerThreshold` | 0-1 scale (e.g., contentionLevel > 0.7 triggers). |
| `priority` | Higher priority rules override lower. `magnus_fluctus` (100+) overrides all. |
| `duration` | How many ticks the weather persists. |
| `narrative` | Flavor text when weather triggers. |

**How it works:**
1. Calculate `contentionLevel` from faction warfare status at that location.
2. Check all rules against current conditions.
3. Select highest-priority applicable rule.
4. Apply its weather, override any existing weather.

---

## 10. World Fragment Persistence (M43-A4)

**World Fragments** are buildings, monuments, and landmarks that persist across epoch transitions with "weathering" mechanics.

### A. Fragment Definitions

Pre-seed immutable or important fragments:

```json
{
  "worldFragments": [
    {
      "id": "scar-shattered-gate",
      "locationId": "luminara-grand-market",
      "type": "architectural_scar",
      "name": "The Shattered Gate",
      "description": "A massive stone archway, partially collapsed from the Great Fracture.",
      "durability": 0.85,
      "weatheringRate": 0.01,
      "isImmutable": true,
      "historicalEvent": "fact-great-fracture"
    },
    {
      "id": "monument-fallen",
      "locationId": "eldergrove-village",
      "type": "cultural_monument",
      "name": "Monument to the Fallen",
      "description": "A wooden pillar engraved with the names of those lost to the Abyss.",
      "durability": 0.5,
      "weatheringRate": 0.05,
      "isImmutable": false
    }
  ]
}
```

### B. Fragment Properties

| Field | Purpose |
| :--- | :--- |
| `type` | `building`, `garden`, `landmark`, `shrine`, `monument`, `ruin`, `statue`, `road`, `bridge`. |
| `durability` | 0-1 health (1.0 = pristine, 0.0 = destroyed). Decreases with epoch transitions. |
| `weatheringRate` | How much durability is lost per epoch (0.2 standard). |
| `isImmutable` | If `true`, never weathering (sealed with `/seal_canon`). |
| `historicalEvent` |  Link to hard fact that created this fragment. Appears in chronicle. |

### C. Durability States

Fragment state affects visuals:
- **pristine** (1.0-0.75): Full color, active
- **weathered** (0.75-0.5): Faded color, worn appearance
- **crumbling** (0.5-0.25): Damaged, cracked
- **ruined** (0.25-0.01): Barely standing, overgrown
- **destroyed** (0.0): Gone, only memory remains

---

## 11. Investigation Pipeline Setup (M46-A2)

Players investigate rumors to uncover hard facts. Define clue sources for each fact type.

### A. Clue Sources

Each fact type can be discovered through different channels:

```json
{
  "investigationClues": {
    "death": [
      {
        "source": "npc_dialogue",
        "description": "An eyewitness describes seeing the victim fall",
        "confidenceBonus": 20
      },
      {
        "source": "artifact_inspection",
        "description": "Blood-stained clothing confirms the tragedy",
        "confidenceBonus": 25
      },
      {
        "source": "location_search",
        "description": "Battle markings at the scene tell a story",
        "confidenceBonus": 20
      }
    ],
    "siege": [
      {
        "source": "npc_dialogue",
        "description": "Refugees describe the fortress falling",
        "confidenceBonus": 18
      },
      {
        "source": "location_search",
        "description": "Scorched walls show signs of great fire",
        "confidenceBonus": 22
      }
    ]
  }
}
```

### B. Investigation Thresholds

Evidence accumulation uses these thresholds:

| Threshold | Strength | Effect |
| :--- | :--- | :--- |
| `SUSPICIOUS` | 25 | Enough to suspect something |
| `COMPELLING` | 50 | Strong evidence |
| `CONVINCING` | 75 | Nearly certain |
| `ABSOLUTE` | 100 | Proven beyond doubt |

At `ABSOLUTE`, the hard fact is revealed and investigation quest completes.

---

## 12. Quest Construction & Synthesis

Quests drive narrative forward. M46-A1 (Quest Synthesis AI) can generate quests dynamically, but you can also define anchor quests.

### A. Quest Structure

```json
{
  "quests": [
    {
      "id": "herbs-for-the-healer",
      "title": "Herbs for the Healer",
      "description": "Brother Theron needs rare herbs from Thornwood Depths to prepare medicines for the village.",
      "giver": "brother-theron",
      "objective": {
        "type": "exploration",
        "location": "thornwood-depths",
        "requirements": ["gather_medicinal_herbs"]
      },
      "dependencies": [],
      "rewards": {
        "xp": 75,
        "gold": 20,
        "reputationDelta": { "silver-flame": 10 }
      },
      "expiresInHours": 168,
      "tags": ["basic", "gathering", "faction_favor"]
    }
  ]
}
```

### B. Objective Types

| Type | Purpose |
| :--- | :--- |
| `visit` | Go to location; optionally at specific time |
| `combat` | Defeat enemies at location |
| `exploration` | Discover and explore location |
| `challenge` | Complete puzzle or skill check |
| `gather` | Collect specific items |
| `craft` | Create an item |
| `investigation` | Uncover a rumor's truth |

### C. Dynamic Quest Synthesis (M46-A1)

The Quest Synthesis AI can generate quests dynamically based on:
- **Faction Goals**: "Recruit mercenaries for upcoming siege"
- **NPC Autonomous Goals**: "A merchant needs rare goods"
- **World State**: "This location is contested; help secure it"
- **Chronicle Events**: "Rumors spread about a curse"

Authors define templates that the AI uses to synthesize quests:

```json
{
  "questTemplates": [
    {
      "id": "template-escort",
      "title": "Escort {npcName} to {locationName}",
      "description": "{npcName} needs safe passage because {reason}.",
      "objective": {
        "type": "visit",
        "location": "{targetLocation}"
      },
      "rewards": {
        "xp": 100,
        "reputationDelta": { "{factionId}": 15 }
      }
    }
  ]
}
```

---

## 13. Faction Warfare & Territorial Control

Factions vie for control of locations. Contention levels drive weather, social tension, and economic pressure.

### A. Faction Definition

```json
{
  "factions": [
    {
      "id": "silver-flame",
      "name": "The Silver Flame",
      "philosophy": "Preservation and purification through light and order.",
      "initialInfluence": 25,
      "baseStrength": 0.6,
      "isExpansionist": false,
      "rivalries": ["shadow-conclave"],
      "traits": ["ordered", "pious", "defensive"],
      "economicModel": "militant",
      "baseColor": "#fbbf24"
    }
  ]
}
```

### B. Location Influence

Each location has faction influence scores (0-1 per faction):

```json
{
  "locationInfluences": {
    "luminara-grand-market": {
      "silver-flame": 0.25,
      "shadow-conclave": 0.15,
      "luminara-mercantile": 0.40,
      "ironsmith-guild": 0.20
    }
  }
}
```

- The faction with highest influence is "dominant" at that location.
- High contention (close scores) triggers ash storms and skirmishes.
- Dominant faction controls pricing, NPC availability, and quest availability.

### C. Skirmish Simulation

During time-skips (Chrono-Action leaps), the warfare engine simulates skirmishes:

```json
{
  "factionWarfareRules": {
    "skirmishChance": 0.05,
    "influenceShiftPerVictory": 0.1,
    "casualtyScaling": 1.0,
    "determinismSeed": 12345
  }
}
```

Skirmishes are deterministic (same seed = same outcome) so reloading doesn't change results.

---

## 14. Multi-Generation Chronicle Epochs

Epochs represent different time periods across multiple player lifetimes. Each epoch has its own flavor and world state.

### A. Epoch Definitions

Define available epochs:

```json
{
  "epochs": {
    "epoch_i_fracture": {
      "id": "epoch_i_fracture",
      "sequenceNumber": 1,
      "name": "Epoch I: Fracture",
      "theme": "Recovery",
      "chronologyYear": 1000,
      "description": "The Cataclysm has just ended. Civilization struggles to rebuild.",
      "nextEpochId": "epoch_ii_waning",
      "factionStateOverride": {
        "silver-flame": { "power": 25, "trend": "ascending" },
        "shadow-conclave": { "power": 15, "trend": "hidden" }
      }
    },
    "epoch_ii_waning": {
      "id": "epoch_ii_waning",
      "sequenceNumber": 2,
      "name": "Epoch II: Waning",
      "theme": "Entropy & Darkness",
      "chronologyYear": 1200,
      "description": "Magic fades. The world grows colder.",
      "previousEpochId": "epoch_i_fracture",
      "nextEpochId": "epoch_iii_twilight"
    }
  ]
}
```

### B. Soft Canon & World Deltas

When transitioning between epochs, the Soft Canon system applies player legacy:

```json
{
  "softCanon": {
    "playerLegacyInfluence": 75,
    "inheritedFactionReputation": {
      "silver-flame": 50,
      "luminara-mercantile": -30
    },
    "discoveredLocationsCarryOver": [
      "eldergrove-village",
      "thornwood-depths",
      "moonwell-shrine"
    ],
    "npcMemoriesOfPlayer": {
      "brother-theron": "The hero who saved the village from corruption",
      "smitty-ironhammer": "A worthy crafter; we traded enchanted steel"
    },
    "worldState": "improved"
  }
}
```

**How it works:**
1. Previous-epoch player builds reputation with factions.
2. That reputation "echoes" into next epoch (soft canon).
3. NPCs remember the previous player.
4. Discovered locations stay discovered.
5. Faction power is updated based on player's influence.

---

## 15. Module & Version Identification

Allow templates to be version-locked to engine builds for stability.

```json
{
  "moduleIdentification": {
    "templateId": "luxfier-alpha-v2.0",
    "engineVersion": "M44-M46",
    "minimumEngineVersion": "M44",
    "targetEngineVersion": "M47",
    "compatibilityRange": "M44.0-M47.99",
    "metadata": {
      "author": "Luxfier Team",
      "createdDate": "2026-02-17",
      "lastUpdated": "2026-02-17",
      "tags": ["prototype", "multi-epoch", "deep-simulation"]
    }
  }
}
```

---

## 16. Localization Patterns

Plan for future translation support with i18n structure:

```json
{
  "i18n": {
    "default": "en-US",
    "supported": ["en-US", "ja-JP", "de-DE"],
    "stringRegistry": {
      "npc:brother-theron:greeting": {
        "en-US": "Welcome, traveler. I am Brother Theron, healer and keeper of lore.",
        "ja-JP": "ようこそ、旅人よ。私はブラザー・セロン、癒し手で伝承の守り手です。",
        "de-DE": "Willkommen, Wanderer. Ich bin Bruder Theron, Heiler und Hüter der Überlieferung."
      },
      "quest:herbs-for-healer:title": {
        "en-US": "Herbs for the Healer",
        "ja-JP": "癒し手のための薬草",
        "de-DE": "Kräuter für den Heiler"
      }
    }
  }
}
```

---

## 17. Performance Guardrails

Define protective limits to prevent simulation lag:

```json
{
  "performanceGuardrails": {
    "maxNpcsPerLocation": 20,
    "maxQuestsActive": 50,
    "maxFactionsActive": 8,
    "maxWorldFragmentsPerEpoch": 500,
    "maxInvestigationsActive": 20,
    "npcGossipUpdateInterval": 1000,
    "factionSkirmishInterval": 5000,
    "investigationTickInterval": 500,
    "worldFragmentWeatherTick": 100,
    "densityWarnings": {
      "npcDensityPerLocation": 15,
      "locationComplexityMetric": 100,
      "factionsContentionThreshold": 0.8
    }
  }
}
```

**Recommendations:**
- **Max NPCs per location**: 20 (diminishing returns on emergence beyond this)
- **Max active quests**: 50 (prevents quest log bloat)
- **Max factions**: 8 (keeps warfare interesting but performant)

If exceeded, log warnings and disable non-critical systems (e.g., reduce NPC social interaction frequency).

---

## 18. Boilerplate Template

Copy this to start your own world template:

---

## 18. Boilerplate Template

Copy this to start your own world template:

```json
{
  "name": "Luxfier Alpha Prototype",
  "description": "A nascent world where magic stirs and ancient powers awaken. Five factions vie for control while corruption spreads from the Abyss edge.",
  "version": "2.0",
  "season": "spring",
  "multiEpochEnabled": true,
  "baseEpoch": "epoch_i_fracture",
  
  "timeSettings": {
    "ticksPerMinute": 1,
    "ticksPerHour": 60,
    "ticksPerDay": 1440,
    "startingHour": 8
  },
  
  "moduleIdentification": {
    "templateId": "luxfier-alpha-v2.0",
    "engineVersion": "M44-M46",
    "minimumEngineVersion": "M44"
  },
  
  "factions": [
    {
      "id": "silver-flame",
      "name": "The Silver Flame",
      "philosophy": "Preservation and purification through light and order.",
      "initialInfluence": 25,
      "baseStrength": 0.6,
      "isExpansionist": false,
      "rivalries": ["shadow-conclave"],
      "traits": ["ordered", "pious", "defensive"],
      "economicModel": "militant",
      "baseColor": "#fbbf24"
    }
  ],
  
  "locations": [
    {
      "id": "eldergrove-village",
      "name": "Eldergrove Village",
      "spiritDensity": 0.3,
      "biome": "forest",
      "description": "A humble settlement where the Silver Flame tends the Sacred Grove."
    },
    {
      "id": "luminara-grand-market",
      "name": "Luminara Grand Market",
      "spiritDensity": 0.2,
      "biome": "village",
      "description": "The commercial heart of the region, controlled by Luminara Mercantile."
    }
  ],
  
  "travelMatrix": {
    "eldergrove-village": {
      "luminara-grand-market": 120
    },
    "luminara-grand-market": {
      "eldergrove-village": 120
    }
  },
  
  "npcs": [
    {
      "id": "brother-theron",
      "name": "Brother Theron",
      "locationId": "eldergrove-village",
      "factionId": "silver-flame",
      "factionRole": "leader",
      "persona": "A healer and keeper of lore who seeks to preserve ancient wisdom.",
      "quirks": ["touches his chest when thinking deeply", "always offers tea"],
      "voiceDescriptor": "Gentle and measured, with an underlying resolve",
      "routine": {
        "6-12": "eldergrove-village",
        "12-18": "luminara-grand-market",
        "18-24": "eldergrove-village"
      },
      "availability": {
        "startHour": 6,
        "endHour": 20
      },
      "emotionalState": {
        "trust": 50,
        "fear": 0,
        "gratitude": 0,
        "resentment": 0
      },
      "personality": {
        "greediness": 0.2,
        "piety": 0.9,
        "ambition": 0.3,
        "loyalty": 0.8,
        "risk": 0.2,
        "sociability": 0.7
      },
      "dialogueVariations": {
        "default": [
          "Welcome, traveler. How may I aid you?",
          "The Sacred Grove provides for those who respect its ways."
        ],
        "winter": [
          "Winter tests our resolve. Stay warm.",
          "The season of reflection is upon us."
        ]
      }
    }
  ],
  
  "hardFacts": [
    {
      "id": "fact-great-fracture",
      "eventType": "catastrophe",
      "description": "The Great Fracture: A rift in reality itself, separating the known world from the void.",
      "originLocationId": "luminara-grand-market",
      "originEpochTick": 0,
      "factionIds": ["silver-flame"],
      "severity": 100,
      "truthRadius": 500,
      "truthDecayRate": 0.2,
      "timestamp": 0
    }
  ],
  
  "quests": [
    {
      "id": "herbs-for-the-healer",
      "title": "Herbs for the Healer",
      "description": "Brother Theron needs rare herbs to prepare medicines.",
      "giver": "brother-theron",
      "objective": {
        "type": "exploration",
        "location": "eldergrove-village"
      },
      "dependencies": [],
      "rewards": {
        "xp": 75,
        "gold": 20,
        "reputationDelta": { "silver-flame": 10 }
      },
      "expiresInHours": 168,
      "tags": ["basic", "gathering"]
    }
  ],
  
  "soulEchoes": [
    {
      "id": "echo-dragon-slayer",
      "name": "Echo of the Dragon Slayer",
      "description": "Your ancestor slew a great dragon.",
      "ancestorName": "Ancient Dragon Slayer",
      "deedTriggered": "DEFEAT_GREAT_DRAGON",
      "echoType": "relic_item",
      "rarity": "legendary",
      "powerLevel": 85,
      "mechanicalEffect": "+20% damage vs. dragons, +2 fire resistance",
      "narrativeEffect": "Your ancestor's victory burns eternal.",
      "requiresMythStatus": 70,
      "generationsOld": 3,
      "visualMarker": "🐉"
    }
  ],
  
  "causalWeatherRules": [
    {
      "id": "ash_storm_high_contention",
      "name": "Ash Storm",
      "condition": "high_contention",
      "triggerThreshold": 0.7,
      "weatherResult": "ash_storm",
      "intensity": "heavy",
      "duration": 5000,
      "priority": 50,
      "narrative": "Ash swirls as factions wage unseen warfare..."
    }
  ],
  
  "worldFragments": [
    {
      "id": "scar-shattered-gate",
      "locationId": "luminara-grand-market",
      "type": "architectural_scar",
      "name": "The Shattered Gate",
      "description": "A massive archway, partially collapsed from the Great Fracture.",
      "durability": 0.85,
      "weatheringRate": 0.01,
      "isImmutable": true
    }
  ],
  
  "epochs": {
    "epoch_i_fracture": {
      "id": "epoch_i_fracture",
      "sequenceNumber": 1,
      "name": "Epoch I: Fracture",
      "theme": "Recovery",
      "chronologyYear": 1000,
      "description": "The Cataclysm has just ended. Civilization struggles to rebuild.",
      "nextEpochId": "epoch_ii_waning"
    }
  },
  
  "performanceGuardrails": {
    "maxNpcsPerLocation": 20,
    "maxQuestsActive": 50,
    "maxFactionsActive": 8,
    "maxWorldFragmentsPerEpoch": 500,
    "maxInvestigationsActive": 20
  }
}
```

---

## Verification Checklist

Before publishing your template:

- [ ] **Schema Compliance**: Run `ajv validate -s luxfier-world.schema.json -d your-template.json`
- [ ] **NPC Availability**: All NPCs have valid location IDs matching locations array
- [ ] **Travel Matrix**: All routine movements have travelMatrix entries
- [ ] **Quest Dependencies**: All referenced dependencies are defined quests
- [ ] **Faction Coverage**: Factions referenced in NPCs/locations exist in factions array
- [ ] **Epoch Linking**: Epochs link properly (nextEpochId/previousEpochId)
- [ ] **Word Count**: Personas/descriptions are 50-500 characters (AI DM optimization)
- [ ] **Uniqueness**: All IDs (npc, location, quest, faction, etc.) are unique within template
- [ ] **Performance**: NPC count per location ≤ 20; quest count ≤ 50; fragment count ≤ 500
- [ ] **Hard Fact Validation**: Hard facts reference valid factionIds and locationIds

---

## Integration Testing

After creating your template:

1. **Load Test**: Verify worldEngine.ts parses template without warnings
2. **Belief Engine**: Check that hard facts create proper rumor concentric rings
3. **GOAP Simulation**: Run 100 game ticks; verify NPCs select goals and plan actions
4. **Social Interactions**: Verify 2+ NPCs interact and form relationships
5. **Investigation**: Start investigation on a rumor; verify clues accumulate
6. **Weather Dynamics**: Change faction contention; verify causal rules trigger
7. **Quest Synthesis**: Generate synthetic quests; verify they match template patterns
8. **Chronicle Epoch**: Transition to next epoch; verify soft canon is applied

---

## Best Practices

1. **Persona Richness**: 100+ characters per NPC persona ensures varied AI roleplay
2. **Dialogue Variety**: Include weather, season, and quest-state variations for natural feel
3. **Goal Balance**: Distribute personality weights so "mixed" NPCs pursue multiple goals
4. **Rumor Seeding**: Pre-seed important rumors to guide player investigation early
5. **Fragment Significance**: Only create fragments for narratively important moments
6. **Epoch Themes**: Each epoch should have distinct thematic tone (peace vs. conflict)
7. **Faction Tension**: Ensure at least 2 rival factions at each contested location
8. **Performance Awareness**: Monitor dense locations (>15 NPCs); may reduce social interaction frequency

---

## Support & Schema

- **Full Schema**: See [luxfier-world.schema.json](../data/luxfier-world.schema.json)
- **Integration Guide**: See [INTEGRATION_GUIDE_M45_M46.md](./INTEGRATION_GUIDE_M45_M46.md)
- **Engine API**: See [PROTOTYPE/src/engine/](../src/engine/)

---

*World Template Authoring Guide v2.0*  
*For Luxfier Alpha Prototype (M44-M46 Integrated)*  
*Last Updated: February 17, 2026*
