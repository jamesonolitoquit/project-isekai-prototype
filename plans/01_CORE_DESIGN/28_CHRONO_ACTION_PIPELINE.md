# Layer 28: Chrono-Action Pipeline (Action-Driven Time Model)

> **Status:** PROTOTYPE
> **Category:** CORE-ENGINE
> **Internal Layer:** XI.32
> **Updated:** February 17, 2026

---

## 1. Overview

The **Chrono-Action Pipeline** replaces the traditional real-time "wall-clock" progression with a deterministic, action-driven model. Time in Luxfier only advances when the player performs a meaningful action, effectively turning the world into a turn-based environment where the "length" of a turn depends on the complexity of the action.

### 2. Core Philosophy

- **Zero Pressure:** Players should never feel rushed to type a response or make a decision. The clock "stops" while the player is thinking.
- **Narrative Logic:** If an action would logically take time (e.g., walking across a forest, having a long conversation, or resting), the world clock advances to match.
- **AI Adjudication:** The AI DM evaluates the "narrative weight" of dialogue and complex intents to determine how much time has passed.

---

## 3. Data-Driven Time Model

Time calculations are powered by the **World Template** (`luxfier-world.json`) and the **Travel Matrix**.

### 3.1 Standard Action Costs
| Action Type | Base Tick Cost | Real-Time Equivalent (approx) |
|---|---|---|
| **Wait** | 60 ticks | 1 Hour |
| **Search Area** | 15 ticks | 15 Minutes |
| **Short Rest** | 60 ticks | 1 Hour |
| **Long Rest** | 480 ticks | 8 Hours |
| **Combat Round** | 1 tick | 6 Seconds |
| **Dialogue** | 0.08 ticks / word | ~13 words per minute |

### 3.2 Travel Matrix
The World Template defines the "distance" (in ticks) between established locations. 
- **Direct Path:** If a path exists in the `travelMatrix`, that cost is used.
- **Default Travel:** 60 ticks (1 hour) per location shift if not specified.

---

## 4. Implementation Details

### 4.1 Chrono-Action Hook (`worldEngine.ts`)
The `performAction` function in the kernel is modified to:
1. Process the action and collect resulting events.
2. Determine the `finalTickCost` based on the action type and payload.
3. Call `advanceTick(finalTickCost)` to synchronize the world state (weather, NPC schedules, day phase).
4. Emit the updated state to the UI.

### 4.2 AI Dialogue Timing (`aiDmEngine.ts`)
When the AI DM generates a response, it calculates the word count and applies a time penalty to the world.
- **Calculation:** `Math.ceil(wordCount * 0.08)`.
- **Impact:** Engaging in deep lore conversations naturally advances the day phase.

### 4.3 Deterministic Replay
Because time progression is now explicitly linked to `Action` events in the `Mutation Log`, replaying a session will result in the exact same time-of-day transitions, ensuring 100% deterministic consistency across different machines.

---

## 5. UI/UX Manifestation

- **Time-Lapse Clock:** The UI clock should not "jump" but rather animate the hands (or digits) rapidly to the new time during a transition.
- **Time Toast:** A small notification or "toast" can appear showing the time jump (e.g., *"+45 minutes passed"*).
- **Nighttime Hazards:** Since time doesn't move unless the player moves, being "caught at night" is a choice, not an accident of slow typing. Players must decide when to "Wait" or "Rest."

---

## 6. Future Extensions (Alpha/Beta)

- **Regional Time Dilation:** Some areas (like the Abyss Edge) may have a higher tick cost for the same action due to psychic/temporal distortion.
- **Montage System:** Groups of actions can be compressed into a single "Narrative Montage" with a combined time cost.
