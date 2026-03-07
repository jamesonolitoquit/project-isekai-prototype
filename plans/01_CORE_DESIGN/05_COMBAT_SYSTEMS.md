# 05 — Combat Systems, Martial Styles & Integration with Magic

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `03_RACES_SPECIES_BIOLOGY.md`, `04_MAGIC_SYSTEMS.md`

Defines how actions resolve in martial and magical conflict, how physical and magical systems interact,
and how AI adjudicates outcomes.

---

## 5.1 Core Principles

- Combat is high-risk and context-sensitive
- Every action has cost (physical, mental, magical)
- Martial and magical systems interweave; no system exists in isolation
- Environment is an active participant (terrain, weather, chaos residue, Lux-Ar influence)
- Player intent is evaluated, not assumed successful
- AI DM enforces canon and cost rigorously

---

## 5.2 Combat Types

| Type | Description | Example Interactions |
|---|---|---|
| **Unarmed** | Martial arts, natural attacks | Beastkin claws, fist strikes |
| **One-Handed** | Sword, dagger, wand | Balanced offense/defense, spell integration |
| **Two-Handed** | Greatswords, staves | High damage, slower attacks, synergizes with Flux/Bind magic |
| **Ranged** | Bows, throwing, projectile magic | Terrain and wind affect performance |
| **Magic-Only** | Spell casting without weapon | Ruin, Flux, Veil, Bind, Life magic |
| **Hybrid** | Weapon + magic | E.g., Sword imbued with Flux or Veil spells |

---

## 5.3 Resolution Flow (Integrated System)

1. **Action Declaration** — Player declares attack, spell, morph, or combination
2. **Feasibility Check** — AI DM validates: physical reach, mana/soul capacity, weapon readiness, terrain limitations
3. **Initiative / Turn Order** — Determined by agility, reaction, and environmental modifiers
4. **Resolution Engine Roll** — Success tiers: Critical, Full, Partial, Failure, Catastrophic
5. **Cost Enforcement** — Physical, mental, magical, and corruption costs applied
6. **World Update** — Belief Layer, Faction Graphs, WTOL updated; NPC response and morale adjusted
7. **Aftermath** — Environmental damage, weapon durability, temporary buffs/debuffs

---

## 5.4 Martial Styles & Specializations

### 5.4.1 Unarmed
- Natural strikes, martial arts techniques
- **Costs:** fatigue, joint stress, health risk

### 5.4.2 One-Handed Weapons
- Sword, dagger, wand
- Allows minor spell integration (e.g., Rune imbuing)
- **Costs:** stamina, weapon wear, spell mana

### 5.4.3 Two-Handed Weapons
- Greatswords, staves, polearms
- Slower but higher damage output
- Amplifies Flux or Ruin magic synergy
- **Costs:** heavy fatigue, vulnerability during swing

### 5.4.4 Ranged Weapons
- Bow, crossbow, throwing weapons
- Terrain-dependent accuracy
- Synergizes with Veil magic (illusionary targeting)
- **Costs:** stamina, arrow/quiver supply

### 5.4.5 Hybrid Combat
- Weapon + magic
- Requires dual cost accounting
- Risk of magic backlash if morphing or corruption thresholds exceeded

---

## 5.5 Combat Mechanics

### 5.5.1 Damage Types
- **Physical:** blunt, slash, pierce
- **Elemental:** fire, frost, lightning, earth
- **Magical / Metaphysical:** soul, mind, corruption

### 5.5.2 Health & Integrity

| Pool | Tracks | Loss Consequences |
|---|---|---|
| **Health (HP)** | Body integrity | Injury → combat penalties |
| **Mental (MP / sanity)** | Cognitive integrity | Insanity → erratic behavior |
| **Soul** | Metaphysical integrity | Permanent stat decay |

### 5.5.3 Status Effects
- Poison, burn, frostbite
- Stun, paralysis
- Veil confusion (perception distortion)
- Bind restrictions (immobilization or control)
- Morph side-effects (loss of coordination, partial transformation)

---

## 5.6 Environmental Integration

- **Terrain modifiers:** hills, rivers, Abyss-adjacent zones
- **Weather / Lux-Ar cycles:** affects visibility, magic potency
- **Chaos interference zones:** random probability shifts, corruption spikes
- **Structures:** destructible or magical barriers
- **Faction presence:** morale, assistance, retaliation

---

## 5.7 AI DM Enforcement Rules

- Verify reach, line of sight, and action legality
- Apply costs immediately, including latent corruption
- Resolve conflicts between magic and physical systems via Resolution Engine
- Track progressive injuries, fatigue, and soul strain
- Apply environmental consequences after each turn

---

## 5.8 Combat Integration with Magic

| Discipline | Integration |
|---|---|
| **Ruin / Flux** | Amplifies physical attacks (elemental weapon overlays), destroys terrain or bypasses armor |
| **Veil** | Targets perception, creates partial misses, illusions, or fake positions |
| **Bind** | Controls opponents or summoned entities, combined with martial strikes for positioning advantage |
| **Life** | Healing during combat, resurrection possible at extreme cost |

**Cost Multipliers:** Morphing, Succubi, Sanguinarian: all combat + magic costs doubled unless conditions met.

---

## 5.9 Optional Tactical Depth (Future Expansion)

- Formations
- Flanking and cover bonuses
- Tactical AI for NPCs/factions
- Faction Belief influence on combat morale
- Event-driven emergent combat situations (raids, invasions)

---

## Why This Layer Holds

- Combines magic and martial action under one resolution framework
- Enforces realism and high stakes
- Provides AI DM deterministic levers for adjudication
- Scales with replayability (environment + faction variability)
- Interoperates with Belief Layer and WTOL (perceptions and misinformation)
