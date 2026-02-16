# 17 — Session Continuity, Persistence & Save/Load

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `01_META_AUTHORITY.md`, `20_ALPHA_DATA_SCHEMA.md`

Ensures world state, player progress, emergent history, and faction dynamics persist
across sessions with deterministic save/load and event-sourced state rebuilding.

---

## 17.1 Core Principles

- Event-sourced persistence: world state rebuilt from ordered mutation log, not mutable snapshots
- Deterministic replay: given the same event sequence, identical world state is produced
- Save/load transparency: player can save at designated points; auto-save on session events
- Session continuity: emergent history, faction graphs, belief layers, NPC states carry forward
- Integrity: hash-chain ledger ensures tamper detection and rollback safety

---

## 17.2 Save System Architecture

### 17.2.1 Event Log (Mutation Log)
- Every world-state change recorded as an immutable event
- Each event: `{ event_id, timestamp, type, payload, hash, prev_hash }`
- Hash chain: SHA-256 linking each event to its predecessor
- Enables deterministic state rebuilding from any checkpoint

### 17.2.2 Checkpoints (Snapshots)
- Periodic full-state snapshots for fast load
- Snapshot includes: world state, player state, faction graphs, belief layers, NPC positions, quest status
- Snapshots are validated against event log hash chain

### 17.2.3 Save Slots
- Manual save: player-initiated at rest points, towns, or safe zones
- Auto-save: triggered by quest completion, level-up, faction events, session timeout
- Multiple slots: minimum 3 manual + 1 auto-save per character

---

## 17.3 Load & State Rebuilding

1. Load latest checkpoint (snapshot)
2. Replay event log from checkpoint to current state
3. Validate hash chain integrity
4. Resolve any conflicts (e.g., corrupted events → rollback to last valid checkpoint)
5. Resume gameplay

---

## 17.4 Session Persistence Scope

| System | Persisted Data |
|---|---|
| **Player State** | Level, XP, stats, inventory, equipped items, morph state |
| **Quest State** | Active/completed/failed quests, objectives, journal |
| **Faction Graphs** | Influence scores, relationships, territory, reputation |
| **Belief Layer** | Player beliefs, NPC beliefs, WTOL state |
| **NPC State** | Positions, dispositions, interaction history |
| **Emergent History** | Timeline events, player-triggered canonical changes |
| **Environmental State** | Weather, time of day, seasonal cycle, magical anomalies |
| **Combat State** | Not persisted mid-combat; combat must resolve before save |

---

## 17.5 Rewind & Rollback Constraints

- Rewind allowed to last checkpoint only (no arbitrary time travel)
- Canonical events cannot be undone (Hard Canon lock)
- Soft Canon events may be reinterpreted but not erased
- AI DM enforces: "You can reload, but the world remembers"
- Death/permadeath rules apply per `01_META_AUTHORITY.md`

---

## 17.6 Database Tables

| Table | Key Fields |
|---|---|
| **MutationLog** | event_id, timestamp, type, payload, hash, prev_hash, session_id |
| **Checkpoints** | checkpoint_id, session_id, snapshot_blob, event_id_at_snapshot, hash_at_snapshot, created_at |
| **SaveSlots** | slot_id, character_id, checkpoint_id, slot_type (manual/auto), label, created_at |
| **SessionMeta** | session_id, character_id, start_time, end_time, event_count, last_checkpoint_id |

---

## 17.7 Integration with Existing Codebase

- `mutationLog.ts`: already implements hash-chain ledger (hardened, ~98% test coverage)
- `stateRebuilder.ts`: stub — needs implementation for checkpoint-to-current replay
- `saveLoadEngine.ts`: stub — needs save slot management, snapshot creation, load flow
- `worldEngine.ts`: tick-based simulation already dispatches events; needs checkpoint hooks
