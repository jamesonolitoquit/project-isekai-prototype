# DSS 08 — Combat & Conflict Resolution

## 08.1 The Atomic Pulse (Combat Time)
When a high-magnitude conflict is detected (Aggression > Threshold), the affected TileID enters **Atomic Pulse Mode**.
- **Tick Sync:** Combat still operates on the 1.5s Atomic Tick.
- **Action Slots:** Every actor has 1 **Major Action** (Strike, Cast, Move) and 1 **Minor Action** (Draw weapon, Use consumable, Shout) per Pulse.
- **Initiative:** Determined by `AGI + PER + TrueRNG(d1)`.

## 08.2 Hit & Avoidance Calculus
Instead of a single "Roll to Hit," the engine uses a **Contested Resolution**.
- **Attacker:** `d20 + DEX/STR (Weapon Dependent) + Skill_Proficiency`.
- **Defender:** `Fixed_Avoidance (Base AGI) + Active_Reaction (Dodge/Parry Roll)`.
- **The Friction Rule:** If a weapon's `Required STR` is not met, the Attacker suffers a `-5` penalty to the roll and 2x Stamina cost.

## 08.3 Damage & Resistance (Armor Physics)
Armor is not just a HP buffer; it is a **Damage Filter**.
- **Hardness (DR):** Flat reduction of incoming damage (e.g., Plate Armor = -5 DMG).
- **Integrity:** Armor has `Durability`. High-impact strikes reduce Armor Integrity before hitting the Vessel's HP.
- **Vessel HP:** The last line of defense. Reaching 0 HP triggers the `Conservation_Check` (See DSS 02).

## 08.4 Magic & Spell Misfires
Spells are treated as "Causal Interventions."
- **Casting Time:** High-tier spells take multiple Ticks (Pulses). An interrupt (Taking DMG) requires a `WIS + CON` check to maintain focus.
- **Mana Saturation:** Casting in a high-mana biome increases power but adds `+3` to the **Misfire Range**.
- **Misfire:** A roll of 1-3 (modified by WIS) causes a **Mana Backlash**, dealing Sanity damage and potentially triggering a minor **Paradox Bleed**.

## 08.5 Tactical Freedom & Pacifism
- **Environmental Interaction:** Players can use the "Stage" (3D Grid) to tip hazards, block paths, or use height for `PER` bonuses.
- **The Pacifist Loop:** Characters with high `CHA` and `Social Skills` can attempt to "De-escalate" during the Conflict Phase.
  - *Success:* Action is converted to a Dialogue event, ending the Atomic Pulse.
  - *Failure:* Defender loses their next Minor Action due to "Confusion."
