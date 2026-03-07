# DSS 11 — World Templates & Talent Injection

## 11.1 The World Template (Master Configuration)
A **World Template** is the root configuration file for a simulation instance. It defines the global variables that all other DSS modules (00-10) consume.

### 11.1.1 Template Schema
```json
{
  "TemplateID": "string",
  "Metadata": {
    "Name": "string",
    "Description": "string",
    "WorldEpoch": "string"
  },
  "GlobalConstants": {
    "TickDuration": 1.5,
    "GravityScale": 1.0,
    "ManaSaturation": 0.5
  },
  "TalentPool": "TalentID[]",
  "AncestryAvailability": "AncestryID[]",
  "DivinePresence": "DeityID[]",
  "EconomicModel": "ResourceChainID"
}
```

---

## 11.2 The World-Locked Talent Pool
Talents are not universal. They are **Injected** by the World Template. A character in a "High-Magic Wasteland" template will have access to different talents than a "Grim-Dark Industrial" template.

### 11.2.1 Talent Injection Rule
- At character creation, the engine queries the `ActiveWorldTemplate.TalentPool`.
- The UI generates the selection list **only** from this valid subset.
- **Genetic Lock:** Some talents may be further filtered by the selected `AncestryID`.

### 11.2.2 Talent Structure (Internal Spec)
```ts
type Talent = {
  id: string;
  name: string;
  description: string;
  compatibility: {
    worldTemplates: string[]; // Which worlds allow this talent
    ancestries?: string[];    // Optional ancestral requirements
  };
  modifiers: Record<string, number>; // Plugs into Attributes/Vitals curves
  levelCap: number; // Max level this talent can reach
}
```

---

## 11.3 Template-Driven Vitals & Attributes
The meaning and weight of stats (DSS 01/05) can drift based on the template.
- **Example (Template: Aquatic World):**
    - `AGI` modifier for movement is doubled.
    - `STR` weight for Carry Capacity is reduced by 25% (buoyancy).
    - `Nourishment` decay is linked to "Hydration" rather than "Satiety."

---

## 11.4 Economic & Resource Injection
The `ResourceChainID` in the template defines what materials exist in the world.
- A Template with `Steam-Punk` logic will inject `Coal` and `Steam-Pressure` as primary resource nodes.
- A Template with `High-Fantasy` logic will inject `Mana-Crystals` and `Essence`.

---

## 11.5 Talent Levelling & Cognitive Limit
- Even World-Locked Talents are subject to the **INT/WIS Learning Curve** (DSS 01).
- Levelling a template talent requires **Correct Workstation Interaction** (e.g., a "Stealth" talent requires a "Shadow-Anvil" or similar workstation in specific templates).
