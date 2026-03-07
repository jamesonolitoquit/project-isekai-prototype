# DSS 16 — The Matriarchal Genesis Template & World Fuel System

## 16.1 The Genesis Template Architecture
The **Genesis Template** is the foundational configuration that seeds a world instance with initial conditions, faction structures, and ancestral lineages. It is the "fuel" that drives all simulation layers (DSS 00-15).

### 16.1.1 Template Manifest Structure
```json
{
  "TemplateID": "matriarchal-genesis-v1",
  "Metadata": {
    "Name": "The Matriarchal Enclave",
    "Description": "A world seeded with female ancestral dominance and divine maternity",
    "WorldEpoch": "Epoch I: Awakening",
    "CreatedAt": "2026-01-01T00:00:00Z",
    "Version": 1.2
  },
  "GlobalConstants": {
    "TickDuration": 1.5,
    "DayLength": 1440,
    "MaxConcurrentPlayers": 32,
    "InitialParadoxDebt": 0,
    "InitialStability": 0.65
  },
  "FactionalSeed": {
    "factions": [
      {
        "id": "house-matriarch",
        "name": "House of the Eternal Mother",
        "powerScore": 45,
        "controlledLocationIds": ["temple-core", "ancestral-sanctuary"],
        "causalBudgetPerDay": 120
      }
    ],
    "relationships": [
      {
        "factionAId": "house-matriarch",
        "factionBId": "lunar-sisterhood",
        "type": "alliance",
        "weight": 85
      }
    ]
  },
  "AncestryAvailability": [
    "human-bloodline-alpha",
    "elf-starborn",
    "dwarf-stonekin",
    "fae-moonborn"
  ],
  "TalentPool": [
    "ancestral-echo",
    "matriarchal-blessing",
    "bloodline-resonance",
    "womb-magic",
    "lunar-intuition"
  ],
  "DivinePresence": [
    "deityid-great-mother",
    "deityid-moon-sovereign"
  ],
  "EconomicModel": "resource-chain-matriarchal-fertility",
  "SecurityPatches": ["causal-lock-v1.2", "phase0-input-discard-v1.2"]
}
```

---

## 16.2 Matriarchal Social Weight Mechanic
The Matriarchal Genesis Template applies a **Social Weight Bias** to all relationship and faction dynamics.

### 16.2.1 Gender & Social Authority Curve
- **Female Characters:** Faction ActionBudget contribution is boosted by +15%.
- **Male Characters:** Faction ActionBudget contribution is reduced by -10%.
- **Non-Binary Characters:** Standard ActionBudget (no modifier).
- **Deity Alignment:** If the active Deity is the "Great Mother," all female-led factions gain a +10% Reputation multiplier per Tick.

### 16.2.2 Ancestral Lineage Tracking
Each character inherits a **Matriarchal Lineage Score**:
```ts
MatriarchalLineageScore = f(
  AncestryMatriarchLeaning,      // +30 to +50 depending on ancestry
  CurrentCHA modifier,            // +1 per CHA point above 10
  ActiveCovenants,                // +10 per Divine Maternal Covenant
  Allies_SocialWeight             // Aggregated from allied female leaders
)
```

**Threshold Effects:**
- **> 100:** Character unlocks "Matriarchal Mandate" (CHA-based faction authority)
- **75-100:** Standard social authority
- **50-75:** Social friction (-10% negotiation effectiveness in matriarchal factions)
- **< 50:** Potential alienation from matriarchal structures (dialogue gate)

### 16.2.3 The Womb-Magic Talent (Genesis Constraint)
This talent is **world-locked to Matriarchal Genesis Template only**.

```ts
Talent: WombMagic {
  id: "womb-magic",
  name: "Womb Magic",
  description: "Channel life-force from ancestral bloodlines to heal, summon, or restore the world.",
  compatibility: {
    worldTemplates: ["matriarchal-genesis-v1"],
    ancestries: ["human-bloodline-alpha", "elf-starborn", "fae-moonborn"],
    gender_preference: "female"  // Can be used by male/NB, but with -25% effectiveness
  },
  modifiers: {
    "healing_output": 1.5,       // +50% healing power
    "max_mp": 50,                // +50 max MP
    "paradox_debt_reduction": 0.05 // Heals 5% of max paradox debt per active ritual
  },
  levelCap: 10,
  learningReqs: {
    workstationRequired: "ancient-womb-altar",
    baseRequirement: "WIS > 12",
    costPerLevel: ["ancestral-essence-x10", "matriarchal-token-x5"]
  }
}
```

**Stress Test Concern:** Can male characters exploit Womb-Magic healing to trivialize the Matriarchal Dominance hierarchy?

---

## 16.3 Ancestral Echo System (Genesis Fuel)
The Genesis Template injects **Ancestral Echoes**—dormant memories from matriarchal lineages that awaken during critical moments.

### 16.3.1 Echo Trigger Conditions
Ancestral Echoes activate when:
1. **Lineage Below Threshold:** MatriarchalLineageScore < 50 (character needs guidance)
2. **Ritual Alignment:** Character performs specific ritual at Ancestral Sanctuaries
3. **Paradox Threshold:** Character's Paradox Debt > 50 (reality becoming unstable)
4. **Divine Covenant:** Player has active "Maternal Covenant" with Great Mother deity

### 16.3.2 Echo State Machine
```
[Dormant] 
  → (Trigger Condition Met) 
  → [Awakening] (1 Tick delay, vision/dream sequence)
  → [Active] (Provides CHA/WIS bonus +2, lasts 10 Ticks)
  → [Fading] (Bonus reduced by -1 per Tick for 5 Ticks)
  → [Dormant] (Can re-trigger after cool-down: 20 Ticks)
```

**Stress Test Concern:** Can a player spam Echo triggers to infinitely extend the +2 CHA bonus?

---

## 16.4 The Matriarchal Covenant System
Divine Covenants specific to the Genesis Template create binding agreements with the Great Mother.

### 16.4.1 Covenant Types (PATCH 4.1: Soul's Reprieve Added)
| Covenant | Requirement | Benefit | Cost per Tick |
|----------|-------------|---------|---------------|
| **Maternal Shield** | Faith > 30, Lineage > 50 | +25% Damage Reduction | 2 Sanity |
| **Bloodline Resonance** | WIS > 14, Level > 5 | Automatic enemy detection @ 50m | 1 Sanity |
| **Womb Sanctuary** | CHA > 12, Ritual Level 3+ | Heal 5 HP/Tick at Ancestral Altars | 3 Sanity |
| **Matron's Judgment** | Justice Faction Rep > 50 | +3 Dialog DC vs male NPCs | 0 (passive) |
| **Soul's Reprieve** *(NEW)* | Faith > 50, Meditation Skill 2+ | Restore 3 Sanity/Tick while meditating | 0 (meditation-only) |

**Note:** Soul's Reprieve covenant allows players to maintain longer covenant uptime by enabling Sanity recovery during meditation. Reduces friction from 6 Sanity/Tick drain (4 covenants) to ~3 effective drain ratio.

**Stress Test Concern:** Can stacking all 5 covenants create overpowered synergies?

---

## 16.5 World Fuel: The Replenishment Loop
Every Genesis Template includes a **Fuel Generator** that sustains faction power and divine presence.

### 16.5.1 Resource Generation per Day (24 hours = 1440 Ticks)
```
Matriarchal Genesis Fuel = f(
  FactionTerritoryCoverage,   // +5 fuel per controlled location
  ActiveCovenant_Count,        // +10 fuel per active covenant
  DivineFaithMass,             // +2 fuel per Faith point in Great Mother
  PlayerPopulation,            // +3 fuel per active player character
  WorldStability               // Linear 0-40 fuel scaling
)
```

**Example Calculation:**
- 4 controlled locations: +20 fuel
- 2 active covenants (12 players): +24 fuel
- Faith Mass in Great Mother: 150 → +300 fuel
- Active players: 8 → +24 fuel
- World Stability: 0.65 → +26 fuel
- **Total per Day: ~394 fuel**

### 16.5.2 Fuel Expenditure
Factions consume fuel to execute high-impact actions:

| Action | Fuel Cost | Cooldown |
|--------|-----------|----------|
| Faction Military Conquest | 50 | 48 hours |
| Divine Miracle (Great Mother) | 100 | 12 hours |
| Ancestral Echo Mass Awakening | 75 | 24 hours |
| Matriarchal Edict (World-Wide Buff) | 120 | 72 hours |
| Territory Consolidation | 30 | 6 hours |

**Stress Test Concern:** Can factions with high Fuel generation execute unlimited high-impact actions?

---

## 16.6 Security Constraints for Genesis Template

### 16.6.1 Anti-Abuse Mechanisms
1. **Fuel Capping:** Daily fuel generation is capped at 500 to prevent exponential growth.
2. **Covenant Limit:** Maximum 4 active covenants per character (enforced at bind-time).
3. **Echo Cool-Down:** Mandatory 20-Tick cool-down between Echo triggers (prevents spam).
4. **Lineage Decay (PATCH 1.3):** MatriarchalLineageScore decays by -2 per 4 hours (increased from -1 per day) to prevent Echo cascade farming. For every Echo triggered beyond the 4th echo in a 24-hour window, decay rate doubles (-4 per 4 hours for 5th+).
5. **Faith Dilution:** If >5 covenants are active across all players, each covenant's benefit is reduced by (CovenantCount - 4) × 5%.

### 16.6.2 Paradox Debt Interaction
- **Womb-Magic Paradox Reduction:** While leveling Womb-Magic, Paradox Debt is reduced by 0.05 per cast (Stress Patch 1.3).
- **Throttle Applied:** Womb-Magic can be cast once per hour (cool-down enforced). Paradox reduction only applies if current Paradox Debt > 50 (prevents trivial farming at low debt levels).
- **Guild Coordination Cap:** Maximum 2 concurrent Womb-Magic rituals per active zone. Exceeding this triggers "Ritual Exhaustion" (1-hour cooldown on Womb-Magic for entire zone).
- **Abuse Vector Mitigated:** Solo farming time increased from 2.5 hours to ~12 hours; guild coordination nerfed to prevent mass debt farming.

---

## 16.7 The "Matron Ascension" Victory Condition
The Genesis Template unlocks a unique **Matron Ascension** path distinct from the standard Mirror Path (DSS 07.4).

### 16.7.1 Ascension Requirements
1. **Female Character** (or declares Feminine Identity)
2. **MatriarchalLineageScore > 150** (requires sustained faction interactions)
3. **Paradox Debt = 0** (clean causal slate)
4. **Faith in Great Mother > 500** (massive divine alignment)
5. **Womb-Magic Level 10** (mastery of ancestral magic)
6. **Faction Dominance > 60%** (matriarchal faction controls world)

### 16.7.2 Ascension Ritual (PATCH 3.2: Term Limits & Succession)
When all conditions are met, the character can perform the **Ritual of Eternal Motherhood** at the Temple Core:
- **Duration:** 60 Ticks (90 seconds of real-time immersion)
- **Resource Drain:** 500 Fuel (must have sufficient faction reserves)
- **Outcome:** Character becomes a **Matron Authority NPC** with temporary governance powers for exactly **72 hours**:
  - Can decree laws affecting all NPCs (standard-tier decrees only, no permanent world edits)
  - All NPCs obey Matron's decrees for the 72-hour term
  - After 72 hours, all decrees expire and Matron authority returns to the Genesis Altar
  - Future player characters inherit +10 Matriarchal Lineage from this Matron (permanent, non-revoked)
  - Matron status cannot be revoked mid-term (protected by DSS 02 Causal Lock)
- **Succession Mechanism:** When Matron term expires:
  - Any player can attempt new Ascension ritual (must re-meet all 6 requirements)
  - **Ancestral Regent:** If no successor claims Matron within 24 hours of term expiration, an NPC Regent assumes temporary control (+2 to all faction multipliers) until new Matron elected
  - **New Matron Election:** Process repeats, allowing multiple players to serve Matron role sequentially

**Patched Concern:** Term limit (72 hours) ensures no single player locks others out permanently. Succession model enables shared governance over the world's lifespan.

---

## 16.8 Stress Test Scenarios for Genesis Template

### Scenario A: Echo Spam Exploit
**Hypothesis:** Can a player trigger Ancestral Echoes repeatedly to perpetually maintain the +2 CHA bonus?

**Test:**
1. Bring MatriarchalLineageScore to < 50
2. Trigger Echo at Tick 0
3. At Tick 50 (cool-down expired), immediately re-trigger
4. Expected: Cool-down enforced, maximum echo uptime is (10 active + 5 fading) / (10 + 5 + 20 cool-down) ≈ 38% coverage
5. **Outcome:** ✅ PASS if cool-down is properly enforced

### Scenario B: Womb-Magic Paradox Farming
**Hypothesis:** Can a player cast Womb-Magic repeatedly at an Ancestral Altar to instantly reduce Paradox Debt to 0?

**Test:**
1. Accumulate Paradox Debt to 75
2. Deploy to Ancestral Altar
3. Cast Womb-Magic 60 consecutive times (15 per second, max attack speed)
4. Expected: Game detects rapid-fire casting as abuse, triggers "Ritual Exhaustion" state (1-hour cooldown, cannot cast magic)
5. **Outcome:** ✅ PASS if casting throttle is enforced

### Scenario C: Covenant Stacking Synergy
**Hypothesis:** Can 4 simultaneous covenants create overpowered stat stacking?

**Test:**
1. Bind all 4 covenants (Maternal Shield + Bloodline Resonance + Womb Sanctuary + Matron's Judgment)
2. Aggregate benefits: +25% DR, detect enemies, heal 5 HP/Tick, +3 Dialog DC
3. Enter combat scenario with +25% DR active
4. Expected: Character is survivable but not unkillable; Sanity drain from 4 covenants = 6 Sanity/Tick (death in ~8 minutes without rest)
5. **Outcome:** ✅ PASS if Sanity drain is sufficient to prevent indefinite covenant uptime

### Scenario D: Matron Ascension Locking
**Hypothesis:** If one player reaches Matron Ascension, do subsequent players get permanently locked out of progression?

**Test:**
1. First player achieves Matron Ascension
2. Future players inherit +10 Matriarchal Lineage (good)
3. But Matron has decree authority over all future NPCs
4. Can Matron decree "No male players allowed" or similar?
5. Expected: Decrees are faction-level, not player-level; restriction would block faction progression but not all content
6. **Outcome:** ✅ PASS if restriction is scoped properly

---

## 16.9 Recommended Security Patches for Genesis Template

### Patch 1: Echo Cool-Down Enforcement (v1.3)
Add hard check that prevents Echo re-trigger within 20-Tick window. Bake into state machine at [Fading] → [Dormant] transition.

### Patch 2: Ritual Casting Throttle (v1.3)
Womb-Magic (and other rituals) cannot be cast more than 1x per 10 Ticks at indoor spaces. Outdoor castings still 1x per 5 Ticks (slower research).

### Patch 3: Covenant Sanity Drain Scaling (v1.3)
Each active covenant increases Sanity drain by +1 per Tick (cumulative). At 4 covenants, character loses 2 Sanity/Tick from covenant drain alone. This forces periodic rest to prevent Fugue State (DSS 02.1).

### Patch 4: Matron Authority Scope (v1.3)
Matron decrees apply only to NPC factions, not player factions. Player-vs-Player mechanics remain democratic (voting-based, not decree-based).

---

## 16.10 Conclusion: Genesis Template Integrity
The Matriarchal Genesis Template is the "fuel system" that sustains the entire world simulation. Its security is critical because:

1. **Fuel generation drives faction power** — Unchecked fuel = unchecked faction authority
2. **Womb-Magic paradox reduction** — Direct path to end-game (Paradox Debt = 0)
3. **Covenants create permanent buffs** — Stacking covenants can break PvP balance
4. **Ascension creates hierarchy** — Early ascensions can lock out later players

**All scenarios above must pass before Genesis Template is production-ready.**

Next: **DSS 17 — Player Agency & Consent Mechanics** (Player experience validation).

---

*Document Version: 1.2*
*Security Patch Level: v1.3 (Proposed)*
*Status: Ready for Stress Testing*
