# DSS 09 — Economy & Resource Production

## 09.1 The Closed Loop Production Circuit
Every item in the game is the result of a **Causal Production Chain**.
- **Source Node:** Resources (Ores, Herbs, Mana Shards) regenerate at local Tile rates f(Biome).
- **Processing Station:** Requires a `Workstation` and a `Skill_Proficiency` check.
  - *Tier 1 (Base):* +10% Material Waste.
  - *Tier 2 (Pro):* Standard.
  - *Tier 3 (Exalted):* +10% Material Yield.
- **Finished Item:** Has `Durability` and `MarketValue`.

## 09.2 Faction Trade Networks
Factions create "Flow Paths" across the 3D Stage.
- **Supply Bridges:** If a Faction controls two connected high-yield Tiles, they gain an `ActionBudget` bonus (+10%).
- **Trade Shocks:** Destroying a Bridge flag in the `Ripple Phase` interrupts the flow, causing immediate `Stability` decay in the destination Tile.

## 09.3 Market Dynamics (Satiety & Scarcity)
- **Global Liquidity:** Every Faction ID has a **Resource Stockpile**.
- **Local Satiety:** If a Player sells 100+ "Health Potions" to one Market, the price of that item drops globally within that Faction's territory for 600 Ticks (15 minutes).
- **The Black Market:** A separate, low-stability `Trade Network` with higher prices for "Paradox-linked" or "Illegal/Cursed" items.

## 09.4 Administrative Overhead (The Cost of Power)
Factions with large TerritoryIDs suffer from **Management Entropy**.
- **Distance Penalty:** Tiles further from the "Seat of Power" have higher `Corruption` (reduced `ActionBudget` yield).
- **Maintenance Cost:** Every `Tile_Structure` (Walls, Towers, Farms) costs a base resource amount (f(Population, Stability)) per 3,600 Ticks (1 hour).
  - *Failure to pay:* Structure enters **Ruination State**, reducing defense and production.

## 09.5 The Currency-Time Exchange
- **Schools & Learning Artifacts:** These act as the primary "Gold Sinks."
- **Paradox Fee:** If a player uses a "Causal Rewind" to fix a bad trade, the Currency and Paradox Debt costs scale with the `MarketValue` of the impacted items.
