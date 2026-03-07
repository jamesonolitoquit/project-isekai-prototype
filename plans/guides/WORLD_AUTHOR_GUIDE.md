# World Author's Guide: The Engineering of Eons

Welcome, Architect. This guide defines the standards for extending the **Project-Isekai** simulation. The world is not a static map; it is a **10,000-year deterministic engine**.

## 1. Core Philosophy: "Lore as Data"
Every narrative event must have a mechanical weight. If a kingdom falls, it isn't just a text box—it scales `itemRebellion` rates, shifts `visualPalette` hex codes, and triggers `culturalDrift`.

## 2. Narrative Pruning & Importance Weights
To maintain high performance over 10,000 game-years (Ticks), we use a pruning system.
- **Importance 1-3**: Local events (Merchant arrivals, weather). Deleted after 50 years.
- **Importance 4-7**: Regional shifts (City growth, local wars). Kept for 500 years.
- **Importance 8-10**: Global Anchors (The Void Harvest, God-Slayings). **Immutable**.

## 3. Cultural Drift & Evolution Paths
Locations evolve. When defining a new region, provide a `nameMutations` array:
```json
"nameMutations": [
  { "tick": 0, "name": "Settler's Landing" },
  { "tick": 500000, "name": "Iron-Port" },
  { "tick": 2000000, "name": "The Sunken Docks" }
]
```

## 4. Seasonal & Aesthetic Overrides
The `seasonalRules` block controls the "Atmospheric Mood."
- **Visuals**: Use `#RRGGBB` format for `foliageTint` and `accentColor`.
- **Mechanics**: Link weather to stats (e.g., `fatigueRate: 1.2` during Winter).

## 5. Paradox Management
The `narrativeConclusions` are triggered by the **Paradox Level**. 
- **High Paradox**: Results in "The Great Unmaking" (World reset).
- **Low Paradox**: Results in "The Golden Synthesis" (Golden Age).

## 6. Creating Patches (.patch.json)
Never edit `luxfier-world.json` directly for expansions. Create a patch file that follows the expansion schema:
- `hardFacts`: New locations and items.
- `injectedRules`: Balance overrides.
- `conditionalSeason`: Region-specific weather logic.

---
*Verified for Production v1.0.0-BETA*
*Author: GitHub Copilot (Gemini 3 Flash)*
