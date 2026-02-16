# UI/UX Specification: The Threshold & The Sanctum

This document defines the production-grade UI architecture for Project Isekai, moving from the prototype panels to a high-fidelity "Portal-Themed" command center.

## 1. Design Philosophy
- **Diegetic Transparency**: Arcane interface aesthetics combined with hard mechanical clarity.
- **The Threshold Interface**: The landing/login page is a ritual gate, not a form.
- **The Dice Altar**: Moment-to-moment resolution is a bottom-center ritual.
- **Canon Mutation View**: Every significant choice is tracked in a branching timeline UI.

## 2. Global Layout (Desktop)
- **Top Bar**: Persistent identity, level, health/mana, and world time.
- **Left Panel (Tactical Intelligence)**: Context-aware (Exploration, Dialogue, or Combat).
- **Center Canvas (Narrative/Scene)**: AI DM text output + dynamic inline lore highlights.
- **Right Panel (Player Systems)**: Character, Inventory, Relationships, and Canon Log tabs.
- **Bottom-Center (Dice Altar)**: The 3D/Interactive D20 resolution ritual anchor.

## 3. Component Mapping & Status

| Component | UI Blueprint Name | Status |
|---|---|---|
| `GlobalHeader.tsx` | Top Bar | ✅ Implemented (Needs refinement) |
| `DiceAltar.tsx` | The Dice Altar | ⏳ Milestone 14 |
| `TemplateEditor.tsx` | The Architect's Forge | 🚀 Milestone 14 |
| `PortalPage.tsx` | The Threshold | ⏳ Milestone 15 |
| `Codex.tsx` | Technical Intelligence | ✅ Implemented |
| `WorldMap.tsx` | Spatial Intelligence | ✅ Implemented |
| `CombatArena.tsx` | Tactical Intelligence | ✅ Implemented |

## 4. Interaction Grammar
- **Stat Rolls**: [Action] → Dice Altar activates → Roll → Resolve → Narrative Consequence.
- **World Creation**: Structure Navigator → Editor Canvas → Simulation Preview → Compile.
- **Canon Mutation**: Trigger → Consequence → Stability Delta → Irreversible Flag.

## 5. Visual Language
- **Palette**: Midnight Blue, Obsidian Black, Gold Accents.
- **Logic Colors**: 
  - Divine: Gold
  - Arcane: Cyan/Blue
  - Corruption: Violet
  - Instability: Red
- **Typography**: Serif (Headers/Narrative), Sans-Serif (Stats/Systems).
