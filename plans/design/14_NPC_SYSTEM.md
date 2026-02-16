# 14 — NPC System, AI Behavior & Dynamic Interactions

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `06_BELIEF_LAYER_WTOL.md`, `07_FACTIONS_POLITICS.md`

Fully integrates with factions, quests, belief layer, WTOL, and emergent history.
Provides dynamic, reactive, and replayable NPC behavior.

---

## 14.1 Core Principles

- NPC types & roles: classified by function, importance, and player interaction potential
- Faction & belief integration: NPC behavior influenced by faction affiliation, beliefs, and WTOL
- Dynamic & emergent behavior: NPCs react to player choices, world state, emergent history, quests
- Replayability: NPC positions, interactions, and goals vary between playthroughs
- AI DM control: ensures NPC behavior remains consistent with canon

---

## 14.2 NPC Types

| Type | Description | Gameplay Function |
|---|---|---|
| **Story NPCs** | Key lore characters, quest givers, historical figures | Drive narrative, trigger quests |
| **Faction NPCs** | Citizens, guild members, cultists | Influence faction power graphs |
| **Merchants / Crafters** | Shopkeepers, blacksmiths, alchemists | Sell, trade, craft |
| **Combat NPCs** | Guards, soldiers, monsters, rogue adventurers | Combat challenges, event triggers |
| **Random Encounter NPCs** | Traveling merchants, wandering adventurers | Dynamic encounters, minor quest hooks |
| **Legendary / Rare NPCs** | Heroes, infamous villains, elite monsters | Rare events, emergent story, artifact interactions |

---

## 14.3 NPC Attributes

| Attribute | Description |
|---|---|
| STR / AGI / INT / CHA / END / LUK | Standard stats |
| Faction Affiliation | Determines loyalty, quest alignment, interactions |
| Belief Layer Influence | Perception of player, other factions, world events |
| Morphing Capacity | Only for Beastkin, Succubi, Sanguinarians |
| Skill Set | Combat, magic, crafting, diplomacy |
| Disposition | Friendly, neutral, hostile, opportunistic, manipulative |
| Alertness / Awareness | Detects player actions, stealth, emergent events |
| Event Hooks | Triggers for quests, emergent scenarios, artifact interactions |

---

## 14.4 AI DM Dialogue & Interaction System

The AI DM (Large Language Model) acts as the "Ghost in the Machine" for every NPC. Instead of static scripts, it synthesizes a response based on the **Resonance Context**.

### 14.4.1 Dialogue Synthesis (The "Character Prompt")
The AI DM generates replies by injecting the following data into its context window:
- **Character Blueprint**: `persona`, `quirks`, `voiceDescriptor` (from World Template).
- **Physical Context**: Current `location`, `season`, `weather`, and `time` (e.g., "It's midnight in a frozen forest").
- **Social Resonance**: Current `trust`, `fear`, `gratitude`, and `resentment` levels.
- **Narrative Hooks**: Active `quests`, `inventory items` shown to the NPC, and `past decisions`.
- **WTOL (Belief Layer)**: What the NPC knows (or thinks they know) about the player.

### 14.4.2 Social Interaction Mechanics
- **Dynamic Persuasion/Intimidation**: Not just a dice roll, but based on the AI's interpretation of the player's written "argument" vs the NPC's `persona` and `fear` levels.
- **Bribes & Items**: NPCs react dynamically to items offered. A merchant might recognize a "Silver-War Relic" and drop their `resentment` immediately.
- **Reactivity**: NPCs can react to morphing, magic display, or player notoriety in real-time.

### 14.4.3 Interaction flow
1.  **Input**: Player sends a message or performs an action (e.g., "Show them the cursed idol").
2.  **Context Assembly**: Engine pulls NPC stats, world state, and history.
3.  **AI Generation**: DM generates the character's reaction and speech.
4.  **Mutation**: The result of the interaction may trigger changes in the `Resonance Metrics` or `Mutation Log`.

---

## 14.5 NPC Movement & Patrol

### 14.5.1 Patrol & Movement
- Town NPCs: daily routines, faction-based patrols
- Guards: enforce laws, respond to crimes
- Merchants: move between settlements, affect trade networks
- Random NPCs: roam, interact, trigger emergent events

### 14.5.2 Transition logic
NPCs transition between locations based on the 24h clock defined in `routine`. The AI DM can override these moves if a "World Event" (e.g., a monster attack) is triggered.

---

## 14.6 Database Representation

| Table | Key Fields |
|---|---|
| **NPC_Master** | npc_id, name, race, sub_race, type, faction_id, level, base_stats, skill_set, morph_capacity, disposition |
| **NPC_Location** | npc_id, current_region_id, current_coords, patrol_pattern_id, last_update |
| **NPC_QuestHooks** | npc_id, quest_id, trigger_conditions, event_type |
| **NPC_InteractionLog** | npc_id, character_id, action_taken, result, timestamp |
| **NPC_BeliefProfile** | npc_id, belief_layer_state, WTOL_perception, faction_alignment, reputation |

---

## 14.7 UI Integration

- In-game tooltips / interaction menu: NPC name, race, faction, general disposition, quest options
- Quest hook highlight: NPCs offering quests visually indicated
- Dynamic indicators: morality, threat level, notoriety visible via UI markers

---

## 14.8 AI DM Enforcement

- **Canonical Behavior:** Story-critical NPCs follow pre-defined lore events
- **Emergent Adaptation:** Non-critical NPCs respond dynamically to player choices
- **Faction & Belief Consistency:** NPC actions update faction power graphs, belief layers, and WTOL
- **Combat & Morphing Checks:** AI ensures NPC morphing, magic, and combat remain balanced
- **Replayability Assurance:** NPC schedules, locations, and emergent interactions randomized per session
