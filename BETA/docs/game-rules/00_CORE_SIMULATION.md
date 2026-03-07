# DSS 00 — Core Simulation Engine & Persistence

## 00.1 Time Model (The Atomic Tick)
The engine executes in discrete intervals to maintain causal integrity.
- **Tick Duration:** 1.5 Seconds (57,600 ticks = 1 Day).
- **Tick Scheduler:** Uses a prioritized queue. High-magnitude events (Player actions) are resolved first within the same tick window.
- **Max Catch-up Delta:** 600 Ticks (15 minutes). If the server exceeds this, it enters "Batch Compression" mode.
- **Batch Tick Compression:** Low-priority background simulations (Faction resource ticks) are aggregated.

## 00.2 The Resolution Stack (6-Phase Execution)
Every 1.5s, the engine processes the following stack:
1. **Phase 0: Input Extraction.** Collects all Player and AI requests.
2. **Phase 1: Decay & Maintenance.** Updates `Vitals` and applies `Entropy` to gear.
3. **Phase 2: World AI Strategy.** Factions calculate moves based on `ActionBudget`.
4. **Phase 3: Conflict & Arbitration.** Resolves overlapping actions (Combat/Trade overlaps).
5. **Phase 4: Commit & RNG.** Executes Dice Altar rolls. Results are final.
6. **Phase 5: Ripple Phase.** Calculates the consequence radius of Phase 4 results.

## 00.3 Persistence & Ledger (The Immutable Thread)
- **CauseID Enforcement:** No state change may occur without a valid `CauseID` (Action origin).
- **Partial State Commits:** Only modified tiles/actors are saved to the ledger to minimize I/O.
- **Branch Markers:** Every 3,600 Ticks (1 hour), a snapshot is taken. Players can "Rewind" to these markers at the cost of **Paradox Debt**.
- **Rollback:** If a commit fails validation (e.g., resource duplication), the engine rolls back the offending actor to the previous tick.
