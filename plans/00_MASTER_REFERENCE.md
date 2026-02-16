# Master Reference — Project Isekai / Luxfier

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026
> **Version:** 1.2.0

---

## 1. Project Overview

**Project Isekai** delivers a solo-first, AI-assisted tabletop RPG experience where players enter a richly crafted fantasy world, make meaningful choices, and interact with a persistent game environment guided by an AI Dungeon Master.

### Core Goal

| Aspect | Detail |
|---|---|
| **Genre** | Mystery-first, infinitely replayable, AI-DM–driven RPG |
| **Player Mode** | Singleplayer first; multiplayer is future |
| **World** | Luxfier — a constructed reality pocket suspended within the Chaos Realm |
| **Core Loop** | Exploration → social interaction → combat → narrative decisions → world mutation |
| **Differentiator** | Belief Layer + World Truth Obfuscation Layer — players never have full information |
| **Replayability** | Randomized seeds, dynamic factions, emergent history, procedural quests |
| **AI DM** | Enforces canon, manages NPCs, adjudicates outcomes, preserves mystery |

### Long-Term Vision

- Sandbox tabletop RPG with AI-driven narrative depth
- Expandable world templates (generic fantasy, Luxfier, player-created)
- Bridges traditional tabletop mechanics with digital interactivity

---

## 2. Current Codebase State

| Component | Technology | Status | Target Phase |
|---|---|---|---|
| Framework | Next.js 14 | Working | PROTO |
| Language | TypeScript 5 (strict) | Working | PROTO |
| UI | React 18, inline styles | Partial (many components missing) | PROTO |
| Validation | Ajv (JSON Schema) | Working | PROTO |
| Testing | Jest 29 + ts-jest | Working | PROTO |
| Event Ledger | mutationLog.ts | Hardened (~98% coverage) | PROTO |
| World Engine | worldEngine.ts | Core working (tick, actions, save/load) | PROTO |
| Action Pipeline | actionPipeline.ts | Stub | PROTO |
| Canon Journal | canonJournal.ts | Stub | PROTO |
| Constraint Validator | constraintValidator.ts | Stub | PROTO |
| State Rebuilder | stateRebuilder.ts | Stub | PROTO |
| Server | Express | Stub | PROTO |
| World Template | luxfier-world.json | Minimal stub | PROTO |
| World Schema | luxfier-world.schema.json | Missing | PROTO |
| AI DM Engine | aiDmEngine.ts | Not started | ALPHA |
| Procedural Engine | proceduralEngine.ts | Not started | ALPHA |
| Analytics Engine | analyticsEngine.ts | Not started | ALPHA |
| Template Editor | templateEditor.ts | Not started | ALPHA |
| Asset Generator | assetGenerator.ts | Not started | ALPHA |
| Multiplayer Engine | multiplayerEngine.ts | Not started | BETA |

### Key Patterns

- **Event sourcing** — all state changes flow through hash-chained immutable ledger
- **Template-driven worlds** — world content is data-driven via JSON templates
- **Dev/Kernel API split** — different surfaces depending on dev flag
- **Copy-on-write** — state cloned via structuredClone before exposure
- **Deterministic simulation** — weather, season, day phase derived from tick count

---

## 3. Comprehensive File Index

### 3.1 Core Design Specifications (`plans/design/`)
| # | File | Internal Layer | One-Line Summary |
|---|---|---|---|
| 01 | [`01_META_AUTHORITY.md`](design/01_META_AUTHORITY.md) | I.1 | Reality layers, authority hierarchy, canon types |
| 02 | [`02_COSMOLOGY_METAPHYSICS.md`](design/02_COSMOLOGY_METAPHYSICS.md) | I.2–3 | Chaos Realm, Lux-Ar, time, souls, death |
| 03 | [`03_RACES_SPECIES_BIOLOGY.md`](design/03_RACES_SPECIES_BIOLOGY.md) | IV | Elfin, Beastkin, morphing, biology |
| 04 | [`04_MAGIC_SYSTEMS.md`](design/04_MAGIC_SYSTEMS.md) | VII.22 | 5 disciplines, costs, spell learning |
| 05 | [`05_COMBAT_SYSTEMS.md`](design/05_COMBAT_SYSTEMS.md) | VII.20–21 | Weapons, styles, resolution flow, health |
| 06 | [`06_BELIEF_LAYER_WTOL.md`](design/06_BELIEF_LAYER_WTOL.md) | VI | Belief attributes, obfuscation (WTOL) |
| 07 | [`07_FACTIONS_POLITICS.md`](design/07_FACTIONS_POLITICS.md) | II.6 | Faction taxonomy, attributes, power graphs |
| 08 | [`08_RELICS_ARTIFACTS.md`](design/08_RELICS_ARTIFACTS.md) | VIII | Relics of Virtue, Weapons of Sin, crafting |
| 09 | [`09_HISTORICAL_TIMELINE.md`](design/09_HISTORICAL_TIMELINE.md) | III | Major eras, canonical events, timeline DB |
| 10 | [`10_PLAYABLE_CHARACTERS_MORPHING.md`](design/10_PLAYABLE_CHARACTERS_MORPHING.md) | V.14, IV.11 | Attributes, morphing, character creation |
| 11 | [`11_PLAYER_PROGRESSION_LEVELING.md`](design/11_PLAYER_PROGRESSION_LEVELING.md) | X.29 | XP table, skill trees, level-up flow |
| 12 | [`12_QUEST_SYSTEM.md`](design/12_QUEST_SYSTEM.md) | X.28 | Quest types, Tracking, generation |
| 13 | [`13_INVENTORY_CRAFTING.md`](design/13_INVENTORY_CRAFTING.md) | VIII.24 | Inventory UI, items, crafting, resources |
| 14 | [`14_NPC_SYSTEM.md`](design/14_NPC_SYSTEM.md) | V.15–16 | NPC types, DM Synthesis, patrol |
| 15 | [`15_RANDOM_ENCOUNTERS_EXPLORATION.md`](design/15_RANDOM_ENCOUNTERS_EXPLORATION.md) | IX | Encounter weighting, rare entities |
| 16 | [`16_FACTION_POWER_DYNAMICS.md`](design/16_FACTION_POWER_DYNAMICS.md) | IX.26–27 | Influence metrics, emergent politics |
| 17 | [`17_SESSION_CONTINUITY.md`](design/17_SESSION_CONTINUITY.md) | XII.35 | Persistence, tracked components, rollback |
| 18 | [`18_ANTI_METAGAMING.md`](design/18_ANTI_METAGAMING.md) | XI.33 | Knowledge rules, DM enforcement |
| 19 | [`19_ENDGAME_REPLAYABILITY.md`](design/19_ENDGAME_REPLAYABILITY.md) | X.30 | Triggers, conclusions, legacy, seeds |
| 20 | [`20_ALPHA_DATA_SCHEMA.md`](design/20_ALPHA_DATA_SCHEMA.md) | XII.34 | DB schema, operational flow, AI DM rules |
| 21 | [`21_SEED_WORLD_COSMOLOGY.md`](design/21_SEED_WORLD_COSMOLOGY.md) | SQL Seed | World core, cosmic realms, entities |
| 22 | [`22_SEED_GEOGRAPHY_BIOMES.md`](design/22_SEED_GEOGRAPHY_BIOMES.md) | SQL Seed | Continents, city sub-areas, biomes |
| 23 | [`23_SEED_RACES_MAGIC_COMBAT.md`](design/23_SEED_RACES_MAGIC_COMBAT.md) | SQL Seed | Race stats, morphing, spells, weapons |
| 24 | [`24_SEED_NPC_PANTHEON.md`](design/24_SEED_NPC_PANTHEON.md) | SQL Seed | 24 Celestin deities, canon heroes |
| 25 | [`25_SEED_NPC_CLERGY_LEADERS.md`](design/25_SEED_NPC_CLERGY_LEADERS.md) | SQL Seed | Clergy, heretical leaders, monarchs |
| 26 | [`26_SEED_LOCATIONS_SUBAREAS.md`](design/26_SEED_LOCATIONS_SUBAREAS.md) | SQL Seed | 34 locations, parent references |
| 27 | [`27_SEED_GAMEPLAY_SYSTEMS.md`](design/27_SEED_GAMEPLAY_SYSTEMS.md) | SQL Seed | Belief, Quest, Encounter, Inventory seeds |

### 3.2 Milestones & Roadmaps (`plans/milestones/`)
| Milestone | File | One-Line Summary |
|---|---|---|
| **M28** | [`28_ROADMAP.md`](milestones/28_ROADMAP.md) | Strategic roadmap and phase gates |
| **M42** | [`M42_INDEX.md`](milestones/M42_INDEX.md) | Current Sprint Index (Social Scaling) |
| **M42** | [`42_ROADMAP.md`](milestones/42_ROADMAP.md) | M42 Strategic Overview |
| **M42** | [`M42_TASK_LIST.md`](milestones/M42_TASK_LIST.md) | Sprint tasks and subtasks |
| **M42** | [`M42_QUICK_START.md`](milestones/M42_QUICK_START.md) | 15-min developer guide |

### 3.3 Implementation History (`plans/implementation/`)
- Includes technical logs for Combat, Audio, and specific Milestone summaries.
- See the [Implementation Folder](implementation/) for full details.

### 3.4 External Guides (`plans/guides/`)
- [`WORLD_TEMPLATE_AUTHORS_GUIDE.md`](guides/WORLD_TEMPLATE_AUTHORS_GUIDE.md)
- [`UI_UX_DESCRIPTION.md`](guides/UI_UX_DESCRIPTION.md)

---

## 4. Cross-Reference Map

```
Layer 01 (Meta & Authority)
  └─ Layer 02 (Cosmology)
       ├─ Layer 03 (Races)
       │    ├─ Layer 04 (Magic)
       │    │    ├─ Layer 05 (Combat)
       │    │    └─ Layer 08 (Relics & Artifacts)
       │    └─ Layer 10 (Characters & Morphing)
       │         └─ Layer 11 (Progression)
       │              └─ Layer 13 (Inventory & Crafting)
       └─ Layer 06 (Belief Layer & WTOL)
            ├─ Layer 07 (Factions)
            │    ├─ Layer 09 (Timeline)
            │    ├─ Layer 12 (Quests)
            │    └─ Layer 16 (Faction Dynamics)
            ├─ Layer 14 (NPCs)
            │    └─ Layer 15 (Encounters)
            └─ Layer 18 (Anti-Metagaming)

Layer 17 (Session Continuity) ← reads from all
Layer 19 (Endgame & Replayability) ← reads from all
Layer 20 (Alpha Data Schema) ← consolidates all into DB
Layers 21–27 (SQL Seeds) ← implements Layer 20 schema
```

---

## 5. Conventions

### Naming

- Files: `NN_SNAKE_CASE.md` where NN is zero-padded layer number
- DB tables: `snake_case` (e.g., `npc_entities`, `faction_relationships`)
- IDs: `snake_case` strings (e.g., `elfin_common`, `chain_of_patientia`)

### Canon Lock Levels

| Level | Meaning | Example |
|---|---|---|
| **Hard Canon** | Immutable. Never changes. | Cosmology, relic existence, race origins |
| **Soft Canon** | Mutable via major events. | Political borders, faction power, cultural norms |
| **Local Canon** | Mutable and rewind-sensitive. | NPC relationships, town states, quest outcomes |
| **Session Ephemera** | Non-canonical unless promoted. | Dialogue phrasing, failed attempts |

### Authority Hierarchy (Descending Priority)

1. Cosmological Law
2. World Canon
3. System Rules
4. AI DM Judgment
5. Player Intent

### Data Format

- Planning phase: SQL INSERT statements (preserved for future DB implementation)
- Runtime: TypeScript types + JSON templates (aligned with existing worldEngine.ts patterns)
- Conversion from SQL → TS/JSON happens during implementation, not planning

---

## 6. BETA Epoch Framework (Template-Driven)

Luxfier uses a **Multi-Generation Chronicle** model. The world is persistent, but characters are mortal. History proceeds through a sequence of **Playable Epochs** defined by the World Template.

### 6.1 Flexible Epoch Model
- **Architect Choice:** The number of playable epochs is NOT fixed. A World Template may define 1, 3, 5, or more distinct windows of history.
- **Reference Implementation (Luxfier):**
    - *Epoch I: The Fracture of Radiance* (Year 3,412)
    - *Epoch II: The Age of Shattered Faith* (Year 7,982)
    - *Epoch III: The Waning Light* (Year 12,611)
- **Divergence Points:** Each epoch begins based on the *result* of the previous one (The Chronicle Sequence).
- **Chronicle Sequence:** A bridge calculation that shifts the world state between epochs (e.g., Faction power shifts, technological decay, religious evolution).

### 6.2 Legacy Bridge (Player Continuity)
Across all epochs, player impact is preserved through:
- **Bloodline Inheritance:** Descendant characters in later epochs gain perks based on ancestors.
- **Soul Echoes:** Meta-progression unlocks (skills, knowledge) that persist through "reincarnation."
- **Immutable Spine:** Universal truths (Cosmology, Relics) that remain constant regardless of epoch divergence.

---

## 7. Notes for AI Models

- **Coder (GPT 5 mini):** Load this file + the specific layer file for your task. Do not load all files at once. **Check `28_ROADMAP.md` for current phase scope before implementing features.**
- **Debugger:** Reference Layer 20 (Alpha Data Schema) for DB structure. Reference Layer 17 for persistence logic.
- **Reviewer:** Check cross-references in Section 4 to verify layer consistency. **Verify PRs do not introduce out-of-phase dependencies (see `28_ROADMAP.md`).**
- **Planner:** This file is your entry point. Update the File Index when adding new layers. **Update `28_ROADMAP.md` acceptance criteria as features are verified.**
- **All models:** Player narration is always intent, never fact. The AI DM enforces canon. **Respect phase boundaries — Prototype before Alpha before Beta.**

---

## 8. Development Roadmap

> Full details in [`milestones/28_ROADMAP.md`](milestones/28_ROADMAP.md). Summary below.

| Phase | Goal | Key Deliverables |
|---|---|---|
| **Prototype** | Core foundations | Solo gameplay loop, persistent world state, save/load, basic AI DM, portal UI |
| **Alpha** | Expanded functionality | Enhanced AI DM, player-created content, procedural events, visuals, analytics |
| **Beta** | Multiplayer & advanced systems | Co-op/competitive play, cross-session continuity, community content, advanced AI |
| **Future** | Long-term vision | Fully modular sandbox RPG, marketplace, large-scale multiplayer, real-time AI assets |

**Current Phase: Prototype**

See `28_ROADMAP.md` Section 28.2 for full acceptance criteria and codebase targets.
