# 21 — SQL Seed: World & Cosmology

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Schema Reference: `plans/20_ALPHA_DATA_SCHEMA.md`
> Dependencies: `02_COSMOLOGY_METAPHYSICS.md`

Seed data for Realms, Regions, and TimeModel tables.

---

## 21.1 Realms

```sql
INSERT INTO Realms (realm_id, realm_name, realm_type, description, rules_json) VALUES
(1, 'Chaos Realm', 'metaphysical',
 'Primordial void of infinite potential energy. Source of all creation and entropy. Not directly accessible except through catastrophic events.',
 '{"physics": "non-deterministic", "magic": "unlimited_but_unstable", "time": "non-linear", "entry": "catastrophic_only"}'),

(2, 'Lux-Ar', 'physical',
 'The known world. A living construct shaped by residual Chaos energy, anchored by the Heart of Lux-Ar. Contains all playable regions.',
 '{"physics": "standard", "magic": "soul_or_environment_sourced", "time": "linear_with_debt", "entry": "default"}'),

(3, 'The Abyss', 'transitional',
 'Border zone between Lux-Ar and Chaos Realm. Corrupted, unstable. High danger. Home to void creatures and corrupted entities.',
 '{"physics": "unstable", "magic": "corrupted_amplified", "time": "distorted", "entry": "abyss_edge_regions"}'),

(4, 'The Veil', 'transitional',
 'Metaphysical membrane separating mortal perception from deeper reality layers. Manipulated by Veil Magic discipline.',
 '{"physics": "perceptual", "magic": "illusion_dominant", "time": "subjective", "entry": "veil_magic_only"}');
```

## 21.2 Regions (Alpha Map)

```sql
INSERT INTO Regions (region_id, realm_id, region_name, biome_type, danger_level, description, climate_json) VALUES
(1, 2, 'Verdant Expanse', 'forest', 3,
 'Dense temperate forest covering central Lux-Ar. Home to Common Elf settlements and Beastkin territories. Rich in flora and minor magical nodes.',
 '{"base_weather": "temperate", "seasonal_variation": true, "mana_density": "moderate"}'),

(2, 2, 'Ironspire Mountains', 'mountain', 6,
 'Volcanic mountain range in the north. Rich mineral deposits, dwarven-adjacent ruins, dangerous fauna. Contains entrances to deep cavern systems.',
 '{"base_weather": "alpine_cold", "seasonal_variation": true, "mana_density": "low_surface_high_deep"}'),

(3, 2, 'Shimmering Coast', 'coastal', 4,
 'Eastern coastline with ports, fishing villages, and Merran Beastkin communities. Trade hub connecting major settlements.',
 '{"base_weather": "maritime", "seasonal_variation": true, "mana_density": "moderate_tidal"}'),

(4, 2, 'Ashen Wastes', 'desert', 7,
 'Scorched badlands in the south. Former site of a major magical catastrophe. Residual corruption, hostile creatures, scattered ruins.',
 '{"base_weather": "arid_extreme", "seasonal_variation": false, "mana_density": "high_unstable"}'),

(5, 2, 'Twilight Marshes', 'swamp', 5,
 'Fog-laden wetlands in the west. Contested territory between multiple factions. Alchemical ingredients abundant.',
 '{"base_weather": "humid_foggy", "seasonal_variation": true, "mana_density": "moderate_toxic"}'),

(6, 2, 'Luminara', 'urban', 2,
 'Capital city-state of Lux-Ar. Political center, major trade hub, seat of the ruling council. Diverse population.',
 '{"base_weather": "temperate", "seasonal_variation": true, "mana_density": "controlled_regulated"}'),

(7, 2, 'Heart of Lux-Ar', 'sacred', 10,
 'Central nexus point of the world. Source of Lux-Ar pulse cycles. Extremely restricted access. Guarded by ancient wards.',
 '{"base_weather": "anomalous", "seasonal_variation": false, "mana_density": "extreme"}'),

(8, 3, 'Abyss Edge - Northern Reach', 'abyss', 8,
 'Northern border where Lux-Ar meets the Abyss. Corrupted terrain, void creatures, unstable magic. Alpha has been sighted here.',
 '{"base_weather": "void_storms", "seasonal_variation": false, "mana_density": "corrupted_extreme"}'),

(9, 3, 'Abyss Edge - Southern Rift', 'abyss', 9,
 'Southern tear in reality. Deeper corruption than the north. Possible remnants of ancient Dreakin activity.',
 '{"base_weather": "void_storms", "seasonal_variation": false, "mana_density": "corrupted_critical"}');
```

## 21.3 TimeModel

```sql
INSERT INTO TimeModel (time_id, realm_id, flow_rate, current_era, current_cycle, temporal_debt) VALUES
(1, 1, 0.00, 'Eternal', 0, 0.00),       -- Chaos Realm: no linear time
(2, 2, 1.00, 'Age of Fractured Peace', 1, 0.00),  -- Lux-Ar: standard flow
(3, 3, 0.75, 'Age of Fractured Peace', 1, 12.50),  -- Abyss: slower, debt accumulating
(4, 4, 0.00, 'Timeless', 0, 0.00);       -- Veil: subjective time
```
