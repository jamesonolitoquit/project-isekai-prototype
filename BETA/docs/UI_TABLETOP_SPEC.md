# UI Design Spec: Diegetic 3D Tabletop (Phase 48-UI)

## 1. Visual Philosophy: "The Bounded Box"
The screen is no longer a web page; it is a **physical tabletop surface**.
- **No Scrolling**: `overflow: hidden` on all root elements.
- **Fixed Viewport**: All UI must exist within `100vh` and `100vw`.
- **Z-Space Interaction**: Use `translateZ` and `perspective` to give UI elements "weight" (e.g., Modals sit 100px "above" the board).

## 2. Layout Architecture: The 3-Column Grid
The interface is partitioned into three functional "Wings" that remain static while the world board rotates beneath/between them.

| Wing | Width | Purpose | Primary Components |
| :--- | :--- | :--- | :--- |
| **Left Wing** | 300px | **The Dossier** | `DiegeticStatSheet`, `BuffTracker`, `AncestryRibbon` |
| **Center** | 1fr | **The Stage** | `TabletopContainer`, `3D-Grid`, `CombatPopups` |
| **Right Wing** | 320px | **The Repository** | `DiceAltar` (Top), `ActionTray` (Center), `MiniInventory` (Bottom) |

## 3. Diegetic Theming (Narrative Codecs)
The UI skin must transform based on `WorldTemplate.genre`.

### A. Fantasy (Medieval)
- **Background**: Polished dark walnut or coarse mahogany.
- **Color Palette**: Gold (#FFD700), Parchment (#F5F5DC), Deep Crimson (#8B0000).
- **Fonts**: Serif (Cinzel, Playfair Display).
- **Aesthetics**: Candle-glow, worn edges, wax seals.

### B. Cyberpunk (Glitch)
- **Background**: Carbon fiber, brushed steel, or "The Grid" (dark gridlines).
- **Color Palette**: Cyber Cyan (#00FFFF), Neon Magenta (#FF00FF), High-Contrast Black.
- **Fonts**: Monospace (JetBrains Mono, Roboto Mono).
- **Aesthetics**: Scanlines, chromatic aberration, frosted glass.

## 4. Interaction Patterns
- **The "Slam"**: When a die roll finishes, a "SUCCESS" or "FAILURE" stamp should scale down rapidly with a blur effect.
- **The "Slide"**: Side panels should not snap; they should "slide" out from the screen edges.
- **The "Focus"**: When a modal (like Awakening) is active, the background board should blur (`backdrop-filter: blur(8px)`) and desaturate.

## 5. UI Z-Stack Guidelines
1. **Background Surface**: 0
2. **Game Board (3D)**: 100
3. **Tabletop Scars/Shadows**: 200
4. **Pinned Wings**: 500
5. **Action Cards / Hover Tooltips**: 1000
6. **Modals (Awakening/Creation)**: 10000
7. **Loading Overlay (The Weaver)**: 20000
