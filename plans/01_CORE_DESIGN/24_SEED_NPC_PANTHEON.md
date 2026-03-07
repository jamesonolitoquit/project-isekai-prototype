# 24 — SQL Seed: NPC Pantheon (Gods, Spirits & Legends)

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `14_NPC_SYSTEM.md`, `02_COSMOLOGY_METAPHYSICS.md`

Seed data for major NPCs: deities, primordial entities, legendary figures.
Split from NPC clergy/leaders (file 25) to keep context manageable.

---

## 24.1 Primordial & Divine Entities

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

-- Kael — Creator deity
(1, 'Kael', NULL, 'legendary', NULL, 99,
 '{"str": 99, "agi": 99, "int": 99, "cha": 99, "end": 99, "luk": 99}',
 '{"all_disciplines": true, "authority": "absolute"}',
 false, 'neutral',
 'The First Light / The Silent Architect',
 'Creator of Lux-Ar. Shaped the world from Chaos Realm energy. Set the Absolute Commands. Withdrew from direct intervention. His motivations are the deepest mystery of the setting.'),

-- Alpha — The Bound One
(2, 'Alpha', NULL, 'legendary', NULL, 99,
 '{"str": 50, "agi": 60, "int": 40, "cha": 70, "end": 99, "luk": 30}',
 '{"immortality": true, "absolute_command_dreakin_kill": true, "memory_suppressed": true}',
 false, 'playful',
 'The Bound One / The Eternal Child',
 'Immortal Dreakin bound by Chain of Patientia. Appears as young girl. No memory of her command. Will attack any Dreakin on sight (Absolute Command from Kael). Cannot be killed.'),

-- The Void Mother — Chaos entity
(3, 'The Void Mother', NULL, 'legendary', NULL, 99,
 '{"str": 80, "agi": 70, "int": 95, "cha": 85, "end": 90, "luk": 50}',
 '{"corruption_mastery": true, "void_summoning": true, "reality_tear": true}',
 false, 'hostile',
 'Mother of the Abyss',
 'Primordial chaos entity. Source of corruption bleeding into Lux-Ar. Not a faction leader — more like a force of nature. Endgame threat.'),

-- Lux-Ar Heart Guardian
(4, 'The Sentinel', NULL, 'legendary', NULL, 50,
 '{"str": 70, "agi": 50, "int": 60, "cha": 30, "end": 80, "luk": 40}',
 '{"ward_mastery": true, "elemental_immunity": true, "guardian_protocol": true}',
 false, 'neutral',
 'Guardian of the Heart',
 'Ancient construct or bound spirit guarding the Heart of Lux-Ar. Prevents unauthorized access. Not hostile unless provoked.'),

-- The Weaver — Fate entity
(5, 'The Weaver', NULL, 'legendary', NULL, 99,
 '{"str": 20, "agi": 40, "int": 99, "cha": 80, "end": 50, "luk": 99}',
 '{"fate_manipulation": true, "prophecy": true, "thread_cutting": true}',
 false, 'manipulative',
 'The Thread-Spinner / Fate''s Hand',
 'Metaphysical entity that embodies fate and causality in Lux-Ar. May or may not be a creation of Kael. Rarely manifests. When encountered, delivers cryptic prophecy. Anti-metagaming tool — predictions are WTOL-gated.');
```

## 24.2 Historical Heroes & Villains

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

-- Aelindra — First High Elf Archmage
(6, 'Aelindra', 2, 'legendary', NULL, 45,
 '{"str": 8, "agi": 14, "int": 30, "cha": 22, "end": 12, "luk": 15}',
 '{"ruin_mastery": true, "flux_mastery": true, "ancient_ward": true}',
 false, 'neutral',
 'The Arcane Progenitor',
 'First High Elf to achieve mastery of both Ruin and Flux. Founded the Mage Academies. May appear as ghost or vision in certain encounters.'),

-- Grothmar — Legendary Beastkin Warlord
(7, 'Grothmar', 4, 'legendary', NULL, 40,
 '{"str": 28, "agi": 18, "int": 10, "cha": 16, "end": 25, "luk": 8}',
 '{"morph_mastery": true, "battle_command": true, "pack_alpha": true}',
 true, 'aggressive',
 'The Unchained Beast',
 'Terran Beastkin warlord who united the clans during the Age of Blood. His morph form was unprecedented — permanent hybrid. Died in battle against Dark Elf coalition. Legacy defines current Beastkin politics.'),

-- Selene Nightwhisper — Infamous Succubus
(8, 'Selene Nightwhisper', 7, 'legendary', NULL, 35,
 '{"str": 10, "agi": 18, "int": 20, "cha": 30, "end": 12, "luk": 14}',
 '{"charm_mastery": true, "dream_infiltration": true, "political_manipulation": true}',
 true, 'manipulative',
 'The Shadow Empress',
 'Succubus who nearly toppled Luminara through political manipulation and dream walking. Established the precedent for Succubi mandatory drawbacks. Her methods are studied by both factions and cults.'),

-- Varn the Hollow — First Sanguinarian Lord
(9, 'Varn the Hollow', 8, 'legendary', NULL, 38,
 '{"str": 22, "agi": 20, "int": 16, "cha": 14, "end": 20, "luk": 6}',
 '{"blood_mastery": true, "regeneration_advanced": true, "night_command": true}',
 true, 'hostile',
 'The Crimson Patriarch',
 'First Sanguinarian to achieve Blood Mastery. Created the blood dependency curse that all Sanguinarians now carry. His tomb is a high-level dungeon. Possibly not fully dead.'),

-- Meridia — Dark Elf Prophet
(10, 'Meridia', 3, 'legendary', NULL, 30,
 '{"str": 12, "agi": 16, "int": 22, "cha": 18, "end": 14, "luk": 12}',
 '{"veil_mastery": true, "prophecy_minor": true, "shadow_walk": true}',
 false, 'neutral',
 'The Twilight Seer',
 'Dark Elf who claimed to commune with The Weaver. Her prophecies shaped early Dark Elf culture. Some prophecies remain unfulfilled — potential quest triggers.');
```

## 24.3 Belief Profiles for Pantheon NPCs

```sql
INSERT INTO NPC_BeliefProfile (npc_id, belief_layer_state, WTOL_perception, faction_alignment, reputation) VALUES
(1, '{"existence": "absolute_truth", "nature": "unknowable"}', 'ground_truth', NULL, 100),
(2, '{"bound_command": "suppressed", "identity": "unknown_to_self"}', 'partial', NULL, 0),
(3, '{"chaos_source": true, "hostile_to_order": true}', 'ground_truth', NULL, -100),
(4, '{"guardian_duty": "absolute", "loyalty": "lux_ar_heart"}', 'ground_truth', NULL, 50),
(5, '{"fate_knowledge": "complete", "disclosure": "cryptic_only"}', 'partial', NULL, 0),
(6, '{"academic_legacy": true, "magic_philosophy": "knowledge_is_power"}', 'partial', NULL, 80),
(7, '{"tribal_honor": true, "strength_defines_worth": true}', 'partial', NULL, 60),
(8, '{"power_through_charm": true, "survival_at_any_cost": true}', 'misinformation', NULL, -40),
(9, '{"blood_is_immortality": true, "hunger_is_strength": true}', 'partial', NULL, -60),
(10, '{"fate_is_real": true, "shadows_reveal_truth": true}', 'partial', NULL, 30);
```
