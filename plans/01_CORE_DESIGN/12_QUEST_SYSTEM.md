# 12 — Quest System & Narrative Hooks

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `07_FACTIONS_POLITICS.md`, `14_NPC_SYSTEM.md`

Fully integrates tracking, branching objectives, faction-driven tasks, and AI DM orchestration,
along with a player-visible journal/quest tab for UI display.

---

## 12.1 Core Principles

- Dynamic quest generation: quests can be canonical, emergent, or player-triggered
- Narrative hooks: every quest ties into Belief Layer, Faction Graphs, WTOL, and timeline
- Player agency: choices influence factions, emergent events, and future quest availability
- Visibility & tracking: all active, completed, and failed quests tracked in journal/quest tab
- Replayability: randomized events, NPC involvement, and faction interactions ensure uniqueness

---

## 12.2 Quest Types

| Type | Description | AI DM Usage |
|---|---|---|
| **Canonical Quests** | Fixed storyline events, tied to lore and timeline | Ensure narrative continuity |
| **Faction Quests** | Requests from factions, guilds, or cults | Influence power graphs and belief |
| **Emergent Quests** | Generated dynamically based on player actions or world events | Branching outcomes; replayability |
| **Artifact Quests** | Focus on minor artifacts, relic hints, or runic gear | Risk/reward; integrates crafting and lore |
| **Exploration Quests** | Discover hidden areas, nodes, or lore fragments | World engagement, Belief Layer updates |
| **Challenge Quests** | Combat, puzzle, or environmental challenges | Skill and morphing mechanics tested |

---

## 12.3 Quest Structure

Each quest has:
- **Quest ID / Title**
- **Quest Type** (Canonical, Faction, Emergent, Artifact, Exploration, Challenge)
- **Description / Lore Context**
- **Objectives** (primary, optional, hidden)
- **Faction Influence** (affects Belief Layer, WTOL, or faction graphs)
- **Rewards:** XP, stat points, skill points, morphing adjustments, artifacts, crafting materials
- **Dependencies:** pre-requisite quests or events, conditional branching
- **Completion Conditions** (all primary objectives completed)
- **Failure Conditions** (time limits, faction penalties, death, wrong choices)
- **Narrative Hooks** (future emergent quests triggered by completion or failure)
- **Quest Status:** Active / Completed / Failed / Hidden

---

## 12.4 Quest Tracking & Journal System

### UI Integration
- **Quest Tab / Journal:** displays all quests, objectives, progress, faction reputation changes
- **Filters:** by type, faction, priority, or location
- **Tooltip / Lore Context:** partial hints or WTOL-masked info for hidden objectives

### Database Tables

| Table | Key Fields |
|---|---|
| **QuestMaster** | quest_id, title, type, description, faction_id, reward_xp, reward_items, dependencies, creation_source, visibility_flag |
| **QuestObjectives** | quest_id, objective_id, description, type (primary/optional/hidden), completion_flag, progress_value |
| **QuestProgress** | character_id, quest_id, objective_id, progress_value, status, timestamp |
| **QuestLog** | character_id, quest_id, start_time, end_time, completion_status, reward_claimed |

---

## 12.5 Quest Generation Mechanics

- **AI DM generates quests:** checks world state, faction status, Belief Layer, WTOL, artifacts, emergent history; ensures difficulty and reward scale with player level
- **Branching quests:** multiple completion methods; optional hidden objectives for extra rewards or lore
- **Faction-driven quests:** diplomacy, combat, resource acquisition, artifact retrieval; reputation adjustments
- **Emergent quests:** triggered dynamically by player choices or random world events (monster incursions, rival faction plots, artifact corruption events)

---

## 12.6 Rewards & Balancing

- **XP & Level Progression:** scaled based on objective difficulty
- **Skill & Morphing Points:** encourage diversified builds
- **Artifacts / Crafting Materials:** lower-tier accessible, higher-tier reserved for narrative events
- **Faction Reputation / Belief Updates:** alters future emergent quests and world perception

---

## 12.7 AI DM Enforcement Rules

- **Consistency with Canon:** Canonical quests cannot break historical or lore constraints
- **WTOL Compliance:** Hidden objectives and lore hints revealed progressively
- **Dynamic Scaling:** AI DM adjusts objectives, difficulty, and rewards to player progression
- **Quest Conflict Resolution:** AI DM resolves conflicts between simultaneous faction quests
