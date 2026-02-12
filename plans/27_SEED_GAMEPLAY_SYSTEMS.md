# 27 — SQL Seed: Gameplay Systems (Items, Crafting, Quests, Encounters)

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `13_INVENTORY_CRAFTING.md`, `12_QUEST_SYSTEM.md`, `15_RANDOM_ENCOUNTERS_EXPLORATION.md`

Seed data for Items, CraftingRecipes, starter Quests + Objectives, and Belief Layer defaults.

---

## 27.1 Items (Alpha Inventory)

```sql
INSERT INTO Items (item_id, item_name, item_type, rarity, base_stats_json, effects_json, weight, stackable, max_stack, lore_text) VALUES

-- Consumables
(1, 'Minor Health Potion', 'consumable', 'common',
 '{}', '{"heal": 30, "target": "self"}', 0.20, true, 20,
 'A basic healing draught brewed from common herbs. Every adventurer''s first purchase.'),
(2, 'Minor Mana Potion', 'consumable', 'common',
 '{}', '{"mana_restore": 25, "target": "self"}', 0.20, true, 20,
 'Blue liquid that replenishes magical reserves. Tastes like blueberries and regret.'),
(3, 'Antidote', 'consumable', 'common',
 '{}', '{"cleanse": ["poison"], "target": "self"}', 0.15, true, 10,
 'Cures common poisons. Ineffective against magical toxins or corruption.'),
(4, 'Morph Stabilizer', 'consumable', 'uncommon',
 '{}', '{"morph_duration_extend": 120, "end_cost_reduce": 2}', 0.30, true, 5,
 'Beastkin alchemists developed this to extend morph duration. Has a chalky aftertaste.'),
(5, 'Rations (1 day)', 'consumable', 'common',
 '{}', '{"satiation": true, "duration": 1440}', 1.00, true, 10,
 'Standard travel food. Keeps you going.'),

-- Materials
(10, 'Iron Ore', 'material', 'common',
 '{}', '{}', 2.00, true, 50,
 'Raw iron. Used in basic weapon and armor crafting.'),
(11, 'Flux Crystal', 'material', 'uncommon',
 '{}', '{"mana_resonance": true}', 0.50, true, 20,
 'Crystallized mana deposits found near magical nodes. Used in arcane crafting and runic infusion.'),
(12, 'Beastkin Essence', 'material', 'rare',
 '{}', '{"morph_affinity": true}', 0.10, true, 10,
 'Distilled essence from Beastkin morph transitions. Rare alchemical ingredient.'),
(13, 'Void Shard', 'material', 'rare',
 '{}', '{"corruption_risk": 0.10, "power_amplify": 1.5}', 0.30, true, 5,
 'Fragment of Abyss-touched crystal. Powerful but dangerous crafting component.'),
(14, 'Moonpetal', 'material', 'uncommon',
 '{}', '{"healing_amplify": 1.3}', 0.05, true, 30,
 'Night-blooming flower found near Elfin shrines. Key ingredient in advanced healing potions.'),
(15, 'Flame Rune', 'rune', 'uncommon',
 '{}', '{"infusion_type": "fire", "damage_bonus": 8}', 0.10, true, 10,
 'Basic fire rune. Can be infused into weapons or armor at a crafting station.'),
(16, 'Frost Rune', 'rune', 'uncommon',
 '{}', '{"infusion_type": "ice", "slow_bonus": 0.15}', 0.10, true, 10,
 'Basic ice rune. Slows enemies on hit when infused.'),
(17, 'Warding Rune', 'rune', 'rare',
 '{}', '{"infusion_type": "defense", "damage_reduction": 5}', 0.10, true, 5,
 'Protective rune. Reduces incoming damage when infused into armor.'),

-- Artifacts (minor, player-accessible)
(20, 'Compass of the Lost', 'artifact', 'rare',
 '{"luk": 3}', '{"reveal_hidden_paths": true, "duration": "passive"}', 0.50, false, 1,
 'Ancient Elfin navigation tool. Points toward hidden subareas and secret paths. Legends say it was made by someone who got lost a lot.'),
(21, 'Bloodstone Amulet', 'artifact', 'rare',
 '{"end": 2, "str": 1}', '{"blood_sense": true, "regeneration_minor": true}', 0.30, false, 1,
 'Sanguinarian relic. Grants minor regeneration and the ability to sense nearby creatures by their blood.'),

-- Quest items
(30, 'Theron''s Herb List', 'artifact', 'common',
 '{}', '{"quest_item": true, "quest_id": 1001}', 0.01, false, 1,
 'A worn parchment listing herbs Brother Theron needs from the Thornwood Depths.'),
(31, 'Shadow Network Cipher', 'artifact', 'uncommon',
 '{}', '{"quest_item": true, "quest_id": 1031}', 0.05, false, 1,
 'Encoded message from the Shadow Network. Requires decryption to reveal contents.');
```

## 27.2 Crafting Recipes

```sql
INSERT INTO CraftingRecipes (recipe_id, recipe_name, required_materials_json, required_runes_json, skill_level_required, success_chance, result_item_id) VALUES

(1, 'Iron Sword', '{"10": 3}', '{}', 1, 0.95, NULL),  -- result = weapon_id 1 from Weapons table
(2, 'Steel Longsword', '{"10": 5, "11": 1}', '{}', 3, 0.85, NULL),
(3, 'Runed Fire Sword', '{"10": 5, "15": 1, "11": 1}', '{"15": 1}', 5, 0.70, NULL),
(4, 'Minor Health Potion', '{"14": 2}', '{}', 1, 0.95, 1),
(5, 'Morph Stabilizer', '{"12": 1, "14": 1}', '{}', 4, 0.75, 4),
(6, 'Advanced Health Potion', '{"14": 3, "11": 1}', '{}', 5, 0.80, NULL),
(7, 'Warding Armor Infusion', '{"17": 1}', '{"17": 1}', 6, 0.65, NULL);
```

## 27.3 Starter Quests

```sql
INSERT INTO QuestMaster (quest_id, title, quest_type, description, faction_id, reward_xp, reward_items_json, dependencies_json, creation_source, visibility_flag) VALUES

(1001, 'Herbs for the Healer', 'exploration', 
 'Brother Theron needs rare herbs from Thornwood Depths to prepare medicines for the village. Gather the required plants and return safely.',
 3, 75, '{"items": [1, 1, 5], "gold": 20}', '{}', 'canonical', true),

(1002, 'Shadows in the Thornwood', 'combat',
 'Corrupted creatures have been spotted deeper in the forest. Investigate the source and report back to Brother Theron.',
 3, 150, '{"items": [1, 2], "gold": 50}', '{"required_quests": [1001]}', 'canonical', true),

(1010, 'The Forge Awakens', 'challenge',
 'Smitty Ironhammer wants to test your crafting potential. Gather iron ore from the Ember Caverns and forge your first weapon.',
 5, 100, '{"items": [10, 10, 10], "gold": 30, "unlock": "crafting_station_access"}', '{}', 'canonical', true),

(1011, 'Border Patrol', 'faction',
 'General Thora needs scouts at the Abyss border. Report on void creature activity near Voidwatch Tower.',
 2, 300, '{"items": [1, 1, 3], "gold": 100}', '{"required_level": 6}', 'canonical', true),

(1020, 'Tidewater Purification', 'faction',
 'Priestess Coral senses corruption in the tidal waters. Dive into the Coral Depths and cleanse the source.',
 3, 200, '{"items": [2, 2, 14], "gold": 75}', '{"required_level": 3}', 'canonical', true),

(1030, 'The Chancellor''s Concern', 'faction',
 'High Chancellor Aldric suspects a faction is undermining the peace accord. Investigate discreetly.',
 1, 250, '{"items": [], "gold": 150, "reputation_council": 15}', '{"required_level": 5}', 'canonical', true),

(1031, 'Whispers in the Dark', 'faction',
 'Shadow Consul Nyx has intercepted an encoded message from the Cult of the Void. Decode it and report your findings.',
 4, 200, '{"items": [31], "gold": 100, "reputation_shadow": 20}', '{"required_level": 5}', 'canonical', true),

(1040, 'Old Man Moss''s Recipe', 'exploration',
 'The alchemist of Boghollow needs toxic marsh fungi for a rare antidote recipe. Harvest them from Deepmire Ruins.',
 5, 150, '{"items": [3, 3, 14], "gold": 50, "unlock": "alchemy_recipe_antidote_advanced"}', '{"required_level": 3}', 'canonical', true),

(1050, 'The Abyss Stirs', 'canonical',
 'Voidwatch Captain Kira reports increased activity at the Rift Maw. Lead a squad to investigate and seal emerging breaches.',
 2, 500, '{"items": [13], "gold": 200, "reputation_military": 25}', '{"required_level": 8, "required_quests": [1011]}', 'canonical', true);
```

## 27.4 Quest Objectives

```sql
INSERT INTO QuestObjectives (objective_id, quest_id, description, objective_type, completion_flag, progress_value) VALUES
-- Herbs for the Healer (1001)
(1, 1001, 'Collect 5 Moonpetals from Thornwood Depths', 'primary', false, 0),
(2, 1001, 'Return herbs to Brother Theron', 'primary', false, 0),
(3, 1001, 'Find the hidden herb garden (optional)', 'optional', false, 0),

-- Shadows in the Thornwood (1002)
(4, 1002, 'Investigate 3 corruption sites in Thornwood', 'primary', false, 0),
(5, 1002, 'Defeat the Corrupted Treant', 'primary', false, 0),
(6, 1002, 'Collect a corruption sample for analysis', 'optional', false, 0),
(7, 1002, 'Discover the corruption source (hidden)', 'hidden', false, 0),

-- The Forge Awakens (1010)
(8, 1010, 'Mine 10 Iron Ore from Ember Caverns', 'primary', false, 0),
(9, 1010, 'Forge a weapon at Smitty''s station', 'primary', false, 0),
(10, 1010, 'Find a Flux Crystal for enhancement', 'optional', false, 0),

-- Border Patrol (1011)
(11, 1011, 'Travel to Voidwatch Tower', 'primary', false, 0),
(12, 1011, 'Scout 3 void breach locations', 'primary', false, 0),
(13, 1011, 'Defeat void creatures at each breach', 'primary', false, 0),
(14, 1011, 'Report findings to Captain Kira', 'primary', false, 0),

-- The Abyss Stirs (1050)
(15, 1050, 'Enter the Rift Maw', 'primary', false, 0),
(16, 1050, 'Seal 5 emerging breaches', 'primary', false, 0),
(17, 1050, 'Defeat the Rift Guardian', 'primary', false, 0),
(18, 1050, 'Recover a Void Shard for analysis', 'optional', false, 0),
(19, 1050, 'Discover Dreakin traces (hidden)', 'hidden', false, 0);
```

## 27.5 Default Belief Layer State (Player Starting)

```sql
-- Player starts with minimal knowledge — WTOL enforced
INSERT INTO BeliefLayers (belief_id, entity_id, entity_type, belief_type, content_json, confidence, source, last_updated) VALUES
(1, NULL, 'player', 'CB', '{"world_exists": true, "magic_exists": true}', 0.90, 'innate', NOW()),
(2, NULL, 'player', 'FB', '{}', 0.00, 'none', NOW()),
(3, NULL, 'player', 'PB', '{"i_am_adventurer": true}', 0.80, 'character_creation', NOW()),
(4, NULL, 'player', 'WT', '{}', 0.00, 'none', NOW()),
(5, NULL, 'player', 'WTOL', '{}', 0.00, 'none', NOW());

-- WTOL ground truth (AI DM reference, never shown to player)
INSERT INTO WTOLState (wtol_id, entity_id, entity_type, truth_layer, revealed_facts_json, pending_reveals_json) VALUES
(1, NULL, 'player', 'unknown',
 '{}',
 '{"kael_exists": true, "alpha_is_dreakin": true, "chaos_realm_bleeds": true, "faction_tensions_escalating": true, "corruption_spreading": true}');
```
