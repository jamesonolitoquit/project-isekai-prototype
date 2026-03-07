# GAME RULES: TIER 0 & TIER 1 (THE CONSTITUTION)

This document replaces all previous "manuals" with a formal governance layer.

---

## TIER 0: COSMOLOGICAL INVARIANTS (THE PHYSICS)
These are non-negotiable truths of the universe. They cannot be patched or altered without fracturing the simulation.

### 0.1 The Law of Causal Conservation
*   **Concept**: Every state change MUST have a traceable cause.
*   **Invariant**: `ΔWorldState` requires a `CauseID ∈ { Player, NPC, Faction, Environment, Divine }`. 
*   **Enforcement**: Phase 5 (Ledger Commit) rejects any change lacking a valid ID.

### 0.2 The Law of Conservation (Matter & Energy)
*   **Concept**: Resources cannot be created from the Void.
*   **Invariant**: `ΣR_before + Generated - Consumed = ΣR_after`. 
*   **Constraint**: No infinite loops (Gold/Mana). Spawning requires a "Spawn Budget."

### 0.3 The Law of Entropic Drift
*   **Concept**: Systems decay without maintenance.
*   **Invariant**: `UpkeepCost > 0` for all persistent structures (Buffs, Factions, Sanity).

### 0.4 The Law of Irreversible Time
*   **Concept**: Time flows forward. Reversal is not deletion—it is DEBT.
*   **Invariant**: Rewinding/Save-scumming appends a Branch Marker and adds `ParadoxDebt`.

### 0.5 The Law of Information Asymmetry
*   **Concept**: Knowledge is a physical resource.
*   **Invariant**: `ActorDecision ⊆ KnownState(actor)`. No omniscient NPCs.

---

## TIER 1: TIME ONTOLOGY (THE COMPUTATION)
How the universe discretizes reality into units of work.

### 1.1 The Atomic Tick
*   **Definition**: **1 Tick = 1.5 Real-Seconds**.
*   **Resolution Stack**:
    1. **Input Interface** (Buffer clicks)
    2. **Status Decay** (Process Vitals/Upkeep)
    3. **World AI** (Process NPC/Faction intents)
    4. **Conflict Resolution** (Trigger Dice Altar)
    5. **Ledger Commit** (Finalize the State)
    6. **Ripple Propagation** (UI Update)

### 1.2 Combat Mode (The Pulse)
*   **Transition**: On engagement, the engine pauses "Continuous Flow" and waits for Input.
*   **Mechanic**: Actions cost 1-5 Ticks. Spending a "Pulse" executes the full resolution stack for those Ticks instantly.

---

## TIER 2A: THE DICE ALTAR (STOCHASTIC ARBITRATION)
Rules for entropy injection during Phase 4 (Conflict).

### 2.1 Resolution Formula
*   **Standard Roll**: `Result = d20 + (Stat + Skill + Equip) - (Resistance)`.
*   **Success**: `Result ≥ TargetThreshold`.

### 2.2 The Probability Pact
*   **Deterministic Integrity**: No hidden "fudge factors." If the UI says 65%, the RNG must resolve at 65%.
*   **Failure Advancement**: Failure is never a "null tick." It results in information gain, resource loss, or situational escalation.
