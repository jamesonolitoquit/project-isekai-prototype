# 06 — Belief Layer & World Truth Obfuscation Layer (WTOL)

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `01_META_AUTHORITY.md`, `02_COSMOLOGY_METAPHYSICS.md`

Governs how knowledge, perception, misinformation, and secret truths are tracked in Luxfier.
Critical for AI DM adjudication, emergent narrative, and replayability — especially in mystery-first design.

---

## 6.1 Core Principles

- Truth is multi-tiered: not everything is known, and not all beliefs reflect reality
- Beliefs influence behavior: faction and character decisions are guided by what they think is true
- WTOL protects canon: certain facts are secret, inaccessible, or dangerous to reveal
- Replayability is maintained: belief discrepancies create emergent narratives
- AI DM adjudicates perception vs reality dynamically

---

## 6.2 Layers of Belief

| Layer | Scope | Mutable? | Notes |
|---|---|---|---|
| **Character Belief (CB)** | Individual NPC or PC knowledge | Yes | Can be wrong, incomplete, or biased |
| **Faction Belief (FB)** | Shared cultural or organizational beliefs | Yes | Guides AI faction behavior |
| **Player Belief (PB)** | What the player knows via UI, logs, hints | Yes | Does not alter world canon |
| **World Truth (WT)** | Canonical reality | No | Only altered by sanctioned canon mutations |
| **WTOL** | Conceals sensitive or dangerous truths | Yes | Dynamic masking, selective revelation |

---

## 6.3 Belief Attributes

Each belief has:
- **Truth Value** — True / False / Unknown / Partial
- **Confidence Level** — 0–100
- **Source** — Personal, Faction, Observation, Artifact, AI Hint
- **Impact** — Gameplay effect, narrative consequence, faction reaction
- **Temporal Decay** — Beliefs fade or become outdated if not reinforced
- **Conflict Resolution Rules** — AI uses authority hierarchy to adjudicate contradictions

---

## 6.4 Belief Updates

| Trigger | Effect |
|---|---|
| **Observation** | Players or NPCs witness events → CB updated |
| **Dialogue / Propaganda** | FB updated via rumors, faction messaging |
| **Artifacts / Relics** | Can trigger belief shifts if interacted with (subject to WTOL) |
| **AI Interventions** | Hidden hints, visions, dreams, or narrative nudges |
| **Reality Feedback** | WTOL may force gradual belief correction or maintain deception |

**Rule:** All updates respect Meta & Authority; hard canon cannot be misrepresented.

---

## 6.5 WTOL Mechanics

- **Concealment** — Certain facts (e.g., Seven Relics, True History, Human origins) are invisible to CB or PB unless narrative triggers occur
- **Dynamic Obfuscation** — Facts may appear partially, misinterpreted, or corrupted
- **Risk of Revelation** — Attempting forbidden knowledge triggers: corruption exposure, temporal debt, narrative consequences
- **Faction Awareness** — Factions may hold partial truths, resulting in inter-faction conflict or manipulation

---

## 6.6 AI DM Enforcement & Synthesis

The AI DM acts as the "Gatekeeper of Truth." When formulating NPC replies, it performs a **WTOL Filter Pass**:

1.  **Context Check**: What does the NPC *believe* to be true (CB)?
2.  **Obfuscation Logic**: If the Player asks about a "World Truth" (WT) that is masked by WTOL, the AI DM must decide:
    *   **Denial**: The NPC genuinely doesn't know.
    *   **Misdirection**: The NPC provides a Faction-sanctioned lie (FB).
    *   **Corruption**: The NPC speaks in tongues or triggers a "Chaos Bleed" (see MNL authority).
3.  **Metagame Filtering**: The AI DM strips out any Player Beliefs (PB) from the NPC's context window. The NPC will not react to things the player knows but the character has no way of seeing.

---

## 6.7 Belief Influence on Gameplay

### Combat
- Misjudged terrain or enemy stats based on false beliefs → mechanical penalties
- Faction morale influenced by belief accuracy

### Social Interaction
- Persuasion / intimidation effectiveness varies by target beliefs
- Propaganda and misinformation can shift CB / FB dynamically

### Exploration & Questing
- Hidden events trigger only when belief thresholds met
- False beliefs can mislead or challenge players, increasing replayability

### Magic Interaction
- Veil and Bind magic can directly manipulate CB of NPCs
- High-tier magic may be required to bypass WTOL restrictions

---

## 6.8 Database Representation (Suggested Fields)

| Table | Key Fields |
|---|---|
| **Belief** | belief_id, entity_id, belief_text, truth_value, confidence, source, timestamp, decay_rate |
| **FactionBelief** | faction_id, belief_id, consensus_level, reinforcement_history |
| **WTOL** | fact_id, concealed_level, access_conditions, corruption_risk, revelation_trigger |
| **BeliefLog** | session_id, entity_id, belief_id, previous_confidence, current_confidence, event_triggered |

---

## 6.9 Failure & Edge Cases

- Contradictory beliefs → AI applies authority hierarchy to resolve conflicts
- Attempted revelation of WTOL-protected truths → triggers Corruption Progression
- Belief loops (e.g., faction A believes B believes C…) → AI limits recursion to prevent paradoxes

---

## Why This Layer Holds

- Ensures mystery-first design: players never have full information
- Supports infinite replayability: each session, beliefs can diverge
- Ties narrative, combat, magic, and faction systems together
- Gives AI DM clear levers to control perception without breaking canon
