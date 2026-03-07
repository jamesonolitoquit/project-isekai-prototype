# DSS 01 — Growth System & Skill Architecture

## 01.1 Attribute Engine (The Baseline Vessel)
Attributes are the foundation of all physical and mental execution.
- **STR:** Carry Weight (Lifting), Melee DMG, Bow Draw Strength.
- **DEX:** Precision (Critical Hit Window), Crafting Accuracy.
- **AGI:** Initiative (Combat Speed), Movement Speed.
- **CON:** Max HP, Disease Resistance, Vigor Decay Reduction (-0.1%/hr per point).
- **INT:** **Skill XP Gain**, Spell Complexity Threshold, Knowledge Retention.
- **WIS:** **Failure Probability Floor**, Perception, Sanity Stability (Mirror Timing).
- **CHA:** Dialogue DC Multipliers, Faction `ActionBudget` Contribution.
- **PER:** Range Window, Hidden Resource/Hazard Discovery.
- **LCK:** TrueRNG Bias (+/- 5% Max), Rare Drop Factor.

## 01.2 Skill Progression & Diminishing Returns
- **XP Source:** Using a skill in the world. Failed attempts grant 0.25x XP.
- **Soft Caps:** `SoftCap = f(INT, WIS)`. Beyond this, XP required doubles every 5 levels.
- **No Class Lock:** Any character may use any weapon or method.
  - **Friction:** Using an item below its `Required Attribute` (e.g., Heavy Shield with STR 4) costs 3x Stamina and adds a 25% "Self-Injury" roll to every use.

## 01.3 The Talent System (Genesis Constraint)
- **Talents:** 1 Passive trait assigned at character creation.
- **Active Skills:** Actively learned and leveled through use.
- **Passive Skills:** Contextual improvements (e.g., "Night Vision" for specific Ancestries).
- **Learning Bubble:** Using an expensive artifact, the player enters a time-contained "Study State" to learn new skills or spells without real-world time passing.

## 01.4 Work Proficiency & Workstations
- **Prohibited Inventory Crafting:** No item construction is allowed from the backpack.
- **Workstation Tier:** Every crafting action must be performed at a station.
  - *Improvised:* High failure rate.
  - *Professional:* Standard stats.
  - *Exalted:* Minor success bias.
- **School System:** Characters can spend "In-game time" (Ticks) and currency at Schools to level skills with a 0% failure risk.
