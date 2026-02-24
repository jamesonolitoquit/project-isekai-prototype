# M49 Quick Reference - Developer Handbook

## M49-A1 Architecture at a Glance

### Three Core Modifications

```
1. NEW: factionTerritoryEngine.ts
   ├─ getLocationControllingFaction(state, locationId) → Faction | null
   ├─ calculateFactionTax(state, locationId) → {amount, factionId, factionName}
   ├─ isHostileTerritory(state, locationId) → boolean
   └─ Other: getTerritoryOpacity, isLocationContested, getLocationFactions, etc.

2. MODIFIED: ChronicleMap.tsx
   ├─ Imports factionTerritoryEngine functions
   ├─ Calculates territory color per location
   ├─ Renders faction name + control icon (🏛 or ⚔)
   ├─ Adds territory glow on hover
   └─ Displays faction legend (top 8 factions)

3. MODIFIED: actionPipeline.ts
   ├─ Imports factionTerritoryEngine
   ├─ MOVE case → calls getLocationControllingFaction()
   ├─ Checks playerRep < -20 → triggers tax
   ├─ Emits FACTION_TAX_PAID, FACTION_BOUNTY_TRIGGERED, or FACTION_SUSPICIOUS
   └─ Deducts gold from inventory (kind: 'stackable', itemId: 'gold')
```

---

## Critical Data Structures

### InventoryItem Discriminated Union
```typescript
// DO NOT USE: item.name (doesn't exist on StackableItem)
// USE THIS:
(item.kind === 'stackable' && item.itemId === 'gold')

// Structure:
StackableItem = {
  kind: 'stackable',
  itemId: string,    // e.g., 'gold', 'healing-potion-minor'
  quantity: number
}
```

### WorldState Properties Used by M49-A1
```typescript
state.influenceMap?.[locationId][factionId]   // number (influence score)
state.factions[]                                // Faction objects
state.player.factionReputation?.[factionId]    // number (-100 to +100)
state.player.inventory[]                        // InventoryItem[]
state.locations[]                               // Location with x, y
```

### Faction Interface
```typescript
interface Faction {
  id: string
  name: string
  controlledLocationIds: string[]
  influenceTheme?: {
    color: string                // '#fffacd', '#cc0000', etc.
    ambiance?: 'ethereal' | 'industrial' | 'opulent' | 'none'
  }
  alignment: 'good' | 'neutral' | 'evil' | 'chaotic'
}
```

---

## M49-A1 Event Types

### FACTION_TAX_PAID
```javascript
{
  type: 'FACTION_TAX_PAID',
  factionId: 'silver-flame',
  factionName: 'The Silver Flame',
  amount: 35,
  playerReputation: -50,
  message: 'The Silver Flame tax collectors demand 35 gold...'
}
```
**Trigger**: playerRep < -20, sufficient gold
**Effect**: Gold deducted from inventory

### FACTION_BOUNTY_TRIGGERED
```javascript
{
  type: 'FACTION_BOUNTY_TRIGGERED',
  factionId: 'silver-flame',
  factionName: 'The Silver Flame',
  requiredGold: 35,
  playerGold: 5,
  playerReputation: -50,
  message: 'The Silver Flame patrols catch you...'
}
```
**Trigger**: playerRep < -20, insufficient gold
**Effect**: No gold deducted, bounty placed (future combat in M49+)

### FACTION_SUSPICIOUS
```javascript
{
  type: 'FACTION_SUSPICIOUS',
  factionId: 'silver-flame',
  factionName: 'The Silver Flame',
  playerReputation: -10,
  message: 'The Silver Flame patrols eye you suspiciously...'
}
```
**Trigger**: -20 < playerRep < 0
**Effect**: No penalty, atmospheric warning

---

## Reputation Tiers & Tax Amounts

| playerRep | Scenario | Tax | Event |
|-----------|----------|-----|-------|
| > 0 | Friendly | ✗ 0 | None |
| 0 to -1 | Neutral | ✗ 0 | None |
| -1 to -20 | Neutral/Tense | ⚠ Suspicious | FACTION_SUSPICIOUS |
| -20 to -50 | Unfriendly | 💰 15 gold | TAX_PAID or BOUNTY |
| < -50 | Hostile | 💰 35 gold | TAX_PAID or BOUNTY |

---

## Implementation Checklist for M49-A2

### Rumor Generation
- [ ] Create `rumorEngine.ts` with Rumor interface
- [ ] Add `generateTerritoryRumor()` function
- [ ] Hook into territory event system
- [ ] Create sample rumor templates

### NPC Integration
- [ ] Add `rumors[]` array to NPC interface
- [ ] Implement `generateRumorDialogue()` in npcEngine
- [ ] Update NPC dialogue generation to include gossip
- [ ] Add rumor cooldown mechanic

### Investigation System
- [ ] Add `INVESTIGATE_RUMOR` action to actionPipeline
- [ ] Create evidence collection mechanics
- [ ] Implement credibility calculation
- [ ] Track investigation progress

### Crystallization
- [ ] Implement `crystallizeRumor()` function
- [ ] Calculate reputation impacts
- [ ] Create persistent artifacts
- [ ] Wire to worldState

### UI Layer
- [ ] Create `RumorBoard.tsx` component
- [ ] Update NPC dialogue UI for gossip options
- [ ] Add investigation progress bar
- [ ] Implement evidence display

---

## Quick Debugging Commands (Console)

```javascript
// Territory functions
import { getLocationControllingFaction, getTerritoryOpacity } from './engine/factionTerritoryEngine'
getLocationControllingFaction(state, 'location-id')
getTerritoryOpacity(state, 'location-id', faction)

// Check influences
state.influenceMap?.['location-id']

// Check gold
state.player.inventory?.find(i => i.itemId === 'gold')?.quantity

// Check faction rep
state.player.factionReputation?.['faction-id']

// Trigger tax event manually
dispatch({ type: 'MOVE', payload: { to: 'hostile-location-id' } })
```

---

## Files You'll Touch in M49-A2

### Create New
- [ ] `src/engine/rumorEngine.ts` (~400 lines)
- [ ] `src/client/components/RumorBoard.tsx` (~300 lines)
- [ ] `src/data/rumors.json` (rumor templates)

### Modify Existing
- [ ] `src/engine/npcEngine.ts` (add rumor properties & generation)
- [ ] `src/engine/actionPipeline.ts` (add INVESTIGATE_RUMOR case)
- [ ] `src/engine/worldEngine.ts` (add activeRumors to WorldState)
- [ ] `src/client/App.tsx` (integrate RumorBoard component)

### Testing
- [ ] `M49_A2_TESTING_GUIDE.md` (create similar to A1 guide)
- [ ] `M49_A2_COMPLETION_REPORT.md` (create after implementation)

---

## Performance Budget (per phase)

**M49-A1**: 🟢 PASSED
- Territory lookup: <2ms
- ChronicleMap render: No new bottlenecks
- Event creation: No allocation spikes

**M49-A2 (target)**:
- Rumor generation: <5ms
- Investigation lookup: <3ms
- UI rendering: <10ms total
- No memory leaks

---

## Critical Warnings

⚠️ **DO NOT**:
- Modify `stateimpact` manually (auto-calculated)
- Create rumor events without checking `activeRumors` array limit
- Bypass reputation checks for tax calculation
- Use deprecated inventory format (e.g., `item.name`)

✅ **DO**:
- Use `getLocationControllingFaction()` for all territory queries
- Check player gold before applying tax
- Emit proper event types for UI consumption
- Cache expensive lookups (influenceMap access)

---

## Code Pattern Reference

### Territory Check Pattern
```typescript
const controllingFaction = getLocationControllingFaction(state, locationId);
if (controllingFaction) {
  const playerRep = state.player.factionReputation?.[controllingFaction.id] || 0;
  if (playerRep < -20) {
    // Trigger bounty/tax
  }
}
```

### Gold Deduction Pattern
```typescript
const goldItem = state.player.inventory?.find(item =>
  (item as any).kind === 'stackable' && (item as any).itemId === 'gold'
) as any;

if (goldItem && goldItem.quantity >= taxAmount) {
  goldItem.quantity -= taxAmount;
  // Success
} else {
  // Insufficient funds
}
```

### Event Creation Pattern
```typescript
events.push(createEvent(state, action, 'EVENT_TYPE', {
  factionId: controllingFaction.id,
  factionName: controllingFaction.name,
  amount: taxAmount,
  message: 'Player-facing narrative text',
  metadata: subObject // Optional
}));
```

---

## Integration Checklist

Before you start M49-A2, verify:
- [ ] M49-A1 builds with zero errors
- [ ] Dev server runs at localhost:3000
- [ ] ChronicleMap displays faction territories
- [ ] Tax events trigger in console
- [ ] Gold deduction works (inspect inventory)
- [ ] No performance regressions
- [ ] All M49-A1 tests pass

---

## Document Quick Links

📄 **M49-A1**:
- [M49_A1_COMPLETION_REPORT.md](M49_A1_COMPLETION_REPORT.md) - Full technical overview
- [M49_A1_TESTING_GUIDE.md](M49_A1_TESTING_GUIDE.md) - QA procedures
- [factionTerritoryEngine.ts](factionTerritoryEngine.ts) - Implementation source

📄 **M49-A2** (Design-ready):
- [M49_A2_IMPLEMENTATION_PLAN.md](M49_A2_IMPLEMENTATION_PLAN.md) - Detailed design doc

📄 **M49 Overall**:
- [M49_STATUS.md](M49_STATUS.md) - Initiative status & roadmap

---

## Useful Snippets

### Check if location contested
```typescript
import { isLocationContested } from './engine/factionTerritoryEngine'
const contested = isLocationContested(state, locationId)
if (contested) {
  // Show ⚔ icon
}
```

### Get all factions at location
```typescript
import { getLocationFactions } from './engine/factionTerritoryEngine'
const factions = getLocationFactions(state, locationId)
factions.forEach(({faction, influence}) => console.log(faction.name, influence))
```

### Calculate reputation impact
```typescript
const playerRep = state.player.factionReputation?.[factionId] || 0
const isFriendly = playerRep > 0
const isHostile = playerRep < -20
const reputation = {
  friendly: 'Green zone - no issues',
  neutral: 'Yellow zone - monitor',
  hostile: 'Red zone - danger'
}[isFriendly ? 'friendly' : isHostile ? 'hostile' : 'neutral']
```

---

## Questions? Debug Path

1. **Compilation Error?** → Check file imports in actionPipeline.ts
2. **ChronicleMap not showing territory?** → Verify faction has `influenceTheme.color`
3. **Tax not triggering?** → Verify player has controlling faction and reputation < -20
4. **Gold not deducting?** → Inspect gold item structure (use pattern above)
5. **Performance issue?** → Profile territory lookup cost with DevTools

---

**Quick Ref Version**: 1.0
**M49-A1 Status**: ✅ COMPLETE
**Ready for M49-A2?**: ✅ YES

Keep this guide handy - print it out or pin it to your workspace!
