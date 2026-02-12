# 13 — Player Inventory, Crafting & Resource Management

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `08_RELICS_ARTIFACTS.md`, `11_PLAYER_PROGRESSION_LEVELING.md`

In-game inventory with full UI integration, crafting, resource management, and interaction with gameplay systems.

---

## 13.1 Core Principles

- In-game inventory: accessible at any time via hotkey or menu; not dashboard-based
- Item categorization: weapons, armor, consumables, artifacts, materials, relics, miscellaneous
- Crafting & alchemy integration: combine materials and runes to create usable items
- Resource management: track consumables, morphing resources, mana, crafting reagents
- UI transparency: intuitive interface showing quantity, equipped status, effects, crafting potential
- Weight / encumbrance system (optional): affects movement, stamina, combat agility

---

## 13.2 Inventory UI Layout (In-Game)

**Main Tabs:**
- All Items: full inventory view
- Weapons / Armor / Gear: categorized view
- Consumables: potions, food, buffs
- Materials: crafting reagents, minerals, monster parts
- Runes / Infusions: magical modifiers
- Artifacts / Relics: minor relics, relic hints (hidden)

**Features:**
- Quick Equip Slots: hotbar for weapons, potions, active morph forms
- Item Details: stats, effects, durability, lore context
- Sorting & Filtering: by type, rarity, weight, magical affinity
- Crafting Access Button: opens crafting/alchemy sub-menu
- Weight / Encumbrance Indicator: optional, shows limits and movement penalties

---

## 13.3 Item & Resource Types

| Type | Description | Gameplay Use |
|---|---|---|
| **Weapons** | Melee, ranged, or hybrid | Combat, infusion |
| **Armor** | Light, medium, heavy | Damage reduction, agility penalty |
| **Consumables** | Potions, food, elixirs | Healing, buffs, morph cost reduction |
| **Materials** | Flora, minerals, monster parts | Crafting, alchemy, runic infusion |
| **Runes** | Magical symbols | Infusion to weapons, armor, consumables |
| **Artifacts** | Minor relics or plot devices | Quest-related, buffs, narrative triggers |
| **Relics** | Canonical or narrative relics | Mostly inaccessible; hints only |

---

## 13.4 Crafting System Mechanics

- **Access:** in-game crafting station, portable crafting kits, or alchemy labs
- **Process:**
  1. Select Recipe (depends on skill level, unlocked via progression or faction access)
  2. Add Materials (use inventory materials, quantities displayed)
  3. Add Runes / Infusions (optional for magical enhancement)
  4. Crafting Outcome (success or failure based on skill, rarity, morphing state, corruption risk)
- **Results:** new items added to inventory; failures may destroy materials or cause corruption
- **Example Recipes:**
  - Runed Sword: Iron + Flame Rune + Minor Flux Crystal → Sword with fire enhancement
  - Potion of Morph Efficiency: Beastkin Essence + Rare Herb → temporary END cost reduction

---

## 13.5 Inventory Management Rules

- Stacking: materials and consumables can stack; weapons/armor are single items
- Durability: weapons and armor degrade with use; repairable via crafting
- Equipped Items: can only equip according to race, class, or skill restrictions
- Weight Limits (optional): affects movement, stamina, combat agility
- Automatic Sorting: AI DM can suggest optimization based on class, faction, or current quest

---

## 13.6 Database Representation

| Table | Key Fields |
|---|---|
| **Inventory** | character_id, item_id, quantity, equipped_flag, durability, infusion_id, location (bag, quickslot) |
| **CraftingRecipes** | recipe_id, required_materials, required_runes, skill_level, success_chance, result_item_id |
| **CraftingLog** | character_id, recipe_id, materials_used, success_flag, timestamp |
| **ConsumableEffects** | item_id, effect_type, duration, potency, target_attribute |

---

## 13.7 AI DM Enforcement

- Monitors inventory and crafting usage in real-time
- Prevents unauthorized use of canonical artifacts or forbidden runes
- Adjusts morphing efficiency if consumables are applied
- Ensures crafting remains balanced relative to player progression and world lore
