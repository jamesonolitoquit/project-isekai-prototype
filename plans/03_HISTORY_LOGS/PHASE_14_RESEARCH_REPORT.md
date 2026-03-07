# Phase 14 Research Report – The Alchemical & Material Manifest

**Date**: February 26, 2026  
**Status**: Discovery Complete → Implementation Starting  
**Context**: Transitioning from stat-heavy simulation to material-aware world state

---

## Executive Summary

The workspace has been successfully reorganized into a clean, production-ready build state. Phase 14 research reveals that the engine contains dormant but well-architected systems for crafting, artifacts, and AI-driven narrative synthesis. The task now is to **activate these systems** by:

1. Creating the **Alchemical Manifest** – a unified data registry for items, loot tables, and recipes
2. Hardening the **AI Weaver** integration to synthesize narrative weight into material objects
3. Connecting mechanical systems (crafting, artifact sentience, search logic) to world state updates

---

## Discovery Findings

### Engine Architecture Survey
**Scanned**: `BETA/src/engine/` (17 TODO/stub markers)  
**Key Files Located**:
- `artifactEngine.ts` – Artifact mood tracking (bloodthirsty, curious)
- `craftingEngine.ts` – Recipe resolution and material consumption
- `aiDmEngine.ts` – Core AI Dungeon Master simulation
- `questSynthesisAI.ts` – Quest narrative generation
- `weaver-dm.md` – Atmospheric tone definitions and Paradox-aware prompts

### AI Services Architecture
**Service Layer**:
- `AIService.ts` – Central AI orchestration (300+ lines)
- `aiStoryService.ts` – Legacy story service (migrate to unified pipeline)

**Prompt Registry**:
- `weaver-dm.md` – Dynamically loaded DM prompts defining:
  - Atmospheric Tone (5 levels)
  - Glitch tiers (30%, 60%, 85% Paradox intensity)
  - NPC dialect modulation
  - Item description flavor rules

### Data Schema Status
**Current State**:
- `luxfier-world.schema.json` – Missing arrays for `itemTemplates`, `lootTables`, `craftingRecipes`
- `demo-fantasy-world.json` – Structure exists but no item registries populated

### Mechanical Stubs
**Identified but Inactive**:
- `CRAFT` action in `actionPipeline.ts` (stub implementation)
- `SEARCH` logic in `worldFragmentEngine.ts` (no loot table integration)
- Artifact tick updates (sentience not wired to world engine)

---

## Phase 14 Implementation Roadmap

### Stage 1: The Alchemical Manifest (Data Registry)
**Objective**: Create unified item/loot/recipe data model

#### 1.1 Schema Extension
- [x] Update `luxfier-world.schema.json` with:
  - [x] `itemTemplates` array (Base Materials, Artifacts, Consumables)
  - [x] `lootTables` array (location-specific drops)
  - [x] `craftingRecipes` array (material → item transformations)
  - [x] Quality tiers (common, uncommon, rare, relic)

#### 1.2 Data Seeding
- [x] Populate `demo-fantasy-world.json` with:
  - [x] **Base Materials**: Starlight Iron, Echoing Moss, Void Ash, Spirit Silk
  - [x] **Loot Tables**:
    - Grasslands: Common herbs, copper ore
    - Ruins: Ancient fragments, cursed shards
    - Caverns: Luminous gems, deep metals
  - [x] **Relic Templates**: The Aegis Blade (artifact demo tied to `artifactEngine`)

### Stage 2: AI Weaver – The Narrative Link
**Objective**: Connect narrative engine to material objects

#### 2.1 Prompt Registry Implementation
- [x] Create `promptRegistry.ts` utility:
  - [x] Dynamically manage paradox tiers (0%, 30%, 60%, 85%)
  - [x] Parse Atmospheric Tone rules (low/medium/high paradox)
  - [x] Expose methods: `getItemFlavor()`, `getNpcDialect()`, `getGlitchTier()`

#### 2.2 Service Consolidation
- [x] Migrate `aiStoryService.ts` logic into unified AIService pipeline
  - [x] Implement `synthesizeItemDescription()` method
  - [x] Implement `analyzeStoryForSeeds()` (Phase 7 → Phase 14 migration)
  - [x] Implement `synthesizeNpcDialogueEnhanced()` method
  - Input: Base item template + world state (Paradox %)
  - Output: Narrative-rich item description with mood/tone alignment

#### 2.3 Paradox-Aware UI
- [x] Implement Glitch tiers in promptRegistry:
  - [x] **Tier 1 (30%)**: Subtle markers (occasional text glitches)
  - [x] **Tier 2 (60%)**: Moderate paradox (shifted descriptions)
  - [x] **Tier 3 (85%)**: Severe glitch (reversed text, meta-references)

### Stage 3: Mechanical Hardening
**Objective**: Wire systems together and activate action handlers

#### 3.1 Artifact Sentience Loop
- [x] Connect `artifactEngine.ts` moods to world state updates
- [x] Implement `artifactSentienceLoop.ts` with:
  - [x] Mood state updates (bloodthirsty, curious, sullen, protective)
  - [x] Natural mood decay over time
  - [x] Mood-influenced stat bonuses
  - [x] Contextual artifact dialogue generation

#### 3.2 Crafting Action Pipeline
- [x] Verify `CRAFT_ITEM` action in `actionPipeline.ts`:
  - [x] Consume materials from player inventory
  - [x] Use `craftingEngine.ts` for recipe resolution
  - [x] Generate output item with quality modifiers
  - [x] Log transaction to action history

#### 3.3 Search and Loot Discovery
- [x] Enhance `SEARCH_AREA` action in `actionPipeline.ts`:
  - [x] Query location and regional biomes
  - [x] Roll against lootTables for item discovery
  - [x] Weight rolls by player stats and world state

### Stage 4: Verification & Testing
**Objective**: Ensure data integrity and synthesis quality

#### 4.1 Registry Validation
- [x] Create `verify-world.ts` script:
  - [x] Validate all lootTable references → valid itemTemplates
  - [x] Check for orphaned recipes (missing ingredients)
  - [x] Report schema compliance
  - [x] Cross-reference validation (items used in loot/recipes)

#### 4.2 Synthesis Testing
- [x] Create `test-weaver-synthesis.ts`:
  - [x] Test item flavor generation at 0%, 50%, 100% Paradox
  - [x] Verify Atmospheric Tone consistency
  - [x] Validate NPC dialect changes
  - [x] Test glitch tier thresholds
  - [x] Verify fallback responses

---

## Key Architectural Decisions

**Decision 1: Prompt Centralization**
- All AI prompt logic lives in `prompts/` folder
- Prevents "Prompt Drift" between Coder and World Author roles
- Single source of truth for Atmospheric Tone and Paradox behavior

**Decision 2: Loot Table Over Hardcoding**
- Items drop via data-driven `lootTables`, not hardcoded drop rates
- Enables AI Weaver to later manipulate drop rates based on "Narrative Attrition" (scarcity mechanics)
- Supports dynamic world balancing

**Decision 3: Service Layer Consolidation**
- Unified `AIService.ts` handles all narrative synthesis
- Legacy `aiStoryService.ts` migrated into unified pipeline
- Reduces service fragmentation and improves maintainability

---

## Implementation Dependencies

1. **Schema first**: Cannot seed data without schema
2. **Registry utility second**: Cannot synthesize narratives without prompt loading
3. **Action handlers third**: All systems depend on unified data model
4. **Testing last**: Verification suite validates everything

## Resource Links

- Engine: [artifactEngine.ts](BETA/src/engine/artifactEngine.ts)
- Engine: [craftingEngine.ts](BETA/src/engine/craftingEngine.ts)
- Engine: [aiDmEngine.ts](BETA/src/engine/aiDmEngine.ts)
- Prompts: [weaver-dm.md](BETA/src/engine/prompts/weaver-dm.md)
- Schema: [luxfier-world.schema.json](BETA/src/data/luxfier-world.schema.json)

---

## Next Steps

→ **Begin Stage 1: Alchemical Manifest** (schema + data seeding)
