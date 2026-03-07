# DSS 15 — Asset Ownership, Commodities & Illegal Actions

## 15.1 Physical Ownership
All items and resources (DSS 09) have an `OwnerID` flag.
- **The Theft Formula:** Attempting to take an item where `ActorID != OwnerID`.
  - *Constraint:* Requires a `DEX` check vs. an NPC's `PER`.
  - *Consequence:* Failed theft immediately triggers a **Social Whisper** (DSS 14) within the Tile.

## 15.2 Commodities & Market Valuation
Items are categorized by **Commodity Level**.
- **Common:** No `OwnerID` check in neutral zones.
- **Restricted:** Requires a `FactionID` License or `CHA` check per 600 Ticks.
- **Illegal:** Carrying these items (Templates-dependent, e.g., Forbidden Tech or Cursed Artifacts) automatically adds a `+5 Modifier` to the **Paradox Debt** per turn they are used.

## 15.3 Currency & Barter Physics
- **Physical Currency:** No "Global Bank." Currency has weight.
- **Resource Barter:** In low-stability Tiles, Factions may refuse Currency entirely, requiring a **Direct Resource Swap** (DSS 09).
- **The Currency Sink:** As world `Inflation` rises (f(Production)), the **School System** (DSS 01) prices increase at 1.5x the rate of common resources.
