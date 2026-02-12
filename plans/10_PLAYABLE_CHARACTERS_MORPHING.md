# 10 — Playable Characters, Morphing Mechanics & Race-Specific Systems

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `03_RACES_SPECIES_BIOLOGY.md`, `05_COMBAT_SYSTEMS.md`

Fully integrates base stats, morphing costs, and race-specific abilities.
Includes a player-customizable point allocation system.

---

## 10.1 Core Principles

- All races are playable, including mortal (Elfin, Beastkin) and immortal subtypes (Succubi, Sanguinarians), with race-specific trade-offs
- Morphing is a core mechanic for Beastkin, Succubi, and Sanguinarians, with costs proportional to power and frequency
- Stats are balanced: base stats vary per race, but players can customize using points
- Character customization influences gameplay, combat, magic, faction interactions, and narrative

---

## 10.2 Base Attributes

| Attribute | Description |
|---|---|
| **STR (Strength)** | Physical power, melee damage, carrying capacity |
| **AGI (Agility)** | Speed, evasion, initiative, ranged combat |
| **INT (Intelligence)** | Magic potency, crafting efficiency, problem-solving |
| **CHA (Charisma)** | Persuasion, idol influence, faction interaction |
| **END (Endurance)** | Health pool, stamina, fatigue resistance |
| **LUK (Luck)** | Critical success chance, rare loot, event outcomes |

**Customization:** Players get 20 points to distribute across attributes after applying racial base stats.

---

## 10.3 Racial Base Stats & Traits

| Race | STR | AGI | INT | CHA | END | LUK | Special Traits |
|---|---|---|---|---|---|---|---|
| Common Elfin | 2 | 3 | 3 | 2 | 3 | 2 | Balanced diplomacy & magic |
| High Elves | 2 | 2 | 4 | 3 | 2 | 3 | Arcane mastery, natural aura bonus |
| Dark Elves | 2 | 3 | 3 | 2 | 2 | 4 | Veil magic proficiency, stealth bonus |
| Terrans (Beastkin) | 3 | 3 | 2 | 2 | 3 | 2 | Morphing: partial animal form; combat bonus at cost of END |
| Avians (Beastkin) | 2 | 4 | 2 | 2 | 2 | 3 | Flight; morphing for temporary wings (AGI bonus, END cost) |
| Merrans (Beastkin) | 2 | 3 | 2 | 2 | 3 | 2 | Aquatic adaptability; morphing for fins/gills |
| Succubi | 2 | 3 | 3 | 4 | 2 | 2 | Life-force absorption; morphing cost doubles; social manipulation |
| Sanguinarians | 3 | 3 | 3 | 3 | 2 | 2 | Blood magic; morphing cost doubles; corruption risk |

**Balance notes:** Succubi and Sanguinarians are highly capable in specific domains but pay greater costs in morphing, corruption, or endurance.

---

## 10.4 Morphing Mechanics

### 10.4.1 Core Rules
- **Types:** Full morph, partial morph, temporary augmentations (wings, claws, fins)
- **Costs:** END reduction proportional to morph power and duration; corruption/soul strain for Succubi and Sanguinarians; cooldown between transformations
- **Limits:** Cannot exceed racial max; overuse triggers fatigue, temporary stat loss, permanent corruption risk

### 10.4.2 Integration with Combat
- Morphing modifies stats dynamically: STR/AGI boosts for physical forms, INT/CHA boosts for specific forms
- Costs applied per combat round
- AI DM monitors morph limits

### 10.4.3 Integration with Magic
- **Flux Magic:** enhances transformation efficiency
- **Veil Magic:** disguises morph forms or misleads opponents
- **Bind / Life Magic:** synergistic effects or additional strain

---

## 10.5 Character Creation Flow

1. **Select Race** — applies base stats & special traits
2. **Distribute Custom Points** — 20 points across STR, AGI, INT, CHA, END, LUK
3. **Select Background / Origin** — optional flavor, may influence Belief Layer or faction starting point
4. **Assign Starting Equipment** — optional, faction or tutorial dependent
5. **Review Morphing Potential & Costs** — displayed to player
6. **Finalize Character** — persist to Character Profiles in database

---

## 10.6 Database Representation

| Table | Key Fields |
|---|---|
| **CharacterProfile** | character_id, player_id, race, sub_race, base_stats, allocated_points, traits, morphing_capacity, faction_id, creation_timestamp |
| **MorphingLog** | character_id, morph_type, duration, cost_applied, timestamp |
| **Abilities** | character_id, ability_name, type, level, usage_count, cooldown |

---

## 10.7 AI DM Enforcement

- Validates morphing actions: cost adherence (END, corruption, cooldown), race-specific limits, combat and magic integration
- Updates Belief Layer and Faction Graphs dynamically if player morphing influences NPC perceptions

---

## Why This Layer Holds

- Balances player customization with racial uniqueness
- Morphing creates tactical depth, environmental adaptation, and replayability
- Integrates with combat, magic, faction, and belief systems
- Supports AI DM enforcement for balance and canon adherence
