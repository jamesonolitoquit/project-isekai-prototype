# Master Reference — Project Isekai / Luxfier

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 22, 2026
> **Version:** 1.3.0

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
| Canon Journal | canonJournal.ts | Hardened (M57 committed) | PROTO |
| Constraint Validator | constraintValidator.ts | Hardened (M57 committed) | PROTO |
| State Rebuilder | stateRebuilder.ts | Stub | PROTO |
| Server | Express | Hardened (M57 committed) | PROTO |
| World Template | luxfier-world.json | Minimal stub | PROTO |
| World Schema | luxfier-world.schema.json | Missing | PROTO |
| AI DM Engine | aiDmEngine.ts | Working (M55 BYOK) | ALPHA |
| Procedural Engine | proceduralEngine.ts | In Progress (M55 Social) | ALPHA |
| Analytics Engine | analyticsEngine.ts | Not started | ALPHA |
| Template Editor | templateEditor.ts | In Progress (M55 Architect) | ALPHA |
| Asset Generator | assetGenerator.ts | Working | ALPHA |
| Multiplayer Engine | multiplayerEngine.ts | Hardened (M57 P2P core) | BETA |

### Key Patterns

- **Event sourcing** — all state changes flow through hash-chained immutable ledger
- **Template-driven worlds** — world content is data-driven via JSON templates
- **Dev/Kernel API split** — different surfaces depending on dev flag
- **Copy-on-write** — state cloned via structuredClone before exposure
- **Deterministic simulation** — weather, season, day phase derived from tick count
- **AI Strategy (M55)** — Multi-provider Gemini/Groq/Ollama with BYOK (Bring Your Own Key) for scale and Template Fallbacks for resilience.

---

## 3. Comprehensive File Index (AI-Optimized)

### 3.1 Core Design Specifications (`plans/01_CORE_DESIGN/`)
> **AI Usage:** Load these to understand world rules, mechanics, and lore.
| # | File | Internal Layer | One-Line Summary |
|---|---|---|---|
| 01 | [`01_META_AUTHORITY.md`](01_CORE_DESIGN/01_META_AUTHORITY.md) | I.1 | Reality layers, authority hierarchy, canon types |
| 02 | [`02_COSMOLOGY_METAPHYSICS.md`](01_CORE_DESIGN/02_COSMOLOGY_METAPHYSICS.md) | I.2–3 | Chaos Realm, Lux-Ar, time, souls, death |
| 03 | [`03_RACES_SPECIES_BIOLOGY.md`](01_CORE_DESIGN/03_RACES_SPECIES_BIOLOGY.md) | IV | Elfin, Beastkin, morphing, biology |
| 04 | [`04_MAGIC_SYSTEMS.md`](01_CORE_DESIGN/04_MAGIC_SYSTEMS.md) | VII.22 | 5 disciplines, costs, spell learning |
| 05 | [`05_COMBAT_SYSTEMS.md`](01_CORE_DESIGN/05_COMBAT_SYSTEMS.md) | VII.20–21 | Weapons, styles, resolution flow, health |
| 06 | [`06_BELIEF_LAYER_WTOL.md`](01_CORE_DESIGN/06_BELIEF_LAYER_WTOL.md) | VI | Belief attributes, obfuscation (WTOL) |
| 07 | [`07_FACTIONS_POLITICS.md`](01_CORE_DESIGN/07_FACTIONS_POLITICS.md) | II.6 | Faction taxonomy, attributes, power graphs |
| 08 | [`08_RELICS_ARTIFACTS.md`](01_CORE_DESIGN/08_RELICS_ARTIFACTS.md) | VIII | Relics of Virtue, Weapons of Sin, crafting |
| 09 | [`09_HISTORICAL_TIMELINE.md`](01_CORE_DESIGN/09_HISTORICAL_TIMELINE.md) | III | Major eras, canonical events, timeline DB |
| 10 | [`10_PLAYABLE_CHARACTERS_MORPHING.md`](01_CORE_DESIGN/10_PLAYABLE_CHARACTERS_MORPHING.md) | V.14, IV.11 | Attributes, morphing, character creation |
| 11 | [`11_PLAYER_PROGRESSION_LEVELING.md`](01_CORE_DESIGN/11_PLAYER_PROGRESSION_LEVELING.md) | X.29 | XP table, skill trees, level-up flow |
| 12 | [`12_QUEST_SYSTEM.md`](01_CORE_DESIGN/12_QUEST_SYSTEM.md) | X.28 | Quest types, Tracking, generation |
| 13 | [`13_INVENTORY_CRAFTING.md`](01_CORE_DESIGN/13_INVENTORY_CRAFTING.md) | VIII.24 | Inventory UI, items, crafting, resources |
| 14 | [`14_NPC_SYSTEM.md`](01_CORE_DESIGN/14_NPC_SYSTEM.md) | V.15–16 | NPC types, DM Synthesis, patrol |
| 15 | [`15_RANDOM_ENCOUNTERS_EXPLORATION.md`](01_CORE_DESIGN/15_RANDOM_ENCOUNTERS_EXPLORATION.md) | IX | Encounter weighting, rare entities |
| 16 | [`16_FACTION_POWER_DYNAMICS.md`](01_CORE_DESIGN/16_FACTION_POWER_DYNAMICS.md) | IX.26–27 | Influence metrics, emergent politics |
| 17 | [`17_SESSION_CONTINUITY.md`](01_CORE_DESIGN/17_SESSION_CONTINUITY.md) | XII.35 | Persistence, tracked components, rollback |
| 18 | [`18_ANTI_METAGAMING.md`](01_CORE_DESIGN/18_ANTI_METAGAMING.md) | XI.33 | Knowledge rules, DM enforcement |
| 19 | [`19_ENDGAME_REPLAYABILITY.md`](01_CORE_DESIGN/19_ENDGAME_REPLAYABILITY.md) | X.30 | Triggers, conclusions, legacy, seeds |
| 20 | [`20_ALPHA_DATA_SCHEMA.md`](01_CORE_DESIGN/20_ALPHA_DATA_SCHEMA.md) | XII.34 | DB schema, operational flow, AI DM rules |
| 28 | [`28_CHRONO_ACTION_PIPELINE.md`](01_CORE_DESIGN/28_CHRONO_ACTION_PIPELINE.md) | XI.32 | Action-driven time model, tick costs |

### 3.2 Technical & Implementation Specs (`plans/02_TECHNICAL_SPEC/`)
> **AI Usage:** Load these to understand how specific features were coded.
- [Combat Arena](02_TECHNICAL_SPEC/COMBAT_ARENA_IMPLEMENTATION.md)
- [Audio Resilience](02_TECHNICAL_SPEC/AUDIO_RESILIENCE_IMPLEMENTATION.md)
- [Milestone 28 Guide](02_TECHNICAL_SPEC/MILESTONE_28_DEVELOPER_GUIDE.md)

### 3.3 Historical Logs & Milestones (`plans/03_HISTORY_LOGS/`)
> **AI Usage:** Reference for project history, past decisions, and completed tasks.
- [Roadmap (Current)](03_HISTORY_LOGS/28_ROADMAP.md)
- [M55 Summary](03_HISTORY_LOGS/55_PROSPERITY_WHISPERS.md)
- [M54 Summary](03_HISTORY_LOGS/54_RESTORATION_MEMORY.md)
- [Phase 30 Complete](03_HISTORY_LOGS/PHASE_30_COMPLETE.md)

### 3.4 Beta Readiness & AI Testing (`plans/04_BETA_READINESS/`)
> **AI Usage:** Critical for current Beta phase (M55+).
- [Beta Readiness Roadmap](04_BETA_READINESS/BETA_READINESS_ROADMAP.md)
- [AI Weaver Beta Testing](04_BETA_READINESS/AI_WEAVER_BETA_TESTING.md)
- [Beta Graduation Report](04_BETA_READINESS/BETA_GRADUATION_REPORT.md)

### 3.5 External Guides (`plans/guides/`)
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

AI Weaver Beta Testing (New) ← `plans/AI_WEAVER_BETA_TESTING.md`
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
