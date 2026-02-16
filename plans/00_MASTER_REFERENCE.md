# MASTER REFERENCE — Project Isekai / Luxfier Alpha

> **Read this file first.** Only load individual layer files as needed to avoid context overload.

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

## 3. File Index

| # | File | Layer | Phase | One-Line Summary | Dependencies |
|---|---|---|---|---|---|
| 00 | `00_MASTER_REFERENCE.md` | — | ALL | This file. Project overview, index, conventions. | None |
| 01 | `01_META_AUTHORITY.md` | I.1 | ALL | Reality layers, authority hierarchy, canon types, AI DM contract, rewind rules | None |
| 02 | `02_COSMOLOGY_METAPHYSICS.md` | I.2–3 | ALL | Chaos Realm, Lux-Ar, time, souls, death, magic source, corruption, fate | 01 |
| 03 | `03_RACES_SPECIES_BIOLOGY.md` | IV | ALL | Elfin, Beastkin, morphing, Succubi, Sanguinarians, humans, hybrids | 01, 02 |
| 04 | `04_MAGIC_SYSTEMS.md` | VII.22 | ALL | 5 disciplines, costs, forbidden practices, spell learning, cross-race effects | 02, 03 |
| 05 | `05_COMBAT_SYSTEMS.md` | VII.20–21 | PROTO | Weapons, martial styles, resolution flow, damage, health, environment | 03, 04 |
| 06 | `06_BELIEF_LAYER_WTOL.md` | VI | ALL | Belief attributes, WTOL, obfuscation, gameplay influence, DB fields | 01, 02 |
| 07 | `07_FACTIONS_POLITICS.md` | II.6 | PROTO | Faction taxonomy, attributes, power graphs, example relationships | 06 |
| 08 | `08_RELICS_ARTIFACTS.md` | VIII | ALPHA | Relics of Virtue, Weapons of Sin, artifacts, crafting, alchemy, runic infusion | 02, 04 |
| 09 | `09_HISTORICAL_TIMELINE.md` | III | ALPHA | Major eras, canonical events, emergent history, timeline DB | 02, 07 |
| 10 | `10_PLAYABLE_CHARACTERS_MORPHING.md` | V.14, IV.11 | PROTO | Base attributes, racial stats, morphing mechanics, character creation | 03, 05 |
| 11 | `11_PLAYER_PROGRESSION_LEVELING.md` | X.29 | PROTO | XP table, skill trees, experience acquisition, level-up flow | 10, 04, 05 |
| 12 | `12_QUEST_SYSTEM.md` | X.28 | PROTO | Quest types, structure, tracking, generation, rewards, AI DM enforcement | 07, 14 |
| 13 | `13_INVENTORY_CRAFTING.md` | VIII.24 | PROTO | Inventory UI, items, crafting, resource management, DB tables | 08, 11 |
| 14 | `14_NPC_SYSTEM.md` | V.15–16 | PROTO | NPC types, AI DM Synthesis, patrol, dynamic interaction, Resonance | 06, 07 |
| 15 | `15_RANDOM_ENCOUNTERS_EXPLORATION.md` | IX | ALPHA | Alpha encounter, rare entities, environmental systems, spawn weighting | 14, 09 |
| 16 | `16_FACTION_POWER_DYNAMICS.md` | IX.26–27 | ALPHA | Faction attributes, power graphs, emergent politics, influence metrics | 07, 12 |
| 17 | `17_SESSION_CONTINUITY.md` | XII.35 | PROTO | Persistence architecture, tracked components, rollback, UI | All systems |
| 18 | `18_ANTI_METAGAMING.md` | XI.33 | ALPHA | Filter layers, knowledge rules, AI DM enforcement, player restrictions | 06, 17 |
| 19 | `19_ENDGAME_REPLAYABILITY.md` | X.30 | ALPHA | Endgame triggers, emergent conclusions, legacy, epilogue, replay seeds | All systems |
| 20 | `20_ALPHA_DATA_SCHEMA.md` | XII.34 | ALL | Complete DB schema, operational flow, AI DM rules, ER diagram | All layers |
| 21 | `21_SEED_WORLD_COSMOLOGY.md` | SQL Seed | PROTO | World core, cosmic realms, Lux-Ar, ontological layers, entities, constraints | 01, 02 |
| 22 | `22_SEED_GEOGRAPHY_BIOMES.md` | SQL Seed | PROTO | Continents, biomes, cities/settlements, subareas, traversal rules | 09 |
| 23 | `23_SEED_RACES_MAGIC_COMBAT.md` | SQL Seed | PROTO | Race stats, morphing, hybrids, magic schools, spells, weapons, proficiencies | 03, 04, 05 |
| 24 | `24_SEED_NPC_PANTHEON.md` | SQL Seed | ALPHA | Sin, 24 Celestin deities, canon heroes, idols, historical anchors | 14, 02 |
| 25 | `25_SEED_NPC_CLERGY_LEADERS.md` | SQL Seed | ALPHA | Clergy, heretical leaders, monarchs, spawn rules, belief impacts | 24 |
| 26 | `26_SEED_LOCATIONS_SUBAREAS.md` | SQL Seed | ALPHA | 34 locations, 34 sub-areas with parent references | 22 |
| 27 | `27_SEED_GAMEPLAY_SYSTEMS.md` | SQL Seed | PROTO | Belief, WTOL, factions, quests, encounters, inventory, progression, sessions | 06–19 |
| 28 | `28_ROADMAP.md` | Roadmap | ALL | Development phases, acceptance criteria, feature-to-file mapping, phase gates | All |

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

> Full details in `28_ROADMAP.md`. Summary below.

| Phase | Goal | Key Deliverables |
|---|---|---|
| **Prototype** | Core foundations | Solo gameplay loop, persistent world state, save/load, basic AI DM, portal UI |
| **Alpha** | Expanded functionality | Enhanced AI DM, player-created content, procedural events, visuals, analytics |
| **Beta** | Multiplayer & advanced systems | Co-op/competitive play, cross-session continuity, community content, advanced AI |
| **Future** | Long-term vision | Fully modular sandbox RPG, marketplace, large-scale multiplayer, real-time AI assets |

**Current Phase: Prototype**

See `28_ROADMAP.md` Section 28.2 for full acceptance criteria and codebase targets.
