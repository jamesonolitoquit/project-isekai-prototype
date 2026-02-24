# Milestone 55: Prosperity & Whispers — Scalable AI & Social Life

> **Status:** ACTIVE  
> **Category:** ROADMAP  
> **Updated:** February 19, 2026  
> **Phase:** Alpha Expansion (AI & Social Autonomy)

---

## 55.1 Milestone Objectives

Milestone 55 focuses on scaling the AI systems for unlimited free play through multi-provider BYOK (Bring Your Own Key) and deeper systemic NPC life. We move from "talking to NPCs" to NPCs "talking to each other" through gossip and trading rumors.

| Objective | Success Criterion | Status | Component |
|---|---|---|---|
| **AI Multi-Provider** | Support for Gemini, Groq, and Ollama with dynamic routing | **IN-PROGRESS** | M55-A1 |
| **Systemic Gossip** | NPCs exchange rumors autonomously when co-located for >50 ticks | **IN-PROGRESS** | M55-B1 |
| **Regional Trade** | NPCs harvest and trade biome-specific resources (e.g., Cursed Locus) | **IN-PROGRESS** | M55-C1 |
| **Architect's Forge** | Players can live-edit world blueprints with instant state mutation | **NOT-STARTED** | M55-D1 |
| **Weaver's Settings** | UI for managing multiple API keys and provider preferences (BYOK) | **NOT-STARTED** | M55-E1 |

---

## 55.2 Technical Strategy

### 1. Multi-Provider Dispatcher (M55-A1)
- **Routing**: `Gemini 1.5 Flash` (Default) → `Groq (Llama 3)` (High speed) → `Ollama` (Local) → `Template Fallback`.
- **BYOK Storage**: Keys for all providers stored independently in `localStorage` via the new Weaver Settings UI.
- **Cost Efficiency**: Dialogue caching prevents duplicate calls across all providers.

### 2. Social Autonomy Engine (M55-B1)
- **Rumor Propagation**: Rumors are now physical data objects in `npc.rumors[]`.
- **Gossip Trigger**: `NpcSocialAutonomyEngine` tracks `coLocationTicks`. When a threshold (50) is hit, a `GOSSIP` interaction is triggered, transferring 1 random rumor.
- **Rumor Distortion**: (Future) Rumors gain +10% "Distortion" with each transfer, affecting accuracy.

### 3. Regional Economy (M55-C1)
- **Harvesting**: New action `HARVEST_RESOURCE` in `actionPipeline.ts`.
- **Biome Loot Tables**:
    - **Corrupted**: Cursed Locus, Tainted Essence.
    - **Cave**: Blessed Crystal, Stone Fragment.
    - **Forest**: Radiant Herbs, Ancient Wood.
- **Inventory**: NPCs now use the standard `InventoryItem` type, allowing players to trade with or steal from them.

---

## 55.3 Task Breakdown

### M55-A1: AI Weaver Dispatcher (Multi-Provider)
- [x] Gemini 1.5 Flash support.
- [ ] Groq (OpenAI-compatible) support in `aiDmEngine.ts`.
- [ ] Ollama support for local-hosted AI.
- [x] Multi-provider routing in `callLlmApi()`.

### M55-B1: Social Autonomy (NPC Gossip Hubs)
- [x] Added `rumors` and `coLocationTicks` to `NPC` type.
- [x] Added `trading_rumors` goal to `GOAP`.
- [ ] Implement `GOSSIP` intent logic in `npcSocialAutonomyEngine.ts`.
- [ ] Implement rumor transfer in `completeAction` (`goalOrientedPlannerEngine.ts`).

### M55-C1: Regional Trade & Harvesting
- [x] Implement `HARVEST_RESOURCE` in `actionPipeline.ts`.
- [ ] Add `inventory` property to all NPCs.
- [ ] Create `TRADE_ITEMS` goal for social exchange of resources.

### M55-D1: Architect's Forge (Live Mutation)
- [ ] Update `ArchitectForge.tsx` to mutate live `WorldState` instead of just previews.
- [ ] Implement AJV schema validation for live hot-swaps.

### M55-E1: Weaver's Settings (BYOK UI)
- [ ] Create `WeaverSettings.tsx` (Model settings, API keys, provider toggle).
- [ ] Integrate into `GlobalHeader.tsx` or `Codex.tsx`.

---

## 55.4 Codebase Impact

| File | Status | Change Description |
|---|---|---|
| `aiDmEngine.ts` | **Update** | Add Groq/Ollama fetchers and routing. |
| `worldEngine.ts` | **Update** | Add `inventory` to `NPC` type. |
| `npcSocialAutonomyEngine.ts` | **Update** | Implement gossip trigger based on `coLocationTicks`. |
| `goalOrientedPlannerEngine.ts` | **Update** | Complete action effects for rumors and trade. |
| `ArchitectForge.tsx` | **Update** | Enable live state mutation. |
| `WeaverSettings.tsx` | **New** | BYOK API config UI. |

---

## 55.5 Success Gates (Criteria)
- [ ] Player can use an Ollama instance for dialogue by changing setting.
- [ ] Two NPCs meeting in a tavern exchange a rumor seen in debug logs.
- [ ] NPCs in Corrupted biomes accumulate "Cursed Locus" in their inventory.
- [ ] Architect's Forge changes a location's name and it updates in the `Codex` instantly.
- [ ] Build passes with 0 errors.

---
**Dependencies: [M54: Restoration & Memory](milestones/54_RESTORATION_MEMORY.md)**
