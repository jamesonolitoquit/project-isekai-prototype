# DSS 10 — UI & User Interaction (UX) Physics

## 10.1 The Diegetic Tabletop Principle
The game is a 3-column "No-Scroll" 3D Stage. Every window is a physical artifact.
- **Dossier (Left):** A book representing the Vessel's attributes, skills, and current Vitals.
- **Stage (Center):** The 3D Tile-Grid where the `Atomic Pulse` (Combat) and Exploration occur.
- **Altar (Right):** The "Dice Altar" where the `Phase 4: Resolution` triggers.

## 10.2 Interaction Precision & Costs
Moving the cursor or selecting an object operates on the **Pre-Input Phase (0)**.
- **Hover:** Reveals `PER` (Perception) metadata based on the character's stats.
- **Click:** Commits the action to the `Resolution Stack`.
- **Latency Logic:** If the client/server desyncs past 1 Tick (1.5s), the client displays a **Temporal Blur** (Visual cue) while the `Batch Catch-up` occurs.

## 10.3 Hotkeys & The Action Tray
- **The Tray:** A limited slot system (6-8 items/skills) mapped to keys 1-8.
- **Swapping:** Dragging a new item to the tray during an `Atomic Pulse` (Combat) costs 1 **Minor Action**.
- **Equipping:** Changing a weapon or armor piece during combat cost 1 **Major Action**.

## 10.4 The Fog of War (Perception-Based Rendering)
Tiles not within the `PER` radius of any Player or Faction-Controlled NPC are rendered in a **Monochrome Static State**.
- **Movement into Static:** Triggers a `RNG_Hazard_Check` during Phase 3 of the Resolution Stack.
- **Memory:** Previously explored tiles remain visible in **Sepia Tone**, but their `Resource_Node` and `NPC_Position` data is cached and potentially outdated (Information Lag).
