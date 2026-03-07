# Tier 2D — The Ancestral Tapestry (World-Locked Identity)

## 2D.1 Core Principle: Inherited Constraints, Not Free Power

Ancestry is a **systemic identity constraint layer**. It is the physiological and social "Vessel" into which the Player's agency (Tier 0) is poured.

### The Invariant: Curve-Based Design
Ancestry modifies **Decay Curves** and **Affinity Scales**, never flat additive bonuses.
- **BAD:** `+2 Strength` (Static power, leads to optimization ceilings).
- **GOOD:** `VigorDecayModifier = -10%` (Temporal efficiency, scales with the Atomic Tick).

---

## 2D.2 Structural Definition: The Profile

Every Ancestry in the Engine must satisfy the following schema:

```ts
type AncestryProfile = {
  BaseVitalCurves: {
    VigorDecayRateModifier: number       // Affects base -1%/hr entropy
    NourishmentEfficiencyModifier: number // Affects satiety duration
    SanityDriftModifier: number          // Sensitivity to Paradox/Horror
  }

  DomainAffinities: Record<DivineDomain, number> // Multiplier for Faith/Magic

  FactionBiasMap: Record<FactionID, number>     // Starting Social Capital

  EnvironmentalAdaptation: {
    BiomeResistance: Record<BiomeType, number>  // Passive mitigation
    ClimateTolerance: number                    // Temperature drift floor
  }

  NarrativeLockFlags: string[]                  // Hard metadata for World AI
}
```

---

## 2D.3 World-Locked Persistence (Model A)

The Engine enforces **Canon-Locked Selection**. 
- Only ancestries physically present in the current simulation timeline are selectable.
- **Extinction Event:** If a population falls below the `ExtinctionFloor`, that Ancestry is removed from the "New Vessel" menu for all players.
- This reinforces **Entropic Drift** (Tier 0) and **Consequence Persistence**.

---

## 2D.4 Social Weight & Matriarchal Constraint

In the world's primary social structure, Ancestry dictates systemic access via the **Gender Authority Bias**.

```ts
GenderAuthorityBias: {
  MatriarchalMultiplier: number // 1.0 (Neutral) to 1.5 (High Bias)
}
```
*Effect:* This does not alter combat math. It modifies:
- **Dialogue DC:** Higher bias = lower difficulty for political persuasion.
- **Clergy Elevation:** Required overhead for divine rank.
- **Faction Recruitment:** Probability of NPC trust in Matriarchal enclaves.

---

## 2D.5 Evolutionary Drift (Population Dynamics)

Ancestries are dynamic variables tied to the **World AI Simulation**.

1. **Atrophy (Low Population):**
   - Vital curves destabilize (increased decay).
   - Mutation events (Paradox Bleed) occur more frequently.
   - Divine favor weakens as "Faith Mass" vanishes.

2. **Dominance (High Population):**
   - Cultural momentum provides Sanity resistance (belief stabilization).
   - Political inertia increases (easier to maintain Faction control).

---

## 2D.6 Hybridization: Conservation of Traits

Hybrids must obey strict conservation laws to prevent "God-Build" exploits.

**Formula:**
`HybridModifier = (ParentA × 0.6) + (ParentB × 0.6) - InstabilityPenalty`

- **Instability Penalty:** Scales with the distance between Parent Domain Affinities.
- **Risk:** Unstable hybrids suffer increased **Sanity Drift** as the Vessel's biological and spiritual anchors conflict.

---

## 2D.7 Ancestral Memory (Legacy Progress)

Instead of traditional XP, players earn `AncestralEchoPoints`.

**Earning Criteria:**
- Faction loyalty persistence across multiple Vessels.
- Survival of World-Epoch events.
- Upholding Divine Covenants.

**Utility:**
- **Lore Flash:** Passive hints about secret world states.
- **Domain Bias:** Minor roll advantage in ancestral specialties.
- **Decay:** EchoPoints are subject to **Entropic Drift**. If a legacy is ignored for several generations (reincarnation cycles), the memory fades.

---

## 2D.8 Anti-Optimization Guards

To maintain Tier 0 integrity:
1. **No Nullification:** Ancestry cannot reduce Paradox Debt or Vigor Decay to 0. Entropy is a global invariant.
2. **The 25% Rule:** No modifier in an `AncestryProfile` may exceed ±25% of the global baseline.
3. **Vessel Fragility:** High-affinity ancestries (Glass Cannons) must have proportional `SanityDrift` penalties.

---

## 2D.9 Execution Context

This system is the bridge between:
- **Tier 0:** Finite Agency (Action Budgets).
- **Tier 1:** Time (Tick-based decay).
- **Tier 2A/B:** Dice (Roll modifiers) and Paradox (Vessel reset triggers).
- **Tier 3:** Faction AI (Social weight and population drift).
