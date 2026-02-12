# 25 — SQL Seed: NPC Clergy, Leaders & Faction Representatives

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `24_SEED_NPC_PANTHEON.md`, `07_FACTIONS_POLITICS.md`

Seed data for active-world NPCs: faction leaders, clergy, guild masters, merchants, and key quest givers.
Separate from pantheon/legendary NPCs (file 24) to keep context manageable.

---

## 25.1 Faction Leaders & Council Members

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

-- Luminara Council
(101, 'High Chancellor Aldric', 2, 'story', 1, 25,
 '{"str": 10, "agi": 11, "int": 22, "cha": 20, "end": 12, "luk": 13}',
 '{"diplomacy": true, "arcane_knowledge": true, "political_strategy": true}',
 false, 'neutral',
 'High Chancellor of Luminara',
 'Leader of the ruling council. High Elf politician and scholar. Primary quest giver for political/diplomatic storylines. Maintains fragile peace between factions.'),

(102, 'General Thora Ironclaw', 4, 'story', 2, 30,
 '{"str": 24, "agi": 16, "int": 12, "cha": 14, "end": 22, "luk": 10}',
 '{"battle_command": true, "morph_combat": true, "siege_tactics": true}',
 true, 'aggressive',
 'Commander of the Iron Vanguard',
 'Terran Beastkin military commander. Leads the primary military faction. Quest giver for combat and territorial missions. Distrust of political factions.'),

(103, 'Archpriestess Lyanna', 1, 'story', 3, 22,
 '{"str": 8, "agi": 10, "int": 18, "cha": 20, "end": 14, "luk": 16}',
 '{"life_magic": true, "healing_mastery": true, "faith_leadership": true}',
 false, 'friendly',
 'Voice of the Sacred Grove',
 'Common Elf spiritual leader. Heads the nature-aligned religious faction. Quest giver for healing, purification, and lore discovery. Opposes corruption and Abyss expansion.'),

(104, 'Shadow Consul Nyx', 3, 'story', 4, 28,
 '{"str": 12, "agi": 20, "int": 18, "cha": 16, "end": 13, "luk": 11}',
 '{"espionage": true, "veil_magic": true, "assassination": true}',
 false, 'manipulative',
 'Master of Whispers',
 'Dark Elf intelligence chief. Leads the shadow network faction. Quest giver for espionage, infiltration, and information-gathering missions. Morally ambiguous.'),

(105, 'Guildmaster Roderick', 1, 'story', 5, 20,
 '{"str": 14, "agi": 12, "int": 16, "cha": 18, "end": 14, "luk": 14}',
 '{"crafting_mastery": true, "trade_networks": true, "runic_knowledge": true}',
 false, 'friendly',
 'Master of the Artisan Guild',
 'Common Elf craftsman and trader. Leads the merchant/artisan guild. Quest giver for crafting, resource gathering, and trade missions. Access to rare recipes.');
```

## 25.2 Clergy & Religious NPCs

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

(201, 'Brother Theron', 1, 'faction', 3, 12,
 '{"str": 10, "agi": 10, "int": 14, "cha": 16, "end": 12, "luk": 12}',
 '{"life_magic_minor": true, "herbalism": true, "lore_knowledge": true}',
 false, 'friendly',
 'Healer of Eldergrove',
 'Village healer and lore keeper. Early-game quest giver. Provides healing services and introductory lore about the Sacred Grove.'),

(202, 'Priestess Coral', 6, 'faction', 3, 15,
 '{"str": 11, "agi": 14, "int": 16, "cha": 15, "end": 14, "luk": 10}',
 '{"water_blessing": true, "purification": true, "tidal_prayer": true}',
 true, 'friendly',
 'Tidekeeper of Tidehaven',
 'Merran Beastkin priestess. Provides water-based blessings and Merran cultural lore. Quest giver for coastal purification missions.'),

(203, 'Dark Apostle Malachar', 3, 'faction', 6, 20,
 '{"str": 12, "agi": 14, "int": 20, "cha": 14, "end": 11, "luk": 8}',
 '{"bind_magic": true, "corruption_resistance": true, "forbidden_lore": true}',
 false, 'neutral',
 'Keeper of the Forbidden Scrolls',
 'Dark Elf scholar who studies forbidden magic to understand (not practice) it. Quest giver for Abyss-related investigations. Morally grey — information broker.');
```

## 25.3 Merchants & Service NPCs

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

(301, 'Smitty Ironhammer', 4, 'merchant', 5, 15,
 '{"str": 20, "agi": 10, "int": 12, "cha": 12, "end": 18, "luk": 10}',
 '{"blacksmithing": true, "runic_infusion_basic": true}',
 true, 'friendly',
 'Master Blacksmith of Forge Summit',
 'Terran Beastkin blacksmith. Sells weapons, armor. Offers runic infusion services. Crafting quest giver.'),

(302, 'Whisper', 7, 'merchant', NULL, 18,
 '{"str": 8, "agi": 14, "int": 16, "cha": 22, "end": 10, "luk": 14}',
 '{"appraisal": true, "charm_discount": true, "black_market_access": true}',
 true, 'opportunistic',
 'The Shadow Broker',
 'Succubus independent merchant in Shadow Quarter. Sells rare items, information, and black market goods. Prices vary by reputation and CHA checks.'),

(303, 'Old Man Moss', 1, 'merchant', 5, 10,
 '{"str": 6, "agi": 8, "int": 18, "cha": 14, "end": 8, "luk": 16}',
 '{"alchemy_mastery": true, "herbalism": true, "potion_brewing": true}',
 false, 'friendly',
 'Alchemist of Boghollow',
 'Elderly Common Elf alchemist in the Twilight Marshes. Sells potions, teaches alchemy recipes. Quest giver for rare ingredient gathering.'),

(304, 'Captain Hullbreaker', 6, 'merchant', NULL, 16,
 '{"str": 16, "agi": 14, "int": 10, "cha": 14, "end": 16, "luk": 12}',
 '{"sailing": true, "trade_routes": true, "nautical_combat": true}',
 true, 'neutral',
 'Captain of the Saltwind Runner',
 'Merran Beastkin sea captain. Offers transport between coastal regions. Sells nautical supplies. Emergent quest trigger for sea encounters.');
```

## 25.4 Key Guard & Combat NPCs

```sql
INSERT INTO NPC_Master (npc_id, name, race_id, npc_type, faction_id, level, base_stats_json, skill_set_json, morph_capacity, disposition, title, role_description) VALUES

(401, 'Sergeant Brynn', 1, 'combat', 2, 14,
 '{"str": 16, "agi": 14, "int": 10, "cha": 12, "end": 16, "luk": 10}',
 '{"patrol": true, "combat_basic": true, "arrest": true}',
 false, 'neutral',
 'Gate Sergeant of Luminara',
 'Patrols Luminara gates. Enforces laws. Can arrest player for crimes. Responds to combat in city limits.'),

(402, 'Voidwatch Captain Kira', 3, 'combat', 2, 22,
 '{"str": 18, "agi": 18, "int": 14, "cha": 12, "end": 18, "luk": 8}',
 '{"void_combat": true, "corruption_resistance": true, "tactical_command": true}',
 false, 'neutral',
 'Commander of Voidwatch Tower',
 'Dark Elf military commander at the Abyss border. Quest giver for Abyss incursion missions. High-level combat challenges.');
```

## 25.5 NPC Locations (Initial Placement)

```sql
INSERT INTO NPC_Location (loc_id, npc_id, region_id, subarea_id, coordinates_json, patrol_pattern_id, last_update) VALUES
-- Faction Leaders (Luminara)
(1, 101, 6, 16, '{"x": 100, "y": 105, "z": 10}', 0, NOW()),
(2, 102, 2, 4, '{"x": 80, "y": 180, "z": 500}', 1, NOW()),
(3, 103, 1, 3, '{"x": 128, "y": 52, "z": 0}', 0, NOW()),
(4, 104, 6, 17, '{"x": 95, "y": 98, "z": 0}', 2, NOW()),
(5, 105, 6, 15, '{"x": 100, "y": 100, "z": 0}', 0, NOW()),

-- Clergy
(6, 201, 1, 1, '{"x": 120, "y": 45, "z": 0}', 0, NOW()),
(7, 202, 3, 7, '{"x": 200, "y": 90, "z": 0}', 0, NOW()),
(8, 203, 6, 17, '{"x": 96, "y": 99, "z": 0}', 3, NOW()),

-- Merchants
(9, 301, 2, 4, '{"x": 81, "y": 180, "z": 500}', 0, NOW()),
(10, 302, 6, 17, '{"x": 94, "y": 97, "z": 0}', 4, NOW()),
(11, 303, 5, 13, '{"x": 40, "y": 110, "z": 0}', 0, NOW()),
(12, 304, 3, 7, '{"x": 201, "y": 90, "z": 0}', 5, NOW()),

-- Guards
(13, 401, 6, 15, '{"x": 99, "y": 100, "z": 0}', 6, NOW()),
(14, 402, 8, 19, '{"x": 60, "y": 200, "z": 0}', 7, NOW());
```

## 25.6 Faction Definitions

```sql
INSERT INTO Factions (faction_id, faction_name, faction_type, influence_score, territory_json, resource_pool_json, beliefs_json, leader_npc_id) VALUES
(1, 'Luminara Council', 'government', 80,
 '{"regions": [6], "subareas": [15, 16]}',
 '{"gold": 50000, "materials": 2000, "population": 100000}',
 '{"order": true, "diplomacy_first": true, "magic_regulated": true}', 101),

(2, 'Iron Vanguard', 'military', 65,
 '{"regions": [2, 8], "subareas": [4, 6, 19]}',
 '{"gold": 20000, "materials": 5000, "population": 15000}',
 '{"strength_is_law": true, "border_defense": true, "honor_combat": true}', 102),

(3, 'Sacred Grove', 'religious', 50,
 '{"regions": [1], "subareas": [1, 3]}',
 '{"gold": 10000, "materials": 3000, "population": 8000}',
 '{"nature_balance": true, "life_magic_sacred": true, "corruption_opposition": true}', 103),

(4, 'Shadow Network', 'guild', 45,
 '{"regions": [6], "subareas": [17]}',
 '{"gold": 30000, "materials": 1000, "population": 3000}',
 '{"information_is_power": true, "secrecy": true, "pragmatism": true}', 104),

(5, 'Artisan Guild', 'guild', 55,
 '{"regions": [6, 3], "subareas": [15, 7]}',
 '{"gold": 40000, "materials": 8000, "population": 12000}',
 '{"craft_excellence": true, "fair_trade": true, "runic_preservation": true}', 105),

(6, 'Cult of the Void', 'cult', 20,
 '{"regions": [], "subareas": []}',
 '{"gold": 5000, "materials": 500, "population": 500}',
 '{"chaos_liberation": true, "corruption_is_evolution": true, "secrecy": true}', NULL);
```

## 25.7 Initial Faction Relationships

```sql
INSERT INTO FactionRelationships (rel_id, faction_a_id, faction_b_id, relationship_type, weight, last_event_id) VALUES
(1, 1, 2, 'alliance', 60, NULL),      -- Council and Military cooperate
(2, 1, 3, 'alliance', 70, NULL),      -- Council and Sacred Grove aligned
(3, 1, 4, 'rivalry', -20, NULL),      -- Council distrusts Shadow Network
(4, 1, 5, 'alliance', 50, NULL),      -- Council supports Artisan Guild
(5, 1, 6, 'war', -80, NULL),          -- Council actively opposes Cult
(6, 2, 3, 'neutral', 10, NULL),       -- Military and Grove: respectful distance
(7, 2, 4, 'rivalry', -30, NULL),      -- Military despises spies
(8, 2, 6, 'war', -90, NULL),          -- Military hunts Cult
(9, 3, 6, 'war', -95, NULL),          -- Sacred Grove: sworn enemies of corruption
(10, 4, 5, 'neutral', 5, NULL),       -- Shadow Network and Artisans: business
(11, 4, 6, 'rivalry', -40, NULL),     -- Shadow Network monitors Cult
(12, 5, 6, 'rivalry', -30, NULL);     -- Artisans oppose Cult's chaos philosophy
```
