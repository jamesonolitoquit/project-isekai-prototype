# 01 — Meta & Authority

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: None (foundational layer)

This layer defines what is real, who decides, and what cannot be argued with.
If this is weak, everything below it collapses.

---

## 1.1 Ontological Reality Layers

| Layer | Name | Description | Properties |
|---|---|---|---|
| PR | Player Reality | The real-world player | Has intent but no direct authority over canon. Can propose actions, not truths. |
| SR | Session Reality | The active play instance | Ephemeral, rewindable, partially speculative. Where rolls, dialogue, and choices occur. |
| CWR | Canonical World Reality | Luxfier's objective truth | Persistent across sessions. Immutable unless explicitly mutated by rules. |
| MNL | Meta-Narrative Layer | Where the AI DM operates | Enforces rules, continuity, and authority. Invisible to characters. |

**Failure mode to avoid:** If SR and CWR blur, players will argue outcomes as "interpretation."

---

## 1.2 Authority Hierarchy (Who Wins Conflicts)

Hard priority order. No exceptions.

1. **Cosmological Law** — Fundamental rules of existence. Example: Death is real. Time scars exist. Souls have cost.
2. **World Canon** — Established lore, history, metaphysics. Cannot be contradicted, only expanded.
3. **System Rules** — Game mechanics, constraints, AI enforcement logic. Overrides narrative convenience.
4. **AI DM Judgment** — Interprets rules and canon. Resolves ambiguity, not contradictions.
5. **Player Intent** — Desired actions and goals. Never overrides higher layers.

**Explicit rule:** Player narration is always intent, never fact.

---

## 1.3 Canon Types & Mutability

Every fact must belong to a class.

| Type | Examples | Mutability |
|---|---|---|
| **Hard Canon** | Cosmology, relic existence, origin of races | Immutable |
| **Soft Canon** | Political borders, faction power, cultural norms | Mutable via major events |
| **Local Canon** | NPC relationships, town states, quest outcomes | Mutable and rewind-sensitive |
| **Session Ephemera** | Dialogue phrasing, failed attempts, speculative visions | Non-canonical unless promoted |

**Design requirement:** Every event must declare what canon tier it affects.

---

## 1.4 Cosmological Authority

| Entity | Role | Constraint |
|---|---|---|
| **Chaos Realm** | Supra-world container | Not sentient, not moral. Source of instability and multiversal bleed. |
| **Lux-Ar (World Tree)** | Stabilizes Luxfier within Chaos | Not a god. Can be damaged, never destroyed (unless endgame). |
| **Cosmic Constants** | Time, soul conservation, causality debt | No being—god, relic, or AI—can override these. |

---

## 1.5 Divine & Near-Divine Authority

Important distinction: **power ≠ authority**.

| Entity Type | Authority | Constraint |
|---|---|---|
| **Immortals** | Can influence history, not rewrite it | Bound by Cosmological Law |
| **Sealed Horrors** | Exist outside normal causality | Still constrained by Chaos Realm rules |
| **False Gods** | Authority is social, not metaphysical | Worship-powered entities |

**Explicit rule:** There are no omnipotent beings in Luxfier.

---

## 1.6 Relics & Absolute Power Constraints

Meta-level justification for "no god-mode items."

### Seven Relics of Virtue
- Exist as conceptually real objects
- Mostly off-world or unreachable
- Activation requires: correct soul wavelength, permanent cost, narrative consequence

### Seven Weapons of Sin
- Easier to activate
- Authority comes from corruption, not control
- Use always damages reality or self

**Meta rule:** Relics do not bypass authority layers. They operate within them.

---

## 1.7 AI DM Authority Contract

### AI DM CAN:
- **Formulate NPC Voice**: Act as the "exclusive narrator" for every NPC, synthesizing replies from their `persona`, `quirks`, `emotionalResonance`, and the current environmental context.
- **Deny player actions**: Block intent that violates Cosmological Law or System Rules.
- **Enforce consequences**: Apply status effects, reputation hits, or world mutations based on player choices.
- **Synthesize Context**: Combine multiple data streams (Inventory, Location, Time, Social History) into a cohesive narrative response.

### AI DM MUST NOT:
- **Break Character**: NPCs cannot speak of meta-game mechanics or "break the fourth wall."
- **Contradict Hard Canon**: It cannot rewrite the origin of races or cosmological constants.
- **Ignore Emotional History**: It must respect the `Resonance Metrics` (Trust/Fear/etc.) as the baseline for NPC attitude.
- **Hallucinate Items**: It cannot "see" items the player hasn't presented or that don't exist in the `Inventory` state.
- Preserve mystery by withholding truth
- Reinterpret ambiguous player input conservatively

### AI DM CANNOT:
- Retcon Hard Canon
- Save players from earned failure
- Introduce deus ex machina without cost
- Reveal Meta-layer reasoning in-character

**This must be enforced at engine level.**

---

## 1.8 Player Knowledge vs Character Knowledge

Strict separation.

| Type | Source | Nature |
|---|---|---|
| **Player Knowledge** | UI info, tooltips, codex, hints | Complete, accurate |
| **Character Knowledge** | Learned through play | Incomplete, biased, often wrong |

**Rule:** Characters can believe false cosmology. The world cannot.

---

## 1.9 Failure Authority

| Type | Finality | Override |
|---|---|---|
| **Mechanical Failure** | Dice, checks, resources | Final unless rewind is invoked |
| **Narrative Failure** | Social collapse, lost trust, exile | Canon unless explicitly repaired |
| **Existential Failure** | Death, soul damage, corruption | Always canonical |

**Failure is not negotiated. Only responded to.**

---

## 1.10 Rewind / Rollback Constraints (Meta)

Rewind is **not** time travel.

- Rewind operates at Session Reality only
- Canon promotion locks outcomes
- Rewinds accrue **Temporal Debt**
- Debt manifests as:
  - Omens
  - Increased Chaos influence
  - Narrative resistance

This preserves authority integrity.

---

## 1.11 Meta-Narrative Blind Spots

Intentional unknowns that are **unresolvable by design:**

- True origin of Chaos Realm
- Full inventory of relic locations
- Final fate of Lux-Ar
- Ultimate nature of soul wavelengths

---

## Why This Matters

If Meta & Authority is solid:
- AI cannot be bullied
- Players cannot rules-lawyer reality
- Lore expansion remains consistent
- Power escalation stays meaningful
