# DSS 05 — Divine Layer & Faith Economics

## 05.1 Faith: The Meta-Currency
Faith is the primary resource for the Divine Layer. It is generated through individual and mass behavior.
- **Individual Faith:** Generated through religious actions (Prayer, Rituals at Workstations).
- **Mass Faith (The Faction Sink):** Generated per-tick by Factions based on their `FaithAlignment`.
- **Decay:** `Unclaimed Faith` decays at 5%/hr. If a deity is not worshipped (lowers `FaithMass`), their power to intervene shrinks.

## 05.2 Divine Intervention (Miracles)
Gods act through "Causal Gravity" to influence the `Resolution Stack (Phase 4: RNG)`.
- **Domain Restrictions:** A deity can only influence actions within their `Domain` (e.g., War, Harvest, Knowledge).
- **Cost Curve:** `MiracleCost = f(EventMagnitude, ExistingParadox)`.
- **Miracle Types:**
    - **Passive Bias:** Slight modifier to all Faction actions under that Domain (+1 to +3).
    - **Active Shock:** A single "Event" (e.g., a localized miracle or plague) triggered at high cost.
- **Cooldowns:** High-magnitude miracles lock a Domain for 3,600 Ticks (1 hour).

## 05.3 Swearing Allegiance (The Covenant)
Players can form a link with a specific deity or Pantheon.
- **Benefits:**
    - Reduced `Study Time` for spells matching the Domain.
    - Unique `Ancestral Echo Point` perks related to the faith.
- **Constraints:**
    - Faith-Incompatibility: Swearing to a War deity may incur a permanent `-10` modifier to Diplomacy in peace-focused biomes.
    - **Covenant Maintenance:** Breaking faith (e.g., a "Neutral/Lawful" player committing an "Agression" act) causes an immediate **Sanity Drift** event.

## 05.4 Divine Conflict & Dominance
- **Faith Wars:** If two Factions with opposing `FaithAlignments` go to war, the `Divine Gravity` for those domains will conflict, increasing the `Dice Corruption` for all resolution rolls in that tile.
- **Ascension:** If a faith reaches 60% global `FaithMass`, the current Era shifts to a `Theocratic Epoch` (All `IntentVectors` gain +0.3 Zealotry).
