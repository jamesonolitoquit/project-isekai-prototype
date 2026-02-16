# 22 — SQL Seed: Geography & Biomes

> **Status:** ACTIVE
> **Category:** CORE-DESIGN
> **Updated:** February 16, 2026

---

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `21_SEED_WORLD_COSMOLOGY.md`

Seed data for SubAreas and Environmental_Conditions tables.

---

## 22.1 SubAreas

```sql
INSERT INTO SubAreas (subarea_id, region_id, subarea_name, subarea_type, coordinates_json, description) VALUES
-- Verdant Expanse (region 1)
(1, 1, 'Eldergrove Village', 'settlement',
 '{"x": 120, "y": 45, "z": 0}',
 'Small Common Elf farming village on the forest edge. Quest hub for early game. Merchant access, inn, basic crafting station.'),
(2, 1, 'Thornwood Depths', 'wild',
 '{"x": 135, "y": 60, "z": 0}',
 'Dense inner forest. Higher danger, Beastkin territorial patrols, rare flora for alchemy.'),
(3, 1, 'Moonwell Shrine', 'shrine',
 '{"x": 128, "y": 52, "z": 0}',
 'Ancient Elfin shrine. Minor magical node. Lore trigger for Belief Layer events.'),

-- Ironspire Mountains (region 2)
(4, 2, 'Forge Summit', 'settlement',
 '{"x": 80, "y": 180, "z": 500}',
 'Mountain-top outpost. Blacksmith specializing in runic weapons. High-tier crafting access.'),
(5, 2, 'Ember Caverns', 'dungeon',
 '{"x": 75, "y": 175, "z": -200}',
 'Deep volcanic cavern system. Rich mineral deposits, fire-based monsters, ancient ruins.'),
(6, 2, 'Windbreak Pass', 'wild',
 '{"x": 85, "y": 185, "z": 300}',
 'Dangerous mountain pass. Ambush encounters, environmental hazards, shortcut between regions.'),

-- Shimmering Coast (region 3)
(7, 3, 'Tidehaven Port', 'settlement',
 '{"x": 200, "y": 90, "z": 0}',
 'Major trading port. Merran Beastkin community. Shipyard, marketplace, faction quest hub.'),
(8, 3, 'Coral Depths', 'dungeon',
 '{"x": 210, "y": 80, "z": -50}',
 'Underwater cavern accessible to Merran morphs. Rare materials, hidden lore.'),
(9, 3, 'Saltwind Cliffs', 'wild',
 '{"x": 195, "y": 95, "z": 30}',
 'Coastal cliffs with nesting Avian Beastkin. Territorial encounters, rare feathers for crafting.'),

-- Ashen Wastes (region 4)
(10, 4, 'Cinder Outpost', 'settlement',
 '{"x": 150, "y": 220, "z": 0}',
 'Fortified outpost on the waste edge. Military faction presence. Danger staging area.'),
(11, 4, 'Shattered Spire', 'dungeon',
 '{"x": 160, "y": 240, "z": 0}',
 'Ruins of a pre-catastrophe mage tower. High corruption, powerful artifacts, boss encounters.'),
(12, 4, 'Glasstone Flats', 'wild',
 '{"x": 155, "y": 230, "z": 0}',
 'Fused sand plains from magical heat. Environmental hazards, rare crystallized mana deposits.'),

-- Twilight Marshes (region 5)
(13, 5, 'Boghollow', 'settlement',
 '{"x": 40, "y": 110, "z": 0}',
 'Swamp village built on stilts. Alchemist hub. Faction-contested, multiple quest givers.'),
(14, 5, 'Deepmire Ruins', 'dungeon',
 '{"x": 35, "y": 120, "z": -10}',
 'Sunken temple ruins. Puzzle-based encounters, ancient lore, toxic environment.'),

-- Luminara (region 6)
(15, 6, 'Grand Market', 'settlement',
 '{"x": 100, "y": 100, "z": 0}',
 'Central marketplace of Luminara. All merchant types, auction house, faction representatives.'),
(16, 6, 'Council Chambers', 'settlement',
 '{"x": 100, "y": 105, "z": 10}',
 'Seat of the ruling council. Political quests, diplomacy, high-level faction interactions.'),
(17, 6, 'Shadow Quarter', 'settlement',
 '{"x": 95, "y": 98, "z": 0}',
 'Underworld district. Black market, thieves guild, cult activity, espionage quests.'),

-- Heart of Lux-Ar (region 7)
(18, 7, 'The Nexus', 'shrine',
 '{"x": 100, "y": 100, "z": 1000}',
 'Core of Lux-Ar. Endgame location. Source of world pulse. Extreme magical density.'),

-- Abyss Edge regions (8, 9)
(19, 8, 'Voidwatch Tower', 'settlement',
 '{"x": 60, "y": 200, "z": 0}',
 'Military outpost monitoring the Abyss border. Danger zone staging, rare encounter area.'),
(20, 9, 'The Rift Maw', 'dungeon',
 '{"x": 170, "y": 250, "z": -100}',
 'Open wound in reality. Endgame dungeon. Void creatures, corrupted artifacts, Dreakin traces.');
```

## 22.2 Environmental_Conditions

```sql
INSERT INTO Environmental_Conditions (region_id, terrain_type, weather_type, magical_anomalies, spawn_modifiers) VALUES
(1, 'forest', 'temperate_rain', '{"mana_nodes": true, "veil_thin": false}',
 '{"common_mult": 1.0, "rare_mult": 0.8, "legendary_mult": 0.1}'),

(2, 'mountain', 'alpine_snow', '{"volcanic_vents": true, "veil_thin": false}',
 '{"common_mult": 0.8, "rare_mult": 1.2, "legendary_mult": 0.2}'),

(3, 'coastal', 'maritime_storm', '{"tidal_mana": true, "veil_thin": false}',
 '{"common_mult": 1.0, "rare_mult": 1.0, "legendary_mult": 0.15}'),

(4, 'desert', 'arid_heatwave', '{"corruption_zones": true, "veil_thin": true}',
 '{"common_mult": 0.6, "rare_mult": 1.5, "legendary_mult": 0.3}'),

(5, 'swamp', 'foggy_humid', '{"toxic_mana": true, "veil_thin": false}',
 '{"common_mult": 1.2, "rare_mult": 1.0, "legendary_mult": 0.1}'),

(6, 'urban', 'controlled', '{"ward_regulated": true, "veil_thin": false}',
 '{"common_mult": 0.3, "rare_mult": 0.5, "legendary_mult": 0.05}'),

(7, 'sacred', 'anomalous', '{"extreme_mana": true, "veil_thin": true, "chaos_bleed": true}',
 '{"common_mult": 0.0, "rare_mult": 0.5, "legendary_mult": 1.0}'),

(8, 'abyss', 'void_storm', '{"corruption_extreme": true, "veil_ruptured": true}',
 '{"common_mult": 0.5, "rare_mult": 2.0, "legendary_mult": 0.5}'),

(9, 'abyss', 'void_storm', '{"corruption_critical": true, "veil_ruptured": true, "dreakin_traces": true}',
 '{"common_mult": 0.3, "rare_mult": 2.5, "legendary_mult": 0.8}');
```
