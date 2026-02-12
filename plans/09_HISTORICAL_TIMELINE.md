# 09 — Historical Timeline, Key Events & Emergent History

> Project Isekai — Luxfier Alpha
> Master Reference: `plans/00_MASTER_REFERENCE.md`
> Dependencies: `02_COSMOLOGY_METAPHYSICS.md`, `07_FACTIONS_POLITICS.md`

Establishes canon events, provides hooks for emergent gameplay, and ties player actions
to evolving world history.

---

## 9.1 Core Principles

- History is layered: canonical past, partially hidden truths, and player-shaped emergent events
- Events shape factions, magic, technology, and artifacts
- AI DM adjudicates changes: player actions can trigger new branches, but cannot overwrite hard canon
- Replayability: each playthrough can generate unique emergent history
- Belief propagation: events feed into CB, FB, PB, and WTOL

---

## 9.2 Major Historical Eras

| Era | Key Events / Innovations | Notes |
|---|---|---|
| 20,000+ Pre-History | Unknown civilizations; Lux-Ar emergence | Mostly WTOL-protected |
| 20,000 A.A. | Dwarven extinction | Relics & early tech lost |
| 15,000 A.A. | Soul Age / Book of Knowledge | Alchemy, Flux experimentation |
| 12,000 A.A. | Early Mortal Races emerge | Elfin sub-races separate; Beastkin tribes form |
| 11,900 A.A. | War of Immortals | Kael'Vahn seals Dreakin; catalysts for faction splits |
| 11,000 A.A. | Age of Gods | Celestin dominance; religious structures solidified |
| 8,000 A.A. | Maxi Fluctus | Extreme environmental and magical upheaval |
| 7,500 A.A. | Amber Discovery (0 A.A.) | Start of modern Luxfier timeline |
| 5,000 A.A. | Rune Age | Technological advancement, runic infusion, guilds |
| 1,500 A.A. | Arrival of Haruto Aizawa | Human influence; formation of League of Legendary Idols |

---

## 9.3 Canonical Key Events

- **War of Immortals** — Dreakin sealed; Kael'Vahn enacts final command; formation of Last Command cult
- **Maxi Fluctus** — Extreme environmental collapse; trigger for Beastkin migrations; rise of Mage Guild oversight
- **Amber Discovery** — Establishes modern calendar (Amber Calendar); foundation for city-states, trade, guilds
- **League Formation** — Legendary Idols inspire morale; cultural, political, and factional influence; AI DM uses as recurring narrative anchor
- **Relic Dispersal** — Seven Relics scattered across dimensions; Seven Weapons of Sin left as potential narrative hazards

---

## 9.4 Player-Driven Emergent History

### Principles
- Branching outcomes: player choices create local or global changes
- Dynamic updates: Belief Layer, Faction Graphs, WTOL reflect new truths
- Temporal causality: actions may retroactively adjust minor details in faction memory/logs
- Risk-reward: altering history may trigger corruption, faction retaliation, or unexpected magical phenomena

### Event Types
- **Factional Conflicts** — wars, assassinations, coups, alliances
- **Relic Discoveries / Misuse** — minor relics, infused artifacts, forbidden knowledge
- **Magical Cataclysms** — partial Lux-Ar destabilization, flux anomalies
- **Social Milestones** — formation of guilds, idol successes/failures, cultural revolutions
- **Player Legacy** — actions can influence NPC belief, city states, or artifact progression

---

## 9.5 Timeline Representation in Database

| Table | Key Fields |
|---|---|
| **HistoricalEra** | era_id, name, start_date, end_date, summary |
| **CanonEvent** | event_id, era_id, title, description, participants, impact, artifact_links |
| **EmergentEvent** | event_id, session_id, title, description, triggers, impact, faction_changes, belief_updates |
| **EventLog** | session_id, entity_id, event_id, pre_state, post_state, timestamp |

---

## 9.6 AI DM Enforcement Rules

- **Canon vs Emergent:** canonical events are immutable; emergent events must not violate hard canon
- **Belief Propagation:** new events automatically update CB, FB, PB, and WTOL
- **Faction Influence:** emergent events shift power graphs dynamically
- **Artifact Interaction:** emergent events may reveal minor artifacts or hint at major relics
- **Replayability:** emergent history tracked per session to ensure variability

---

## Why This Layer Holds

- Maintains Luxfier's mythic and epic scope while allowing flexible player influence
- Ensures emergent replayability: no two timelines are identical
- Ties narrative, magic, combat, and faction systems together
- Provides AI DM deterministic and dynamic levers to manage world evolution
