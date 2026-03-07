# DSS 04 — Faction Autonomy & Economic Simulation

## 04.1 Faction Model (Actors with Budgets)
Factions are **Autonomous Agents** under the `Resolution Stack (Phase 2)`.
- **ActionBudget:** `f(Population, Stability, LeadershipQuality)`.
  - Used for: Expansion, Recruitment, Sabotage, Research.
- **Strategic Intent Vector:** `[Expansionism, Zealotry, Isolationism, TradeFocus, Aggression]`.
  - MODIFIED by **World-Epoch Tides** (+/- 0.3 bias).
- **Stability Decay:** `Stability -= (BaseDecay + Corruption + WarExhaustion) * TickMultiplier`.

## 04.2 Faction Economic Circulation (The Closed Loop)
Production and consumption must obey **Conservation of Matter**.
- **NetGrowth:** `Production - (Upkeep + MilitaryMaintenance + TradeLeak)`.
- **Food Consumption:** `Population * SatietyFloor`.
  - *Shortage:* Triggers `Stability` decay and **Civil War Check**.

## 04.3 Trade & Market Simulation (Ripple-based)
- **Trade Shocks:** Destroying a `TileID` with a "Trade Bridge" flag reduces `TradeFocus` for all connected factions.
- **Resource Satiety:** Selling 100+ units of a resource to an NPC Market reduces its `Resource Valuation` for 600 Ticks.

## 04.4 Social Hierarchy (The Authority Bias)
Governance models (Matriarchal Council / Queen Regent) apply fixed multipliers to `Social Capital` gains.
- **Matriarchal Bias:** Increases Dialogue DC difficulty for non-aligned Vessels.
- **Leadership Turnover:** `SuccessionRoll = d20 + CulturalInfluence - InternalStrife`.
  - *Failure:* **Faction Fragmentation.** (A new FactionID is created for a sub-set of tiles).
