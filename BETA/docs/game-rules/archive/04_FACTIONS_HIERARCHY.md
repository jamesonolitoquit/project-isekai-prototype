# Tier 3 — Faction Autonomy & Social Hierarchy Logic

## 3.1 Faction as Actor: The Decision Interface

Factions are not scripted background elements. They are **Autonomous Agents** that operate under the same constitutional constraints (Tier 0 & Tier 1) as Player Vessels.

### The Faction Interface
```ts
type FactionState = {
  Population: number               // Used to calculate ActionBudget
  ResourceStockpile: Record<string, number> // Subject to Conservation of Matter
  Territory: TileID[]               // Physical projection of power
  Stability: number                  // 0–100, subject to Entropic Drift
  FaithAlignment: Record<Domain, number> // Interaction with the Divine Layer
  MilitaryPower: number             // Action efficiency in conflict phases
  ActionBudget: number              // Finite Agency (Action Points per Tick/Era)
  StrategicIntent: IntentVector     // The AI "personality" and bias
}
```

---

## 3.2 Action Budget Law: Finite Agency Compliance

To prevent "Omnipotent AI" syndrome, Factions consume a limited **ActionBudget** per Tick/Era.

`FactionActionBudget = f(Population, Stability, LeadershipQuality)`

| Action Type      | Budget Cost | Duration (Ticks) |
| ---------------- | ----------- | ---------------- |
| Expand Territory | Very High   | Long             |
| Recruit Army     | Medium      | Medium           |
| Spread Faith     | Medium      | Periodic         |
| Sabotage Rival   | High        | Instant          |
| Stabilize Region | Low         | Recurring        |

*Constraint:* If ActionBudget reaches 0, the Faction enters a "Stagnation" state, making it susceptible to internal drift or external conquest.

---

## 3.3 Stability & Entropic Drift

Faction Stability is a decaying value representing institutional integrity.
`Stability -= (BaseDecay + Corruption + WarExhaustion) * TickMultiplier`

**Crisis Thresholds:**
- **Stability < 40:** Internal Revolt Check (Probability of splintering).
- **Stability < 20:** Leadership Coup (Turnover of the `IntentVector`).
- **Stability = 0:** Fragmentation (The Faction breaks into independent Tile-States).

---

## 3.4 Strategic Intent Vector: "The Divine Gravity" Choice

We adopt a **Hybrid-Emergent Model**. 
Factions are 95% autonomous, but they are subject to "World-Epoch Tides"—global bias modifiers that shift `IntentVector` weights for all actors.

```ts
type IntentVector = {
  Expansionism: number  // Biases toward conquest
  Zealotry: number      // Biases toward Divine/Faith actions
  Isolationism: number  // Biases toward stockpile/fortification
  TradeFocus: number    // Biases toward economic treaties
  Aggression: number    // Biased toward hostility over diplomacy
}
```
*Note:* A "Century of Iron" event does not script a war; it simply adds `+0.3 Aggression` to all IntentVectors, making peace harder to calculate as an optimal outcome.

---

## 3.5 Social Hierarchy: Matriarchal Enforcement

Governance is not cosmetic. It is codified in the **AuthorityStructure**.

```ts
type AuthorityStructure = {
  GovernanceModel: "MatriarchalCouncil" | "HighPriestess" | "QueenRegent"
  GenderAuthorityBias: number // e.g., 1.25 multiplier for Matriarchal influence
}
```
*Systemic Impacts:*
- **Succession Logic:** Algorithms prioritize candidates matching the hierarchy.
- **Influence Scaling:** Political capital (Social Weight) is recalculated based on the Vessel's alignment with the Faction's `AuthorityStructure`.
- **NPC Dialogue:** Interaction DCs are adjusted by the `GenderAuthorityBias`.

---

## 3.6 Succession & Leadership Turnover

When a Faction Leader dies or Stability falls below the **CrisisThreshold**:
`SuccessionRoll = TrueRNG(d20) + CulturalInfluence - InternalStrife`

**Result Paths:**
- **Success (Natural):** A new leader is chosen; `IntentVector` drifts slightly.
- **Failure (Chaos):** **Civil War Branch.** The Faction splits into two entities with conflicting `IntentVectors` and halved `ActionBudgets`.

---

## 3.7 Inter-Faction Influence (The Ripple Phase)

Per the **Resolution Stack (Phase 5 - Ripple)**:
Neighboring Factions calculate an `OpinionShift` whenever an `EventMagnitude` exceeds the local awareness threshold.

`OpinionShift = f(EventMagnitude, CulturalAffinity, FearIndex)`

History is remembered; high-magnitude events create "Memory Anchors" that permanently bias diplomatic rolls until the Faction's Stability resets.

---

## 3.8 Economic Circulation (Conservation of Matter)

Faction growth/shrinkage is mathematically tied to resource availability.
`NetGrowth = Production - (Upkeep + MilitaryMaintenance + TradeLeak)`

- **Growth > 0:** Population expands (increases `ActionBudget`).
- **Growth < 0:** Population declines (destabilizes `Stability`).

---

## 3.9 Player–Faction Integration

Players interact with the Political Layer as an external or internal variable.
- **Allegiance:** Grants a slice of the `ActionBudget` for Player-led missions.
- **Infiltration:** Direct attack on the `Stability` variable via covert events.
- **Reform:** A high-Paradox action to rewrite a Faction's `AuthorityStructure`.

---

## 3.10 World-Level Victory & Eras

When a single Faction or Faith Alignment crosses the **DominanceThreshold** (e.g., 60% Territory/Population):
1. **Era Shift:** The world enters a new epoch (New "Divine Gravity" modifiers).
2. **Ancestry Bias Shift:** The dominant Faction's Ancestry becomes the "High-Culture," modifying `SanityDrift` for all its members.
3. **Reset Paradox:** High dominance creates a temporal anchor, increasing the cost for any Player to "Rewind" the timeline to a pre-dominance state.
