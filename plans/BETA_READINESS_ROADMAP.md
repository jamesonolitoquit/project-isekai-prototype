# Beta Readiness Roadmap: Product-Led Engineering

**Date**: February 21, 2026  
**Status**: ACTIVE
**Core Directive**: Move beyond "Zero as any" to "Visible Pressure & Deterministic Playability."

---

## 1. Beta Definition: The Playable Loop

A beta roadmap is not just "zero as any." It’s a 30–60 minute complete playable loop with:
1. **Visible Causality**: Actions leading to immediate world-wide shifts.
2. **Emotional Arcs**: NPCs with memory-driven cycles that change over a single session.
3. **Deterministic Integrity**: Perfect replayability via the mutation ledger.

### Objectives
| Milestone | Objective | Key Results |
|-----------|-----------|-------------|
| **Systemic Visibility** | Map metrics to visuals | `ageRotSeverity` and `paradoxLevel` reflected in Atmospheric Filters. |
| **Deterministic Replay** | Verified Snapshots | Perfect save/load/replay for 60-min sessions. |
| **Emotional Memory** | NPC Social Scars | NPCs remember player actions across location transitions. |

---

## 2. Technical Pillars

### 2.1 UI Layer - The Oracle View
The UI must stop being a "generic interface" and start being a "Diegetic Window."
- Eliminate all extraction casts in `BetaApplication.tsx` and `OracleView.tsx`.
- Implement `UIWorldModel` as a derived view of the engine `WorldState`.
- **Systemic Integration**: Link `state.ageRot` to global CSS shaders.

### 2.2 Ledger Durability: Mutation Snapshots
To support 60-minute loops, the O(n) event replay bottleneck must be solved.
- Implement Periodic Snapshotting (every 100 ticks).
- Verify SHA-256 chain integrity after loading from a snapshot.
- Reduce load times from >5s (late-game) to <200ms.

---

## 3. Stress Breakers (Priority Tasks)

- [ ] **Task 1: The Pressure Sink** (Engine/UI)
  - Connect `ageRotSeverity` and `paradoxLevel` to `useAtmosphericFilter.tsx`.
  - Effect: The world visibly twists/dims as player debt increases.

- [ ] **Task 2: Absolute Narrative Types** (Engine/Narrative)
  - Refactor `npcMemoryEngine.ts` to support `SocialScar` interface changes.
  - Finalize `branchingDialogueEngine.ts` to eliminate `as any` in branch logic.

- [ ] **Task 3: Stability Verification** (Test)
  - Scale "Millennium Simulation" to 10,000 years to find memory leaks.
  - Target: <15MB heap usage after long-running sessions.

---

## 4. Current Status: Step 4 Transition

Current progress is at **Step 4: UI Extraction Remediations.**
- Completed: Engine core hardening (91% total reduction).
- In-Progress: Decoupling UI layer from raw engine types.
- Next: Implementing Atmospheric filter hooks.
