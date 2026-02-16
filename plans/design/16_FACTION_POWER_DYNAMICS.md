# 16 — Faction Power Dynamics & Inter-Faction Conflicts

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `07_FACTIONS_POLITICS.md`, `06_BELIEF_LAYER_WTOL.md`

Runtime mechanics for faction power graphs, conflict resolution, and player-driven influence.

---

## 16.1 Core Principles

- Dynamic Power Graphs: faction influence changes in real-time based on player actions, emergent events, and world state
- Inter-faction conflicts: diplomacy, warfare, trade disputes, religious schisms, cult infiltration
- Player agency: player choices directly shift power graphs, alliances, and hostilities
- AI DM mediation: ensures conflicts remain consistent with canon and belief layer
- Replayability: faction dynamics differ per playthrough due to emergent history

---

## 16.2 Power Graph Mechanics

### Nodes
Each faction is a node with attributes:
- **Influence Score** (0–100): political and military weight
- **Territory Control**: regions/sub-areas under faction dominance
- **Resource Pool**: gold, materials, magical resources, population
- **Reputation with Player** (–100 to +100): loyalty/hostility scale

### Edges (Inter-Faction Relationships)
- **Alliance** (+50 to +100): mutual defense, trade, shared quests
- **Neutral** (–10 to +49): passive, may trade or ignore
- **Rivalry** (–50 to –11): competitive, espionage, trade embargoes
- **War** (–100 to –51): active combat, territory seizure, propaganda

### Weight Modifiers
- Player actions (quest completion, assassination, diplomacy)
- Emergent events (natural disasters, monster incursions, artifact corruption)
- Belief Layer shifts (new religions, WTOL revelations, propaganda)
- AI DM orchestration (balancing, narrative tension)

---

## 16.3 Conflict Types

| Conflict Type | Trigger | Resolution Mechanism |
|---|---|---|
| Diplomatic Dispute | Trade route control, border claims | Negotiation, player intervention, AI mediation |
| Religious Schism | Belief Layer divergence, cult activity | Propaganda, conversion, violence |
| Military Conflict | Territory seizure, assassination | Combat, siege, player-led strategy |
| Economic War | Resource monopoly, embargo | Trade networks, smuggling, sabotage |
| Cult Infiltration | Hidden faction within a faction | Investigation, exposure, purge, or alliance |

---

## 16.4 Player Influence Mechanics

- **Direct Actions:** complete faction quests, betray allies, assassinate leaders
- **Indirect Actions:** trade influence, spread rumors, manipulate Belief Layer
- **Reputation Thresholds:** unlock faction-specific gear, quests, abilities, strongholds
- **Consequences:** high reputation with one faction may lower others; betrayal triggers emergent retaliation

---

## 16.5 AI DM Enforcement

- Prevents total faction annihilation (minimum 2 factions active for narrative tension)
- Resolves simultaneous conflicts without breaking canon
- Introduces external threats (monster incursions, environmental disasters) to force temporary alliances
- Ensures Belief Layer and WTOL remain consistent with faction actions

---

## 16.6 Database Tables

| Table | Key Fields |
|---|---|
| **FactionPowerGraph** | faction_id, influence_score, territory_ids, resource_pool, reputation_with_player |
| **FactionRelationships** | faction_a_id, faction_b_id, relationship_type, weight, last_event_id |
| **FactionConflictLog** | conflict_id, faction_ids, type, trigger_event, resolution, timestamp |
| **PlayerFactionReputation** | character_id, faction_id, reputation_score, loyalty_tier, last_action |
