# Developer System Spec — World Systems & Physical Realism

## 6.1 Injury & Damage Persistence (The Anti-HP Rule)

While the engine uses HP for immediate combat resolution, the **Injury System** creates long-term systemic friction.

### 6.1.1 Injury States
Injuries are tracked per limb/organ and persist across combat encounters.
- **Lacerations:** Increases Vigor decay via "Bleeding" flag.
- **Fractures:** Reduces AGI/DEX effectiveness by fixed multipliers (0.5x).
- **Infection:** If untreated in certain biomes, triggers a CON-burn (max HP reduction).
- **Scar Tissue:** Permanent micro-adjustments to attributes. Healing magic restores HP, but "Deep Scars" remain as historical markers that slightly alter attribute caps.

---

## 6.2 Environmental Simulation

The environment is a dynamic variable in the **Resolution Stack**.

### 6.2.1 Biome Modifiers
Every TileID possesses a `BiomeProfile`:
- **Temperature:** Affects `Nourishment` (Cold = faster hunger) and `Stamina` (Heat = faster exhaustion).
- **Mana Saturation:** Affects Spell Misfire probability (WIS check difficulty).
- **Altitude:** Affects `Vigor` regeneration rate.

### 6.2.2 Weather Cycles
Weather adds temporary overrides to Biome settings (e.g., "Dense Fog" = -5 Perception).

---

## 6.3 Economic Circulation & Resource Law

The world's economy must obey **Tier 0 Conservation of Matter**.

### 6.3.1 Supply-Demand Engine
- **Market Satiety:** Flooding a region with crafted potions (e.g., via a Player's high-efficiency Workstation) reduces local prices and Faction resource valuation.
- **Trade Shocks:** Destroying a bridge or resource node propagates a "Resource Scarcity" ripple through neighboring factions.

### 6.3.2 Sinks & Maintenance
- **Durability:** Tools used without the correct `Work Proficiency` suffer accelerated decay.
- **Food-Population Coupling:** Factions failing to secure high-yield biomes suffer `Stability` decay via starvation events.

---

## 6.4 Social Memory & NPC Agency

### 6.4.1 Reputation Propagation
NPCs are not silos. They share gossip based on **Regional Proximity**.
- **The Whisper Radius:** High-magnitude events (e.g., a Paradox Reality Fault) spread reputation modifiers to neighboring Tiles over time.

### 6.4.2 Non-Player Agency
If the Player is idle, the world progresses:
- NPC adventurers clear resource nodes.
- Factions recruit from the same "Population Pool" as the Player.
- Wars advance per the **Faction ActionBudget**.

---

## 6.5 Power Vacuums & Ecological Drift

- **Leader Removal:** Killing a Faction Leader triggers a `SuccessionRoll` and a temporary `Stability` collapse.
- **Overharvesting:** Depleting a resource node faster than its `RegenerationRate` leads to permanent node extinction, affecting local Faction economy and Ancestry dominance.
