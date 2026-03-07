# DSS 07 — Meta-Integrity & Victory Conditions

## 07.1 Anti-Exploit & Budget Abuse (The Engine Watchdog)
To prevent "infinite loops" in a simulation this complex, the engine implements several **Constraint Shields**.

### 7.1.1 Infinite Loop Detection (Security Patch v1.2)
- **Trigger:** If more than 100 `Resolution Stack` sub-phases occur within a single 1.5s Tick.
- **Action:** The engine rolls back all `CauseID` changes to the start of the Tick and flags the offending `ActorID`.
- **Phase 0 Input Discard:** If a rollback is triggered by a deterministic loop (retry of identical `Phase 0` inputs), the original `Phase 0` input is **permanently discarded**. The actor must submit a *new* `Phase 0` action in the current retry to break the deterministic chain. This prevents players from entering a "stuck replay" state.
  - *Retry Limit:* Maximum 3 rollbacks permitted per single Tick. If exceeded, the Tick is force-concluded and the actor is flagged for anti-exploit review.
- **Constraint:** Budget-based actions (Actions with an `ActionBudget` cost) are hard-capped at 1 per Player per Tick to prevent script-driven macro-abuse.
- **Causal Lock Enforcement:** Any actor triggering a `Conservation_Check` (Death Save) is Causally Locked for the remainder of the Tick (see DSS 02.2.1), and no `Phase 0` input can override this lock within the same Tick.

### 7.1.2 Divine Stacking Cap
- **Rule:** No miracle or `FaithAlignment` modifier can exceed a cumulative +/- 5 on a d20 droll.
- **Conflict:** If two miracles conflict, the one with the highest `EventMagnitude` wins.

## 07.2 Victory & Era Shift Resolution
Victory is defined by **Global Dominance Thresholds**.
- **Faction Dominance (>60% Territory/Population):** Triggers an **Imperial Epoch**.
- **Divine Dominance (>60% FaithMass):** Triggers a **Theoretic Epoch**.
- **Player Dominance (Ascension):** If a single Player Vessel manages to zero out their **Paradox Debt** while reaching `Level 99` in a `Causal Domain`, they can trigger an **Era Fracture**.

## 07.3 Timeline Fracture (Failure States)
If the world enters a state of permanent instability (e.g., zero `Stability` across all Factions):
- **Condition:** **Anarchy Fallout.**
- **Action:** The **AI Director** initiates a "Rebirth Event" (World Snapshot Rewind) where all Faction boundaries are reset to a pre-collapse state, but `Ancestral Memory` (EchoPoints) and `Causal Vaults` are preserved.
- **Cost:** All Players gain +10% **Paradox Debt** for the "Causal Cost" of the reset.

## 07.4 The "Mirror Path" (Endgame)
Advanced players can attempt to "Mirror" the world's physics to create their own **Sub-Domain**. This is currently the most expensive `Causal Budget` action.
- **Constraint:** Requires 100% `Stability` and zero `Paradox Debt`.
