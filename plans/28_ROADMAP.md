# 28 — Development Roadmap

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: ALL plan files (00–27)

Single source of truth for **what ships when**. Design layers (01–27) describe *what* each system is;
this file describes *when* each system gets built and the acceptance criteria for each phase gate.

---

## 28.1 Phase Summary

| Phase | Goal | Player Experience When Done |
|---|---|---|
| **Prototype** | Core foundations | Solo player can explore, fight, talk to NPCs, complete quests, save/load, see world state change |
| **Alpha** | Expanded functionality | Deeper AI DM, player-created content, procedural events, visual enhancements, analytics |
| **Beta** | Multiplayer & advanced systems | Co-op/competitive play, cross-session continuity at scale, community content, advanced AI visuals |
| **Future** | Long-term vision | Fully modular sandbox RPG, marketplace, large-scale multiplayer, real-time AI asset generation |

---

## 28.2 Phase 1 — Prototype: Core Foundations

**Goal:** Establish a functional, solo-first, AI-driven tabletop RPG to test mechanics, world persistence, and basic AI DM functionality.

### Features

| Feature | Description | Plan Files | Engine Files | DB Tables |
|---|---|---|---|---|
| Core Gameplay Loop | Exploration, combat, social interactions, decision-making | 05, 10, 11, 12, 14 | actionPipeline.ts, worldEngine.ts, ruleEngine.ts | Characters, QuestMaster, QuestProgress |
| Solo-First Play | Onboarding, accessible mechanics, AI DM–guided sessions | 01, 14 | npcEngine.ts, worldEngine.ts | NPC_Master, NPC_Dialogue |
| Persistent World State | Track player actions, NPCs, and evolving world variables | 17, 20 | mutationLog.ts, stateRebuilder.ts, worldEngine.ts | MutationLog, Checkpoints, SessionMeta |
| Lore Integration | Modular templates: generic fantasy, Luxfier, or minimal player-created | 02, 06, 09 | worldEngine.ts | Realms, Regions, BeliefLayers |
| Snapshot & Rollback | Safe testing of mutable world states | 17 | saveLoadEngine.ts, stateRebuilder.ts | Checkpoints, SaveSlots |
| Portal-Themed UI/UX | Landing → login → main world experience | — | App.tsx, client components | — |
| Replayability Validation | Confirm choices have lasting effects | 19 | mutationLog.ts, worldEngine.ts | MutationLog, EmergentHistory |

### Acceptance Criteria

- [ ] Solo player can create a character (race, stats, name)
- [ ] World loads from a JSON template (Luxfier or generic)
- [ ] Player can explore at least 3 regions with sub-areas
- [ ] Combat resolution works for 1v1 and 1vN encounters
- [ ] At least 1 complete quest chain (3+ objectives) is completable
- [ ] NPC dialogue responds to player choices and belief state
- [ ] World state persists across save/load cycles
- [ ] Snapshot and rollback restore valid prior state
- [ ] Hash-chain integrity verified on every load
- [ ] UI renders world state, inventory, quest log, and NPC interaction

### Codebase Targets

| Component | Current Status | Prototype Target |
|---|---|---|
| mutationLog.ts | Hardened (~98% coverage) | Working — no changes needed |
| worldEngine.ts | Core working | Working — add template loading, quest dispatch |
| actionPipeline.ts | Stub | Working — validate + dispatch player actions |
| stateRebuilder.ts | Stub | Working — replay from checkpoint |
| saveLoadEngine.ts | Stub | Working — save slots, snapshot creation, load flow |
| ruleEngine.ts | Stub | Working — basic combat resolution, stat checks |
| npcEngine.ts | Stub | Working — dialogue, basic AI behavior |
| constraintValidator.ts | Stub | Partial — validate actions against canon |
| canonJournal.ts | Stub | Partial — record hard/soft canon events |
| luxfier-world.json | Minimal stub | Working — full Luxfier Alpha template |
| luxfier-world.schema.json | Missing | Working — Ajv-validated schema |
| UI Components | Many missing | Working — core panels (World, Quest, Inventory, Dialogue, Player) |
| Server (Express) | Stub | Working — serve API, static assets, session management |

---

## 28.3 Phase 2 — Alpha: Expanded Functionality

**Goal:** Introduce more depth, immersion, and modularity for richer solo-first gameplay.

### Features

| Feature | Description | Plan Files | New/Extended Engine Files |
|---|---|---|---|
| Enhanced AI Dungeon Master | Adaptive storylines, NPC behavior, and world events | 01, 06, 14, 18 | npcEngine.ts, ruleEngine.ts, new: aiDmEngine.ts |
| Player-Created Content | Custom characters, loot, minor rulesets, and basic templates | 10, 13, 08 | new: templateEditor.ts, worldEngine.ts |
| Visual Enhancements | AI-generated maps, images, and assets for immersion | — | new: assetGenerator.ts, client components |
| Procedural Events & Challenges | Auto-generated side quests, encounters, environmental hazards | 12, 15, 16 | new: proceduralEngine.ts, weatherEngine.ts, seasonEngine.ts |
| Persistent & Replayable Worlds | Snapshots, rollbacks, and evolving game state tested at scale | 17, 19 | saveLoadEngine.ts, stateRebuilder.ts |
| Analytics & Feedback Loops | Track decisions for smarter AI adaptation | 18, 19 | new: analyticsEngine.ts |
| Expanded Lore Templates | Flexible story modules for longer campaigns | 02, 09 | worldEngine.ts |

### Acceptance Criteria

- [ ] AI DM adapts narrative pacing based on player behavior
- [ ] Players can create and save custom character templates
- [ ] At least 1 AI-generated visual per session (map or NPC portrait)
- [ ] Procedural side quests generate from world state (not hard-coded)
- [ ] Weather and season systems affect gameplay (encounters, NPC schedules)
- [ ] Particle engine renders environmental effects
- [ ] Analytics dashboard shows decision patterns (dev-only)
- [ ] 3+ lore templates available (Luxfier, generic fantasy, minimal sandbox)
- [ ] Save/load stress-tested with 1000+ mutation log entries

### Codebase Targets

| Component | Alpha Target |
|---|---|
| aiDmEngine.ts | New — adaptive storytelling, NPC orchestration, event pacing |
| templateEditor.ts | New — player-facing template creation and validation |
| assetGenerator.ts | New — AI image/map generation integration |
| proceduralEngine.ts | New — quest/encounter generation from world state |
| analyticsEngine.ts | New — decision tracking, pattern analysis |
| weatherEngine.ts | Working — dynamic weather affecting gameplay |
| seasonEngine.ts | Working — seasonal cycles, event triggers |
| particleEngine.ts | Working — environmental visual effects |
| npcEngine.ts | Enhanced — adaptive behavior, schedules, emergent reactions |
| ruleEngine.ts | Enhanced — procedural quest validation, complex stat checks |

---

## 28.4 Phase 3 — Beta: Multiplayer & Advanced Systems

**Goal:** Enable multiplayer, co-DM support, and fully persistent worlds with advanced AI capabilities.

### Features

| Feature | Description | Plan Files | New/Extended Systems |
|---|---|---|---|
| Multiplayer & Co-DM | Collaborative/competitive play with AI-assisted DM management | 17, 01 | new: multiplayerEngine.ts, sessionSync.ts |
| Cross-Session Continuity | Maintain lore, faction reputations, and long-term consequences | 17, 16, 07, 09 | stateRebuilder.ts, new: persistenceService.ts |
| Advanced AI Visuals | Dynamic real-time generation of maps, assets, NPC illustrations | — | assetGenerator.ts (enhanced) |
| Procedural World Evolution | Dynamic events, quests, faction interactions scale across sessions | 15, 16, 19 | proceduralEngine.ts, worldEngine.ts (enhanced) |
| Community Content Integration | Shareable templates, mods, AI scenario scripting | — | new: modManager.ts, templateMarketplace.ts |
| Player Feedback-Driven AI | Adaptive AI that evolves with player base and session outcomes | 18, 19 | analyticsEngine.ts, aiDmEngine.ts (enhanced) |

### Acceptance Criteria

- [ ] 2–6 players in a shared session with synchronized world state
- [ ] Co-DM mode: human DM + AI DM collaborate on narrative
- [ ] Faction reputations and world mutations persist across 10+ sessions
- [ ] Real-time AI-generated maps update as players explore
- [ ] Community templates can be imported/exported
- [ ] AI DM behavior measurably improves from aggregated session data

---

## 28.5 Phase 4 — Future Plans: Long-Term Vision

**Goal:** Transform Project Isekai into a fully modular, immersive, community-driven sandbox RPG.

### Features

| Feature | Description |
|---|---|
| Custom Worlds & Templates | Fully modular campaigns, maps, and lore created by players |
| Expanded Multiplayer & Co-DM | Large-scale cooperative/competitive play with AI moderation |
| Advanced Dynamic AI Storytelling | Complex NPC networks, adaptive questlines, persistent world evolution |
| AI-Generated Visuals & Assets | Images, maps, items, and environmental assets generated in real time |
| Persistent & Replayable Worlds | Snapshots, rollbacks, evolving states, and long-term consequences |
| Player-Created Content | Characters, loot, rulesets, and shared templates |
| Procedural Events & Challenges | Auto-generated encounters, quests, and environmental hazards |
| Analytics & Player Feedback Loops | Data-driven AI improvements and personalized storytelling |
| Modding & Community Expansion | User mods, AI scenario scripting, template sharing, marketplace potential |

---

## 28.6 Phase-to-File Mapping (Quick Reference)

Shows which plan files are **primary** implementation targets per phase.

| Phase | Primary Plan Files | Foundation Files (always referenced) |
|---|---|---|
| Prototype | 05, 10, 11, 12, 13, 14, 17 | 01, 02, 03, 04, 06, 20 |
| Alpha | 08, 09, 15, 16, 18, 19 | 01, 02, 06, 20 |
| Beta | 07, 16, 17, 19 | 01, 06, 20 |
| Future | All | All |
| SQL Seeds (21–27) | Prototype: 21–23, 27 (core tables) / Alpha: 24–26 (extended NPCs, locations) | 20 |

---

## 28.7 Phase Dependencies

```
Prototype ──► Alpha ──► Beta ──► Future
    │            │         │
    │            │         └─ Requires: stable multiplayer, persistence at scale
    │            └─ Requires: working procedural systems, AI DM, analytics
    └─ Requires: core loop, save/load, basic AI DM, world template, UI
```

**Hard rule:** No phase begins until its predecessor's acceptance criteria are met. AI models should not implement Alpha-scope features while Prototype acceptance criteria remain incomplete.

---

## 28.8 Notes for AI Models

- **Coder:** Check this file before starting work. If a feature belongs to a later phase, do not implement it — focus on current phase acceptance criteria.
- **Planner:** Update acceptance criteria checkboxes as features are verified. Add new criteria as scope clarifies.
- **Debugger:** Phase context determines which systems should be "Working" — reference Section 28.2/28.3 codebase targets.
- **Reviewer:** Verify that PRs do not introduce out-of-phase dependencies.
