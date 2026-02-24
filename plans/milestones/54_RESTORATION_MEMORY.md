# Milestone 54: The Path of the Weaver — Restoration & Living Memory

> **Status:** COMPLETED (Verified February 19, 2026)  
> **Category:** ROADMAP  
> **Phase:** Alpha Expansion (Generational Bridge)

---

## 54.1 Milestone Objectives

Milestone 54 focuses on closing the loop of the generational cycle. While M53 enabled the "Shift" and archived the past, M54 makes that past **interactable** and **reclaimable**. We introduce the first mechanics for healing the world's scars and the "Living Memory" system powered by sustainable AI integration.

| Objective | Success Criterion | Status |
|---|---|---|
| **World Restoration** | Players can 100% heal a World Scar, restoring its original biome | **DONE** |
| **Living Memory (AI)** | NPCs reference specific Grand Deeds from the player's ancestor in dialogue | **DONE** |
| **Ancestral Bloodlines** | Faction reputation partially carries over between generations (Grudges/Favors) | **DONE** |
| **Restoration Rewards** | Healing a scar 100% reveals a "Relic of Virtue" unique to that location | **DONE** |
| **Timeline Genealogy** | The Loom UI visualizes the player's direct bloodline and spiritual lineage | **DONE** |

---

## 54.2 AI Integration Strategy (The Weaver's Voice)

To scale Project Isekai while keeping it free for developers and players, we adopt a hybrid AI strategy:

### 1. Hybrid Provider Model
- **Development/Solo**: **Google Gemini 1.5 Flash** (Free Tier: 15 RPM).
- **Production (Deployment)**: **BYOK (Bring Your Own Key)**. Players input their own free Gemini API key in a settings menu (stored in `localStorage`).
- **Local Fallback**: Support for **Ollama (Llama 3)** if the user has hardware (Optional).
- **Hard Fallback**: **Template Library**. If AI is unavailable or rate-limited, pull category-specific strings from `WorldState.fallbackTemplates`.

### 2. Dialogue Caching & Optimization
- **Session Cache**: `WorldState.dialogueCache` stores `npcId -> { promptHash -> response }`. Same prompts never hit the API twice.
- **Global Semantic Cache**: (Future) Shared Supabase/Redis table for identical NPC + Player prompt pairs across all users.
- **Prompt Mapping (M54-B1)**: Inject only relevant "Historical Scraps" (3-4 most significant deeds) from `chronicleEngine` into the prompt to save tokens and improve relevance.

---

## 54.3 Task Breakdown

### M54-A1: The Restoration Ritual (World Healing)
- **Status**: **COMPLETE**
- **Action**: `HEAL_WORLD_SCAR` added to `actionPipeline.ts`.
- **Cost**: 50 Resonance + 20 Merit.
- **Effect**: Increases `healingProgress` of a target `WorldScar`.
- **Restoration**: At 100% healing, the `Location` biome is "restored" to its original state (or a "Blessed" version), clearing harmful modifiers instantly.

### M54-B1: Historical Narrative Synthesis (AI DM)
- **Status**: **COMPLETE**
- **Engine**: `aiDmEngine.ts` updated with Gemini 1.5 Flash fetch logic.
- **Context**: Map `Grand Deeds` and `WorldScars` into the NPC's `NpcKnowledgeScope`.
- **Validation**: Ensure AI responses stay within a 2-sentence limit to preserve "Chat-like" feel.
- **Fallbacks**: Implement the switch logic from `Gemini -> Local -> Template`.

### M54-C1: Ancestral Bloodlines (Reputation Carryover)
- **Status**: **COMPLETE**
- **Grudges**: Factions hostile to the ancestor (-50) start at -20 with the descendant.
- **Favors**: Factions friendly to the ancestor (+50) start at +15.
- **Logic**: Implemented in `chronicleEngine.initiateChronicleTransition`.

### M54-D1: Epoch-Locked Relics
- **Status**: **COMPLETE**
- **Mechanism**: `worldScarsEngine` tracks if a scar was "Fully Healed."
- **Spawn**: Spawns a `UniqueItem` (Relic) in the the healed location's inventory.

### M54-E1: Timeline Genealogy (The Loom V2)
- **Status**: **COMPLETE**
- **UI**: Vertical lineage tree in `ChronicleHistory.tsx`.
- **Visuals**: Distinct markers for "Bloodline Nodes" (player characters) vs "World Event Nodes".

---

## 54.4 Codebase Impact

| File | Status | Change Description |
|---|---|---|
| `worldEngine.ts` | **DONE** | Add `dialogueCache` and `fallbackTemplates` to `WorldState`. |
| `actionPipeline.ts` | **DONE** | Implement `HEAL_WORLD_SCAR` action type. |
| `aiDmEngine.ts` | **DONE** | Implement Gemini Flash fetcher + BYOK logic. |
| `chronicleEngine.ts` | **DONE** | Implement Ancestral Bloodline (reputation) carryover. |
| `Codex.tsx` | **DONE** | Add "Weaver Connection" (BYOK) settings sub-panel. |
| `ChronicleHistory.tsx` | **DONE** | Add lineage visualization. |

---

## 54.5 Success Gates (Criteria)
- [x] Player can heal a "Battlefield" scar and see it change to "Meadow."
- [x] Talking to an NPC near a scar triggers an AI response referencing that scar.
- [x] No API key at initialization fails gracefully to Template Fallbacks.
- [x] Faction reputation at start of Epoch II is non-zero (based on Epoch I).
- [x] Build passes with 0 new TypeScript errors.

---
**Next Milestone: [Prosperity & Whispers (M55)](milestones/55_PROSPERITY_WHISPERS.md)**
