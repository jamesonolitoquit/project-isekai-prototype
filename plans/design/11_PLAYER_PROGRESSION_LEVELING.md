# 11 — Player Progression, Skills & Leveling System

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `10_PLAYABLE_CHARACTERS_MORPHING.md`, `04_MAGIC_SYSTEMS.md`, `05_COMBAT_SYSTEMS.md`

D&D-style progression, balanced for Luxfier's morphing, magic, combat, and faction systems.

---

## 11.1 Core Principles

- Level-based progression: XP from combat, quests, exploration, faction influence, artifact interaction
- Skill trees & abilities: tiered abilities for combat, magic, morphing, and social interactions
- Balanced scaling: stat gains, skill points, and resource pools scale with level while maintaining race-based differentiation
- Flexibility & customization: players can specialize (e.g., combat-heavy Terran, magic-focused High Elf)
- Replayability: alternate builds encourage multiple playthroughs

---

## 11.2 Leveling Mechanics

| Level | XP Required | Stat Points | Skill Points | Morphing Points | Notes |
|---|---|---|---|---|---|
| 1 | 0 | 0 | 0 | 0 | Starting character creation |
| 2 | 100 | +2 | +1 | +1 | Unlock basic abilities |
| 3 | 250 | +2 | +1 | +1 | Minor morph enhancements |
| 4 | 450 | +2 | +1 | +1 | New skill tier |
| 5 | 700 | +3 | +2 | +1 | Mid-tier abilities unlocked |
| 6–10 | +100/level | +2 | +1–2 | +1 | Balanced growth |
| 11–20 | +200/level | +3 | +2 | +1–2 | High-tier abilities, morph mastery |
| 21+ | +500/level | +3 | +3 | +2 | Optional epic-tier gameplay |

---

## 11.3 Skill & Ability Trees

### 11.3.1 Combat Skills
- Martial Arts: unarmed, one-handed, two-handed, ranged
- Weapon Mastery: swords, spears, bows, exotic weapons
- Tactical Combat: positioning, dodging, parrying, team support

### 11.3.2 Magic Skills
- Ruin Magic (elemental)
- Flux Magic (matter manipulation)
- Veil Magic (illusion)
- Bind Magic (summons, control)
- Life Magic (healing, resurrection)

**Tiers:** Tier 1 basic → Tier 2 intermediate → Tier 3 advanced → Tier 4 master-level (rare, high cost, narrative-gated)

### 11.3.3 Morphing Skills
- Morph efficiency
- Morph duration
- Stat bonus optimization
- Special forms (hybrid, multi-limbed, flight adaptations)

### 11.3.4 Social / Utility Skills
- Persuasion / Intimidation (CHA)
- Crafting / Alchemy / Runic Infusion (INT)
- Stealth / Espionage / Diplomacy (AGI / INT)

---

## 11.4 Experience Acquisition

| Action Type | XP Reward | Notes |
|---|---|---|
| Combat Kill | 10–50 per enemy | Scales by difficulty and rarity |
| Quest Completion | 50–500 | Narrative-critical quests grant higher XP |
| Discovery / Exploration | 20–200 | Hidden nodes, minor artifacts, lore triggers |
| Faction Influence | 30–300 | Diplomacy, trade, or loyalty shifts |
| Morph Mastery | 10–50 per effective use | Rewards balanced usage without abuse |
| Artifact Interaction | 50–500 | Minor artifacts, high XP for rare relic hints |
| Emergent Event Participation | 50–1000 | Unique history-changing moments |

---

## 11.5 Level-Up Flow

1. **XP Check** — determine if current XP meets next level threshold
2. **Stat Allocation** — player assigns points to base stats
3. **Skill Point Allocation** — unlock or upgrade abilities
4. **Morphing Point Allocation** — reduce costs or unlock forms
5. **Check Faction Influence** — level may unlock faction-specific perks
6. **AI DM Updates** — Belief Layer, Faction Graphs, WTOL reflect progression events

---

## 11.6 Integration with Other Systems

- **Combat:** Leveling increases damage, evasion, spell potency
- **Morphing:** Points reduce cost and fatigue, unlock hybrid forms
- **Magic:** Tiered spell access tied to INT and XP
- **Artifacts & Crafting:** Higher levels unlock complex recipes
- **Factions:** High-level players may sway political outcomes
- **Belief Layer / WTOL:** Player actions may propagate new beliefs or reveal partial truths

---

## 11.7 Database Representation

| Table | Key Fields |
|---|---|
| **PlayerProgress** | character_id, level, XP, total_stat_points, total_skill_points, total_morph_points, last_level_up |
| **Skills** | character_id, skill_name, tier, level, cooldown, usage_count |
| **MorphingProgress** | character_id, morph_type, efficiency, max_duration, END_cost_reduction |
| **LevelUpLog** | character_id, level_gained, stat_points_allocated, skills_unlocked, timestamp |
