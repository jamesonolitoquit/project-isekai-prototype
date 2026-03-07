# DSS 02 — Survival Mechanics & Vitals

## 02.1 The Triad of Vitals (Individual Entropy)
Characters are subject to three main decay layers per Tick (1.5s).
- **Vigor:** Physical energy. `Decay = -1%/hr * CON_Modifier`.
  - *Regeneration:* Resting at a High-Stability Tile (Inn/Safehouse).
- **Nourishment:** Biological fuel. `Decay = -2%/hr * Biome_Modifier`.
  - *Starvation:* HP and Stamina Cap reduction (-1% per 10 Ticks).
- **Sanity:** Psychological anchor. `Drift = f(Paradox_Debt, Horror_Index)`.
  - *Sanity < 20:* **Fugue State.** The AI Director takes control for 10 Ticks.

## 02.2 Injury & Persistance Model
Damage is not just HP. It creates **Injury Markers**.
- **Lacerations & Fractures:** Persistent debuffs to DEX or AGI. Requires a `Workstation: Medical` to treat.
- **Deep Scars:** Permanent micro-adjustments to attribute caps.
- **Death Threshold:** At 0 HP, a `Conservation_Check` (d20 + CON) is rolled.
  - *Success:* **Fragile State** (1 HP, -50% Attributes).
  - *Failure:* **Vessel Destruction** (Trigger Reincarnation).

### 02.2.1 The Causal Lock Rule (Security Patch v1.2)
Any `ActorID` that triggers a `Conservation_Check` (Death Save) is immediately **Causally Locked** for the remainder of the current Atomic Pulse (1.5s Tick).
- **Effect:** No Timeline Warp, Temporal Intervention, or high-tier reality-manipulation ability can target a locked actor within the same Tick.
- **Purpose:** Prevents recursive undo loops where a player could indefinitely retry Timeline Warps to evade finalized death.
- **Finalization:** The state of 'Vessel Destruction' must finalize (either succeed or fail the Conservation_Check) before any temporal manipulation targeting that actor can be attempted in a *subsequent* tick.
- **Penalty for Violation:** If an action violates the Causal Lock, the engine treats it as an illegal rollback attempt and increments the actor's **Paradox Debt** by +15.

## 02.3 Healing Economy
- **Natural Recovery:** Slow (f(CON)).
- **Magic Recovery:** High HP restored, but doesn't remove "Injury Markers."
- **Alchemy:** Restores Vitals and removes markers but adds "Toxicity" (Temporary CON Penalty).
