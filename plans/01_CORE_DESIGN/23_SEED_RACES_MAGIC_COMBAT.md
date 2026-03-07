# 23 — SQL Seed: Races, Magic & Combat

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `03_RACES_SPECIES_BIOLOGY.md`, `04_MAGIC_SYSTEMS.md`, `05_COMBAT_SYSTEMS.md`

Seed data for Races, MorphForms, MagicDisciplines, Spells, Weapons, and CombatStyles.

---

## 23.1 Races

```sql
INSERT INTO Races (race_id, race_name, sub_race, base_str, base_agi, base_int, base_cha, base_end, base_luk, morph_capable, morph_type, racial_traits_json, mandatory_drawbacks_json) VALUES
(1, 'Elfin', 'Common Elf', 10, 14, 13, 12, 10, 11, false, 'none',
 '{"longevity": true, "nature_affinity": true, "keen_senses": true}', '{}'),
(2, 'Elfin', 'High Elf', 8, 12, 16, 14, 9, 11, false, 'none',
 '{"arcane_mastery": true, "magical_resistance": true, "ancient_knowledge": true}', '{"physical_frailty": true}'),
(3, 'Elfin', 'Dark Elf', 11, 15, 14, 10, 11, 9, false, 'none',
 '{"shadow_affinity": true, "darkvision": true, "veil_sensitivity": true}', '{"sunlight_weakness": true}'),

(4, 'Beastkin', 'Terran', 16, 12, 8, 10, 14, 10, true, 'full',
 '{"beast_strength": true, "terrain_adaptation": true, "pack_tactics": true}', '{}'),
(5, 'Beastkin', 'Avian', 9, 16, 11, 12, 10, 12, true, 'full',
 '{"flight": true, "keen_sight": true, "hollow_bones": true}', '{"fragile_frame": true}'),
(6, 'Beastkin', 'Merran', 12, 13, 12, 11, 13, 9, true, 'full',
 '{"aquatic_breathing": true, "water_speed": true, "pressure_resistance": true}', '{"land_speed_penalty": true}'),

(7, 'Succubus', 'Succubus', 8, 13, 14, 18, 9, 8, true, 'partial',
 '{"charm_aura": true, "emotion_sense": true, "dream_walk": true, "shape_shift_face": true}',
 '{"energy_drain_dependency": true, "soul_fragility": true, "emotional_overload": true, "trust_deficit": true}'),

(8, 'Sanguinarian', 'Sanguinarian', 14, 14, 12, 10, 12, 8, true, 'partial',
 '{"blood_power": true, "regeneration": true, "night_enhanced": true, "predator_sense": true}',
 '{"blood_dependency": true, "sunlight_damage": true, "frenzy_risk": true, "social_stigma": true}');
```

## 23.2 MorphForms

```sql
INSERT INTO MorphForms (form_id, race_id, form_name, stat_modifiers_json, end_cost, duration_max, cooldown, restrictions_json) VALUES
-- Terran Beastkin
(1, 4, 'Bear Form', '{"str": 6, "end": 4, "agi": -3}', 5, 600, 120, '{"combat_only": false}'),
(2, 4, 'Wolf Form', '{"agi": 5, "str": 2, "cha": -2}', 3, 480, 90, '{"combat_only": false}'),
(3, 4, 'Hybrid War Form', '{"str": 4, "agi": 4, "end": 2, "cha": -4}', 8, 300, 180, '{"combat_only": true, "min_level": 5}'),

-- Avian Beastkin
(4, 5, 'Eagle Form', '{"agi": 8, "str": -2, "end": -2}', 4, 360, 120, '{"enables_flight": true}'),
(5, 5, 'Hawk Hybrid', '{"agi": 5, "int": 2, "str": -1}', 6, 240, 150, '{"combat_only": true, "enables_flight": true}'),

-- Merran Beastkin
(6, 6, 'Deep Sea Form', '{"end": 6, "str": 3, "agi": 2, "cha": -3}', 4, 600, 90, '{"aquatic_only": true}'),
(7, 6, 'Amphibian Hybrid', '{"agi": 3, "end": 3, "str": 1}', 5, 480, 120, '{"combat_only": false}'),

-- Succubus
(8, 7, 'Alluring Visage', '{"cha": 6, "int": 2, "str": -2, "end": -2}', 3, 300, 60, '{"social_only": true}'),
(9, 7, 'Shadow Veil Form', '{"agi": 4, "cha": 2, "str": -3}', 5, 240, 120, '{"combat_only": false}'),

-- Sanguinarian
(10, 8, 'Blood Frenzy', '{"str": 6, "agi": 4, "int": -4, "cha": -4}', 7, 180, 200, '{"combat_only": true, "frenzy_risk": 0.15}'),
(11, 8, 'Night Stalker', '{"agi": 5, "cha": 2, "str": 1}', 4, 360, 150, '{"night_only": true}');
```

## 23.3 MagicDisciplines

```sql
INSERT INTO MagicDisciplines (discipline_id, discipline_name, source_type, description, forbidden_subtypes_json) VALUES
(1, 'Ruin', 'soul',
 'Elemental destruction magic. Fire, ice, lightning, earth. Direct damage and area control.',
 '["Soul Rend", "Chaos Storm", "Void Flame"]'),
(2, 'Flux', 'environmental',
 'Matter and energy manipulation. Transmutation, telekinesis, gravity control.',
 '["Time Fracture", "Reality Tear", "Permanence Break"]'),
(3, 'Veil', 'soul',
 'Illusion, perception manipulation, stealth enhancement. Affects minds and senses.',
 '["Mind Break", "Memory Erase", "Identity Theft"]'),
(4, 'Bind', 'artifact',
 'Summoning, control, tethering. Calls entities or binds objects/creatures.',
 '["Soul Bind Permanent", "Chaos Summon", "Free Will Override"]'),
(5, 'Life', 'soul',
 'Healing, restoration, nature magic, resurrection attempts. Most taxing on soul integrity.',
 '["True Resurrection", "Undeath Creation", "Soul Harvest"]');
```

## 23.4 Spells (Sample Alpha Set)

```sql
INSERT INTO Spells (spell_id, discipline_id, spell_name, tier, mana_cost, soul_cost, end_cost, cooldown, effects_json, requirements_json) VALUES
-- Ruin spells
(1, 1, 'Flame Bolt', 1, 10, 0.00, 2, 3, '{"damage": 25, "type": "fire", "aoe": false}', '{"min_level": 1, "min_int": 8}'),
(2, 1, 'Ice Shard', 1, 12, 0.00, 2, 4, '{"damage": 20, "type": "ice", "slow": 0.2}', '{"min_level": 1, "min_int": 8}'),
(3, 1, 'Thunder Strike', 2, 25, 0.00, 5, 8, '{"damage": 50, "type": "lightning", "stun_chance": 0.3}', '{"min_level": 4, "min_int": 12}'),
(4, 1, 'Firestorm', 3, 50, 0.01, 10, 20, '{"damage": 80, "type": "fire", "aoe": true, "radius": 5}', '{"min_level": 8, "min_int": 16}'),

-- Flux spells
(5, 2, 'Telekinetic Push', 1, 8, 0.00, 3, 5, '{"force": 15, "knockback": 3}', '{"min_level": 1, "min_int": 10}'),
(6, 2, 'Transmute Material', 2, 20, 0.00, 5, 15, '{"transmute": true, "material_tier_max": 2}', '{"min_level": 3, "min_int": 13}'),
(7, 2, 'Gravity Well', 3, 40, 0.02, 8, 25, '{"damage": 30, "pull": true, "radius": 4, "slow": 0.5}', '{"min_level": 7, "min_int": 15}'),

-- Veil spells
(8, 3, 'Minor Illusion', 1, 8, 0.00, 2, 6, '{"illusion": true, "duration": 30, "complexity": "simple"}', '{"min_level": 1, "min_int": 9}'),
(9, 3, 'Invisibility', 2, 20, 0.00, 5, 15, '{"stealth": true, "duration": 60, "breaks_on_attack": true}', '{"min_level": 3, "min_int": 12}'),
(10, 3, 'Mass Confusion', 3, 45, 0.03, 10, 30, '{"confusion": true, "radius": 6, "duration": 20}', '{"min_level": 8, "min_int": 16}'),

-- Bind spells
(11, 4, 'Summon Familiar', 1, 15, 0.00, 5, 30, '{"summon": true, "tier": 1, "duration": 120}', '{"min_level": 2, "min_int": 10}'),
(12, 4, 'Binding Chains', 2, 25, 0.00, 6, 12, '{"root": true, "duration": 15, "break_threshold": 50}', '{"min_level": 4, "min_int": 13}'),
(13, 4, 'Greater Summon', 3, 50, 0.05, 12, 60, '{"summon": true, "tier": 3, "duration": 180}', '{"min_level": 9, "min_int": 17}'),

-- Life spells
(14, 5, 'Heal', 1, 12, 0.00, 3, 5, '{"heal": 30, "target": "single"}', '{"min_level": 1, "min_int": 9}'),
(15, 5, 'Purify', 2, 20, 0.01, 5, 10, '{"cleanse": true, "removes": ["poison", "corruption_minor"]}', '{"min_level": 3, "min_int": 12}'),
(16, 5, 'Resurrection', 4, 100, 0.20, 30, 600, '{"resurrect": true, "soul_integrity_cost": 20.0, "target": "single"}', '{"min_level": 15, "min_int": 20, "forbidden": false, "cost_note": "Extreme soul integrity loss"}');
```

## 23.5 Weapons (Sample Alpha Set)

```sql
INSERT INTO Weapons (weapon_id, weapon_name, weapon_type, damage_base, damage_type, infusion_slot, durability_max, requirements_json) VALUES
(1, 'Iron Sword', 'melee', 15, 'physical', true, 100, '{"min_str": 8, "min_level": 1}'),
(2, 'Steel Longsword', 'melee', 25, 'physical', true, 150, '{"min_str": 12, "min_level": 3}'),
(3, 'Hunting Bow', 'ranged', 18, 'physical', true, 80, '{"min_agi": 10, "min_level": 1}'),
(4, 'Composite Longbow', 'ranged', 30, 'physical', true, 120, '{"min_agi": 14, "min_level": 4}'),
(5, 'Staff of Embers', 'melee', 10, 'hybrid', true, 100, '{"min_int": 12, "min_level": 2, "spell_focus": "ruin"}'),
(6, 'Bone Cleaver', 'melee', 35, 'physical', false, 60, '{"min_str": 16, "min_level": 5, "race_restriction": "sanguinarian"}'),
(7, 'Moonsilver Dagger', 'melee', 12, 'hybrid', true, 200, '{"min_agi": 12, "min_level": 3, "race_affinity": "elfin"}'),
(8, 'Voidtouched Spear', 'melee', 40, 'magical', true, 80, '{"min_str": 14, "min_int": 12, "min_level": 8, "corruption_risk": 0.05}');
```

## 23.6 CombatStyles

```sql
INSERT INTO CombatStyles (style_id, style_name, stat_focus, compatible_weapons_json, special_moves_json) VALUES
(1, 'Berserker', 'STR', '["melee"]',
 '{"rage_strike": {"damage_mult": 1.5, "defense_penalty": 0.3}, "cleave": {"aoe": true, "damage_mult": 0.8}}'),
(2, 'Duelist', 'AGI', '["melee"]',
 '{"riposte": {"counter_chance": 0.4, "damage_mult": 1.2}, "feint": {"dodge_bonus": 0.3}}'),
(3, 'Marksman', 'AGI', '["ranged"]',
 '{"aimed_shot": {"damage_mult": 2.0, "charge_time": 3}, "volley": {"aoe": true, "arrows": 5}}'),
(4, 'Battlemage', 'INT', '["melee", "ranged"]',
 '{"spell_strike": {"melee_plus_spell": true}, "arcane_shield": {"absorb": 50, "duration": 10}}'),
(5, 'Beast Warrior', 'STR', '["melee"]',
 '{"morph_strike": {"requires_morph": true, "damage_mult": 1.8}, "feral_charge": {"gap_close": true, "stun": 0.2}}');
```
