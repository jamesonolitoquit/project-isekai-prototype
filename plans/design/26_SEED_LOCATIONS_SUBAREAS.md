# 26 — SQL Seed: Locations & SubAreas (Extended)

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `22_SEED_GEOGRAPHY_BIOMES.md`

Extended location data: encounter spawn tables, NPC dialogue hooks, and quest triggers per location.

---

## 26.1 Encounter Spawn Tables by Region

```sql
INSERT INTO Encounter_Master (encounter_id, name, encounter_type, spawn_probability, region_id, time_conditions_json, trigger_conditions_json, lore_link) VALUES

-- Verdant Expanse (region 1)
(1, 'Goblin Raiding Party', 'combat', 0.30, 1,
 '{"time": "any"}', '{"min_level": 1, "max_level": 5}', NULL),
(2, 'Wandering Beastkin Hunter', 'social', 0.20, 1,
 '{"time": "day"}', '{"min_level": 1}', NULL),
(3, 'Corrupted Treant', 'combat', 0.08, 1,
 '{"time": "night", "season": "autumn"}', '{"min_level": 4}', NULL),
(4, 'Moonwell Vision', 'environmental', 0.05, 1,
 '{"time": "midnight", "lux_cycle": "peak"}', '{"subarea": 3}', NULL),

-- Ironspire Mountains (region 2)
(5, 'Mountain Ogre', 'combat', 0.25, 2,
 '{"time": "any"}', '{"min_level": 4, "max_level": 10}', NULL),
(6, 'Dwarven Ghost', 'social', 0.10, 2,
 '{"time": "night"}', '{"min_level": 5, "subarea": 5}', NULL),
(7, 'Volcanic Eruption', 'environmental', 0.03, 2,
 '{"time": "any", "season": "summer"}', '{"min_level": 6}', NULL),

-- Shimmering Coast (region 3)
(8, 'Pirate Skirmish', 'combat', 0.20, 3,
 '{"time": "any"}', '{"min_level": 3, "max_level": 8}', NULL),
(9, 'Lost Merran Caravan', 'social', 0.12, 3,
 '{"time": "day"}', '{"min_level": 2}', NULL),
(10, 'Tidal Mana Surge', 'environmental', 0.06, 3,
 '{"time": "any", "lux_cycle": "fluctus"}', '{"min_level": 4}', NULL),

-- Ashen Wastes (region 4)
(11, 'Ash Wraith', 'combat', 0.25, 4,
 '{"time": "any"}', '{"min_level": 6, "max_level": 15}', NULL),
(12, 'Corrupted Mana Geyser', 'environmental', 0.10, 4,
 '{"time": "any"}', '{"min_level": 5}', NULL),
(13, 'Void Marauder', 'rare', 0.02, 4,
 '{"time": "night", "lux_cycle": "magnus_fluctus"}', '{"min_level": 10}', NULL),

-- Twilight Marshes (region 5)
(14, 'Toxic Slime Swarm', 'combat', 0.30, 5,
 '{"time": "any"}', '{"min_level": 2, "max_level": 7}', NULL),
(15, 'Marsh Witch Encounter', 'social', 0.08, 5,
 '{"time": "night"}', '{"min_level": 4}', NULL),

-- Luminara (region 6)
(16, 'Pickpocket Attempt', 'social', 0.15, 6,
 '{"time": "any"}', '{"min_level": 1, "subarea": 17}', NULL),
(17, 'Cult Recruitment', 'social', 0.05, 6,
 '{"time": "night", "subarea_id": 17}', '{"min_level": 3, "faction_reputation_cult": "unknown"}', NULL),

-- Abyss Edge (regions 8, 9)
(18, 'Void Stalker Pack', 'combat', 0.35, 8,
 '{"time": "any"}', '{"min_level": 8, "max_level": 20}', NULL),
(19, 'Alpha Sighting', 'rare', 0.005, 8,
 '{"time": "any", "lux_cycle": "magnus_fluctus"}', '{"min_level": 5, "note": "observation_only"}', NULL),
(20, 'Rift Collapse', 'environmental', 0.08, 9,
 '{"time": "any"}', '{"min_level": 10}', NULL),
(21, 'Harbinger Beast', 'rare', 0.03, 9,
 '{"time": "night"}', '{"min_level": 12}', NULL);
```

## 26.2 Quest Triggers by Location

```sql
INSERT INTO NPC_QuestHooks (npc_id, quest_id, trigger_conditions, event_type) VALUES
-- Eldergrove Village
(201, 1001, '{"player_enters_subarea": 1, "min_level": 1}', 'introduction'),
(201, 1002, '{"quest_1001_complete": true, "min_level": 2}', 'follow_up'),

-- Forge Summit
(301, 1010, '{"player_enters_subarea": 4, "min_level": 4}', 'crafting_tutorial'),
(102, 1011, '{"player_enters_subarea": 4, "min_level": 6}', 'military_assignment'),

-- Tidehaven Port
(202, 1020, '{"player_enters_subarea": 7, "min_level": 3}', 'purification_quest'),
(304, 1021, '{"player_enters_subarea": 7, "min_level": 4}', 'transport_quest'),

-- Luminara
(101, 1030, '{"player_enters_subarea": 16, "min_level": 5}', 'political_quest'),
(104, 1031, '{"player_enters_subarea": 17, "min_level": 5}', 'espionage_quest'),
(302, 1032, '{"player_enters_subarea": 17, "min_level": 3}', 'black_market_intro'),

-- Boghollow
(303, 1040, '{"player_enters_subarea": 13, "min_level": 3}', 'alchemy_quest'),

-- Voidwatch Tower
(402, 1050, '{"player_enters_subarea": 19, "min_level": 8}', 'abyss_defense');
```

## 26.3 NPC Dialogue Samples

```sql
INSERT INTO NPC_Dialogue (dialogue_id, npc_id, trigger_conditions_json, dialogue_text, response_options_json, outcome_json) VALUES

-- Brother Theron — introduction
(1, 201,
 '{"first_meeting": true}',
 'Welcome, traveler. The Expanse can be harsh to those who wander without purpose. I am Brother Theron, keeper of the shrine here. If you seek knowledge or healing, speak freely.',
 '[{"option": "I need healing", "requires": null}, {"option": "Tell me about this place", "requires": null}, {"option": "I''m looking for work", "requires": null}]',
 '{"option_1": {"action": "heal_player"}, "option_2": {"action": "lore_dump_eldergrove"}, "option_3": {"action": "offer_quest_1001"}}'),

-- Shadow Consul Nyx — espionage intro
(2, 104,
 '{"first_meeting": true, "subarea": 17}',
 'You found your way here. Not many who enter the Shadow Quarter do so by accident. I am Nyx. If you have eyes, ears, and discretion, I may have use for someone like you.',
 '[{"option": "I''m interested", "requires": null}, {"option": "What kind of work?", "requires": null}, {"option": "I don''t trust you", "requires": null}]',
 '{"option_1": {"action": "offer_quest_1031"}, "option_2": {"action": "explain_shadow_network"}, "option_3": {"action": "reputation_minus_5_shadow"}}'),

-- General Thora — military mission
(3, 102,
 '{"min_level": 6, "faction_reputation_military": 20}',
 'Soldier. The Abyss border is weakening. I need experienced fighters at Voidwatch Tower. Can you handle real danger?',
 '[{"option": "I''m ready", "requires": {"min_level": 6}}, {"option": "Tell me more about the threat", "requires": null}, {"option": "Not my fight", "requires": null}]',
 '{"option_1": {"action": "offer_quest_1011"}, "option_2": {"action": "lore_dump_abyss_threat"}, "option_3": {"action": "reputation_minus_10_military"}}');
```
