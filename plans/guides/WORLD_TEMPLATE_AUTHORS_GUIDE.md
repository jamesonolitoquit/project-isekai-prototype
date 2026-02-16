# Luxfier Alpha: World Template Authoring Guide

> **Status:** ACTIVE
> **Category:** GUIDE
> **Updated:** February 16, 2026

---

This guide is for Lore Writers and World Architects to create new world templates for the Luxfier engine. Templates are written in JSON and must adhere to the `luxfier-world.schema.json` validation.

## 1. Core World Identity
Every world starts with its basic identity and starting conditions.

| Property | Type | Description |
| :--- | :--- | :--- |
| `name` | String | The official title of the world/module. |
| `description` | String | A high-level narrative overview (visible to players). |
| `season` | Enum | The starting season: `winter`, `spring`, `summer`, `autumn`. |

---

## 2. Geography & Locations
Locations define the physical stage. The engine uses these for pathfinding and particle effects.

- **`spiritDensity` (0.0 - 1.0)**: Controls the intensity of environmental particle effects (fog, glow, embers).
- **`biome`**: Values: `forest`, `cave`, `village`, `corrupted`, `shrine`, `maritime`, `mountain`, `plains`.
- **`x` / `y`**: Normalized grid coordinates (0-1000) for spatial tracking.
- **`conditionalSeason`**: Use this for locations that only appear or change during specific seasons.

### Sub-Areas (Hidden Depths)
Locations can have `subAreas` (nested locations) that require exploration to find.
- **`difficulty` (10-25)**: Perception DC to discover the sub-area.
- **`environmentalEffects`**: e.g., `["reduced_hearing", "spirit_amplification"]`.

---

## 3. NPCs & Character Design (AI DM Integration)
NPCs are the heart of the reactivity system. Instead of writing long scripts, authors define the NPC's "Mental Blueprint" for the AI DM.

### A. Persona & Voice (How the AI speaks)
The AI DM uses these fields to roleplay the character dynamically.
- **`persona`**: The character's life story, current goals, and general outlook (e.g., "A bitter veteran of the Silver War who just wants to protect his tavern").
- **`quirks`**: Concrete behaviors or speech habits (e.g., `["refers to himself in the third person", "constantly cleaning a glass", "winks when lying"]`).
- **`voiceDescriptor`**: The literal sound and tone (e.g., "Low, gravelly, with a heavy West-Isle accent").

### B. Personality & Combat Style
NPCs behave differently in combat and social situations based on their tactical `personality`:
- **Types**: `aggressive`, `cautious`, `tactical`, `healer`, `balanced`.
- **Metrics**: `attackThreshold`, `defendThreshold`, `riskTolerance` (0.0 - 1.0).

### C. Routines (24h Clock)
The engine moves NPCs based on the hour.
- Format: `"StartHour-EndHour": "location-id"` (e.g., `"6-12": "eldergrove-village"`).

### D. Emotional State (Resonance Metrics)
Defines the NPC's temperament toward the player (Range 0-100). These values change how the AI DM roleplays the character (e.g., a character with high `fear` will stutter or beg).
- **`trust`**: Unlocks rare dialogue and reduced prices.
- **`fear`**: Causes NPCs to flee or offer bribes to be left alone.
- **`gratitude`**: Earned via quests; prevents `resentment` decay.
- **`resentment`**: Accumulated by hostile actions; can trigger bounty hunters.

---

## 4. Geopolitics & Factions
NPCs should belong to factions to enable the warfare system.

- **`factionId`**: Links NPC to a power structure (e.g., `silver-flame`).
- **`factionRole`**: `leader`, `soldier`, `civilian`, or `traitor`.
- **`warfare` (Advanced)**: If a faction conflict is active, the engine spawns soldiers and creates location-based damage (scars).

---

## 5. Quest Construction
Quests drive the "Chronos Ledger" (World History).

| Field | Purpose |
| :--- | :--- |
| `objective.type` | `visit`, `combat`, `exploration`, `challenge`, `gather`, `craft`. |
| `objective.location` | The ID of the location where the objective occurs. |
| `objective.target` | (Optional) The ID of an NPC or Item involved. |
| `dependencies` | Lists quest IDs that must be finished first. |
| `expiresInHours` | Time limit before the quest fails (Simulation time). |

---

## 6. Advanced Simulation Features
The Luxfier engine supports systemic hazards and interactive altars.

### A. Hazards
Hazards apply status effects or damage based on conditions.
- **`condition`**: Can be `season`, `weather`, or `maxDayPhase` (e.g., "Night Cold").
- **`effect`**: `health_drain` or `status_apply`.

### B. Essence Altars
Points of interest where players interact with the core engine.
- **`ritualType`**: `essence-transformation`, `primal-morph`, `tempered-morph`.
- **`requirements`**: Attribute gates (e.g., `minIntelligence`).

---

## 7. Boilerplate Template
Copy this into a `.json` file to start your world.

```json
{
  "name": "New World Name",
  "description": "Short summary of the world lore.",
  "season": "spring",
  "locations": [
    { "id": "start-village", "name": "Starting Village", "spiritDensity": 0.2 }
  ],
  "npcs": [
    {
      "id": "intro-guide",
      "name": "The Guide",
      "locationId": "start-village",
      "persona": "A mysterious wanderer who was once a high priest but lost his faith.",
      "quirks": ["always carries an unlit torch", "speaks in riddles"],
      "voiceDescriptor": "Calm, airy, and rhythmic",
      "routine": { "0-24": "start-village" },
      "emotionalState": { "trust": 50, "fear": 10, "gratitude": 0, "resentment": 0 }
    }
  ],
  "quests": [],
  "metadata": {
    "templateId": "v1.0-alpha",
    "particleDensity": "medium"
  }
}
```

---
*Generated for Luxfier Alpha Prototype development.*
