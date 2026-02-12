# 07 — Factions, Politics & Power Graphs

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `06_BELIEF_LAYER_WTOL.md`

Defines all organized entities, power relationships, belief propagation, and social dynamics in Luxfier.
Critical for emergent gameplay, replayability, and AI DM adjudication.

---

## 7.1 Core Principles

- Factions exist at multiple scales: global, regional, local, and micro (sub-groups)
- Faction power derives from: population, resources, knowledge, magic, relic access, and belief adherence
- Faction beliefs propagate through: members, culture, propaganda, and interactions with players
- Faction conflicts are dynamic: alliances, rivalries, and betrayals evolve during playthroughs
- AI DM adjudicates interactions: resolves conflicts, enforces consequences, applies Belief Layer + WTOL logic

---

## 7.2 Faction Categories

### 7.2.1 Historical / Legendary Factions

- **League of Legendary Idols (LLI)** — Founded by Haruto Aizawa. Original legendary idols: high-status, history-shaping figures. Current status: diminished, mostly ceremonial. Influence: cultural, symbolic.
- **League of Idols (LI)** — Successor faction. Focused on entertainment, morale, minor adventuring. Medium political influence; mainly city-level.

### 7.2.2 Adventuring & Mercenary Groups

- **Adventurer's Guilds** — Town-based networks supporting questing, monster suppression, exploration. Rank-based: novice → elite. Influence: localized.
- **Mercenary / Bounty Groups** — Operate across kingdoms; often opportunistic. Influence: minor political sway, high danger potential.

### 7.2.3 Religious & Cult Factions

- **Celestin Worshipers** — Follow immortal rulers; influence law and morality. High magic tolerance, moderate militarization.
- **Kael's Last Command (Cult)** — Follows Kael'Vahn's doctrine centuries after his disappearance. High fanaticism, secretive. Influence: minor but widespread.
- **Beastkin Tribal Worshipers** — Terran clans, Avian nomads, Merran aquatic cults. Worship localized deities or nature spirits.

### 7.2.4 Political Factions

- **Kingdoms & Principalities** — Rule mortal populations. Influence: high; manage resources, laws, military.
- **Merchant Bureaus / Guilds** — Trade monopolies, city-level control. Influence: economic leverage.
- **Technomancers / Rune Scholars** — Focus on rune-tech and magic integration. Influence: specialized, high-tier magic knowledge.

### 7.2.5 Underground & Shadow Factions

- **Cultists / Forbidden Knowledge Seekers** — Seek WTOL-protected truths or relics. Influence: hidden.
- **Assassins / Thieves' Guilds** — Regional operations, contracts from political entities.
- **Relic Hunters / Sin Weapon Seekers** — Target the Seven Relics of Virtue or Seven Weapons of Sin. Influence: rare, high danger.

---

## 7.3 Faction Attributes

Each faction maintains:
- Faction ID / Name
- Category (Political, Religious, Mercenary, Legendary, Shadow)
- Population / Reach (number of members or influence score)
- Belief Alignment (maps to Belief Layer + WTOL)
- Territorial Control / Headquarters
- Resource Control (magic nodes, relics, gold, weapons)
- Power Graph Links (Allies / Rivals / Subservient groups / Enemies)
- Influence over Lore Events (quests, festivals, wars)
- Special Abilities / Traits

---

## 7.4 Power Graph Mechanics

- **Nodes:** Factions
- **Edges:** Alliances (+), Rivalries (−), Dependency (resource or belief-driven)
- **Weights:** Strength of influence (1–100)
- **Dynamic Updates:** AI DM updates graph based on: player actions, belief shifts, combat outcomes, economic or magical events

---

## 7.5 Example Node Relationships

```
League of Legendary Idols
  ├─ Alliance ─→ League of Idols
  ├─ Rivalry ─→ Kael's Last Command
  └─ Influence ─→ Adventurer's Guilds (inspiration boost)

Kael's Last Command
  ├─ Rivalry ─→ Kingdom of Elfin High
  ├─ Secret Control ─→ Cultists
  └─ Hidden Influence ─→ Underground Relic Hunters

Kingdoms
  ├─ Alliance ─→ Merchant Bureaus
  ├─ Rivalry ─→ Neighboring Kingdoms
  └─ Neutral / Cooperative ─→ Adventurer's Guilds

Beastkin Tribes
  ├─ Cultural Rivalry ─→ High Elves
  └─ Occasional Alliance ─→ Kael's Last Command (if appeased)
```

---

## 7.6 Gameplay Implications

- **Dynamic Politics:** Player actions shift alliances, trigger wars, or influence commerce
- **Faction Quests:** Missions depend on faction relationships and belief alignment
- **Emergent Events:** AI DM can generate faction conflicts, power struggles, or espionage
- **Faction Morale & Belief Feedback:** Combat, relic discovery, or misinformation affect faction decisions
- **Replayability:** Graphs evolve differently per playthrough

---

## 7.7 Integration with Other Systems

- **Belief Layer:** Drives faction decisions; AI DM propagates belief updates
- **WTOL:** Controls what factions know
- **Combat Systems:** Factions may intervene, support, or oppose player actions dynamically
- **Magic Systems:** Certain factions may restrict or amplify magic use
- **History / Lore:** Legendary figures influence faction strategies or legacy events
