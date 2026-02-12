# 18 — Anti-Metagaming, Anti-Exploit & Fairness Systems

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `01_META_AUTHORITY.md`, `06_BELIEF_LAYER_WTOL.md`

Prevents metagaming, exploit abuse, and ensures fair, immersive gameplay
through AI DM enforcement, WTOL mechanics, and system-level constraints.

---

## 18.1 Core Principles

- **No metagaming:** players cannot leverage out-of-character knowledge
- **WTOL enforcement:** "What They're Told is what they Operate on" — NPCs and players act on beliefs, not absolute truth
- **Exploit prevention:** AI DM monitors for stat manipulation, inventory duplication, save scumming patterns
- **Fairness:** difficulty scaling, encounter balance, and reward distribution remain equitable
- **Transparency:** rules are clear but enforcement is invisible (no "you can't do that" popups — consequences instead)

---

## 18.2 Anti-Metagaming Mechanics

### 18.2.1 Information Asymmetry
- Players only know what their character has learned in-game
- Hidden objectives and lore revealed progressively (WTOL gating)
- NPC dialogue adapts to what the player character actually knows
- Quest hints masked until discovery conditions met

### 18.2.2 Belief Layer Enforcement
- Player's Belief Layer tracks what they've been told (not ground truth)
- Actions based on unlearned information flagged by AI DM
- Consequences for acting on metagame knowledge: faction suspicion, NPC distrust, quest penalties

### 18.2.3 Replayability Protection
- Randomized encounter spawns, NPC positions, quest variations per playthrough
- Canonical events fixed but emergent content differs
- Previous-playthrough knowledge doesn't guarantee same outcomes

---

## 18.3 Anti-Exploit Systems

### 18.3.1 Save Scumming Mitigation
- Auto-save frequency limits manual save abuse
- AI DM tracks reload frequency; excessive reloads trigger world-state drift (minor NPC changes, weather shifts)
- Death penalties persist across reloads (soul integrity loss)

### 18.3.2 Stat & Inventory Exploits
- Hash-chain mutation log detects unauthorized state changes
- Item duplication prevented by inventory transaction logging
- Stat overflow checks on every level-up and morph transition

### 18.3.3 Combat Exploits
- AI DM monitors for: terrain abuse (clipping, unreachable positions), morph-spamming (rapid form switching for invulnerability), resource regeneration loops
- Detected exploits: AI DM applies diminishing returns, cooldown penalties, or NPC tactical adaptation

---

## 18.4 Fairness Systems

- **Dynamic Difficulty:** AI DM adjusts encounter difficulty, loot quality, and quest rewards based on player performance (not punitive — aimed at engagement)
- **Faction Balance:** minimum 2 active factions maintained; no single faction dominance without narrative justification
- **Morphing Balance:** morph cooldowns, END costs, and duration limits prevent permanent optimal-form play
- **Economy Balance:** crafting material scarcity, merchant pricing, and loot drop rates calibrated per region and level

---

## 18.5 AI DM Enforcement Rules

| Rule | Mechanism | Consequence |
|---|---|---|
| Metagame Knowledge Use | Belief Layer vs Action comparison | NPC suspicion, quest penalty |
| Save Scumming | Reload frequency tracking | World-state drift, soul integrity loss |
| Item Duplication | Inventory transaction log hash verification | Item removal, corruption flag |
| Stat Overflow | Level-up and morph transition checks | Stat rollback, warning |
| Combat Exploit | Behavioral pattern recognition | Diminishing returns, cooldowns |
| Economy Exploit | Trade frequency and volume monitoring | Merchant price adjustment, supply reduction |

---

## 18.6 Database Tables

| Table | Key Fields |
|---|---|
| **AntiExploitLog** | character_id, exploit_type, detection_method, action_taken, timestamp |
| **ReloadTracker** | character_id, session_id, reload_count, world_drift_applied, timestamp |
| **BeliefActionAudit** | character_id, action_id, belief_state_at_action, ground_truth_state, metagame_flag |
