# Developer System Spec — Character Attributes & Growth

## 5.1 The Universal Attribute Set

Attributes represent the "Vessel's" raw capacity. They are balanced via **Interdependency Loops** to ensure no single stat becomes a "Global Dominant."

| Attribute | Primary Domain | Core Engine Function | Secondary Systemic Link |
| :--- | :--- | :--- | :--- |
| **STR** | Physical Power | Melee DMG, Carry Weight, Physics Manipulation | Stamina Resilience |
| **DEX** | Precision | Hit Chance, Fine Motor (Crafting), Stealth | Critical Window |
| **AGI** | Mobility | Move Speed, Attack Speed, Reflex/Dodge | Initiative Stack |
| **CON** | Vitality | Max HP, Poison/Disease Res, Global Entropy Floor | Vigor Decay Reduction |
| **INT** | Intelligence | **Skill XP Gain**, Spell Complexity, Research Rate | Magic Pool Size |
| **WIS** | Cognition | **Failure Probability Reduction**, Insight, Sanity | Ritual/Mirror Timing |
| **CHA** | Presence | Social DC Modifiers, Faction Capital, Morale | Leadership ActionBudget |
| **PER** | Perception | Hazard/Resource Detection, Aiming, Logic Hints | Range Effectiveness |
| **LCK** | Fortune | TrueRNG Bias (+/- 5% Max), Loot Rarity | Paradox Bleed Mitigation |

---

## 5.2 The Learning Curve (INT/WIS Engine)

The speed and depth of character growth are dictated by the **Cognitive Ratio**.

### 5.2.1 Skill Soft Caps
`HardCap = GlobalMax (99)`
`SoftCap = f(INT, WIS)`
Beyond the SoftCap, XP required per level increases exponentially. This forces specialization or high-tier learning artifacts.

### 5.2.2 The Study Loop
- **Manual Study:** High time cost. Low currency. Requires `Workstation` or `Tutor`.
- **Time-Contained Learning (Artifacts):** Character enters a temporal bubble.
  - *Internal Time:* Years of study.
  - *External Time:* Ticks.
  - *Cost:* Massive currency/resource sink to balance the time-save.
  - *Requirement:* Intelligence must meet the spell's complexity floor, or the character returns with **Sanity damage/Knowledge Corruption**.

---

## 5.3 The Talent System (Genesis Constraints)

Talents are the **unique starting variables** assigned at character creation.

- **Quantity:** 1 Talent (Standard), 2 Talents (Ultra-Rare, 0.5% spawn rate).
- **Function:** Talents provide a "Starting Path" but do not grant flat power.
  - *Example:* "Steady Hands" (DEX-link) -> Redundant check on crafting failure.
  - *Example:* "Mana Sensitive" (INT-link) -> 1.1x XP to Magic skills.
- **Independence:** Talents are distinct from **Racial Passives**.

---

## 5.4 No Class Lock: Freedom of Methodology

The Engine does not enforce classes. It enforces **Competency Gates**.
- Any character can equip any item or cast any spell.
- **Friction:** Using a "Heavy Greatsword" with STR 5 results in:
  1. Massive Stamina drain.
  2. Slowed Animation speed (AGI penalty).
  3. Increased Self-Injury probability.
- **The Pacifist Path:** Viability depends on CHA/WIS builds used to manipulate the **Faction ActionBudget** or skip **Conflict Resolution Phases**.

---

## 5.5 Workstation & Proficiency Law

- **Zero-Inventory Crafting:** Players cannot craft complex items (Alchemy, Smithing) from the backpack.
- **Workstation Tier:** The physical object used in the world determines the quality floor.
- **Environmental Hazard:** Crafting high-tier items in an unstable environment (Low Mana Saturation / Extreme Cold) adds a multiplier to the **Dice Altar failure range**.

---

## 5.3 Innate Racial Abilities vs. Skills

- **Natural Traits (e.g., Morphing):** If a race can morph, it is a **Default Action** available at Tick 1. It does not cost a Talent or Skill slot.
- **Racial Passive Trees:** Every ancestry has a unique internal tree that unlocks via **Ancestral Echo Points** (See Tier 2D). These focus on physical/biological optimization (e.g., Breath holding, Night vision, Digestion efficiency).
