# M49-A1 Feature Testing Guide

## Quick Start: Verify Faction Territory Features

### 1. ChronicleMap Territory Visualization

**To Test**:
1. Navigate to application at http://localhost:3000
2. Look for "The Known Lands" section with map of locations
3. Observe location boxes with different background colors

**Expected Behavior**:
- ✅ Some locations have faction color gradients in background
- ✅ Location names display faction names (e.g., "🏛 silver-flame")
- ✅ Contested territories show ⚔ icon (if multiple factions have close influence)
- ✅ Territory legend shows faction colors at bottom
- ✅ Hover on location highlights it with glow effect

**Legend Indicators**:
- 🏛 = Faction-controlled territory
- ⚔ = Contested territory (multiple factions with similar power)

### 2. Territory Narration (Browser Console)

**To Test**:
1. Open developer console (F12)
2. In game, navigate between locations with different faction control
3. Check console for SYSTEM_NARRATION events

**Expected Events**:
```javascript
// Friendly territory (rep >= 20)
{
  type: 'SYSTEM_NARRATION',
  narrativeType: 'territory_friendly',
  narration: 'You enter [faction] territory. The atmosphere feels familiar...'
}

// Hostile territory (rep <= -20)
{
  type: 'SYSTEM_NARRATION',
  narrativeType: 'territory_hostile',
  narration: 'You enter [faction] territory. Hostile presence fills the air...'
}

// Neutral territory (rep between -20 and 0)
{
  type: 'SYSTEM_NARRATION',
  narrativeType: 'territory_neutral',
  narration: 'You cross into [faction]-controlled territory...'
}
```

### 3. Faction Tax Events (Console Simulation)

**To Test Manually** (via Redux DevTools or console):
1. Create a MOVE action to hostile faction territory
2. Dispatch with player reputation < -20
3. Monitor events queue for FACTION_TAX_PAID or FACTION_BOUNTY_TRIGGERED

**Expected Event Scenarios**:

**Scenario A: Sufficient Gold**
```javascript
{
  type: 'FACTION_TAX_PAID',
  payload: {
    factionId: 'faction-id',
    factionName: 'Faction Name',
    amount: 35,
    playerReputation: -50,
    message: 'Faction Name tax collectors demand...'
  }
}
// Player gold decreases by tax amount
// Movement continues
```

**Scenario B: Insufficient Gold**
```javascript
{
  type: 'FACTION_BOUNTY_TRIGGERED',
  payload: {
    factionId: 'faction-id',
    factionName: 'Faction Name',
    requiredGold: 35,
    playerGold: 5,
    playerReputation: -50,
    message: 'Faction Name patrols catch you...'
  }
}
// Bounty placed
// No gold deduction
// Combat may trigger (M49+ feature)
```

**Scenario C: Neutral Stance**
```javascript
{
  type: 'FACTION_SUSPICIOUS',
  payload: {
    factionId: 'faction-id',
    factionName: 'Faction Name',
    playerReputation: -10,
    message: 'Faction Name patrols eye you suspiciously...'
  }
}
// No penalty applied
// Atmospheric warning only
```

### 4. Territory Legend Validation

**To Test**:
1. Scroll to bottom of ChronicleMap
2. Look for "Faction Territories" section
3. Verify faction colors and names

**Checklist**:
- ✅ All factions with controlled territories show in legend
- ✅ Each faction has a colored square matching its territory color
- ✅ Control icon explanation displays (🏛 vs ⚔)
- ✅ Fragment types legend still displays below territory legend
- ✅ Durability color legend still present

### 5. Tax Calculation By Reputation Tier

**Test Thresholds** (modify player.factionReputation in dev tools):

| Reputation | Scenario | Tax Amount | Event |
|------------|----------|-----------|-------|
| +50 | Friendly | 0 | No event |
| 0 | Neutral (at border) | 0 | No event |
| -1 | Slightly tense | 3 | FACTION_SUSPICIOUS |
| -20 | Hostile starts | 15 | FACTION_TAX_PAID or BOUNTY |
| -50 | Very hostile | 35 | FACTION_TAX_PAID or BOUNTY |
| -100 | Maximum hostility | 35 | FACTION_TAX_PAID or BOUNTY |

### 6. Visual Feedback Testing

**Territory Opacity Test**:
1. Locate a location with high faction influence (>80)
2. Compare opacity to a location with low influence (30-40)
3. Higher influence should appear more saturated/opaque

**Contested Territory Test**:
1. Find a location with two factions within 20 influence points
2. Should display:
   - ⚔ icon instead of 🏛
   - Gold glow around borders
   - Enhanced highlight on hover

### 7. Gold System Integration

**To Test**:
1. Check player inventory for 'gold' item
2. Trigger FACTION_TAX_PAID event
3. Verify gold quantity decreased

**Debug Check**:
```javascript
// In console
player.inventory.find(i => i.kind === 'stackable' && i.itemId === 'gold')
// Should show quantity property
// Quantity should decrease after tax payment
```

## Advanced Testing

### Force Specific Scenarios

**In Redux DevTools or memory**:

```javascript
// Make location controlled by specific faction
state.influenceMap['location-id'] = {
  'faction-id': 100  // High influence
};

// Set player reputation
state.player.factionReputation['faction-id'] = -50;

// Ensure player has gold
state.player.inventory = [
  {
    kind: 'stackable',
    itemId: 'gold',
    quantity: 100
  }
];

// Dispatch MOVE action
// Verify FACTION_TAX_PAID event triggers
// Verify gold decreased to 65
```

### Performance Check

Open browser DevTools Network and Performance tabs:

**Expected**:
- ✅ Territory calculation adds <2ms to render
- ✅ No visible frame drops when switching territories
- ✅ Legend renders instantly
- ✅ Hover effects smooth (60 FPS)

### Responsive Testing

**Test Territory Display**:
- Desktop: Full legend with all faction colors
- Tablet: Legend columns adjust (2 columns instead of 3)
- Mobile: Legend stacks single column

## Known Limitations (M49-A1)

1. **Combat Encounters**: FACTION_BOUNTY_TRIGGERED created but combat not yet implemented (M49+ feature)
2. **Reputation Modifiers**: No automatic reputation changes from territory entry (M49-A2 feature)
3. **Dynamic Updates**: Territory influence doesn't change during gameplay yet (depends on future events system)
4. **NPC Patrols**: No actual patrol mechanics yet (M49-A3 feature)

## Troubleshooting

**Issue**: Territory colors not showing
- **Solution**: Clear browser cache, hard refresh (Ctrl+F5)
- **Check**: Verify factions have `influenceTheme.color` in factionEngine.ts

**Issue**: Tax event not triggering
- **Check**: Player reputation with faction < -20?
- **Check**: Player has gold item in inventory?
- **Check**: Location has controlling faction (influence > 30)?

**Issue**: Legend shows no factions
- **Check**: Any faction has `controlledLocationIds` populated?
- **Check**: influenceMap properly initialized in worldEngine?

**Issue**: Gold not deducting
- **Check**: Gold item has `kind: 'stackable'` and `itemId: 'gold'`?
- **Check**: FACTION_TAX_PAID event actually triggered?
- **Debug**: Log inventory before/after event

## Console Commands for Testing

```javascript
// Check if location controlled
state.factions.find(f => f.id === 'silver-flame')?.controlledLocationIds

// Check influence at location
state.influenceMap?.['location-id']

// Check player gold
state.player.inventory?.find(i => i.itemId === 'gold')?.quantity

// Check player reputation with faction
state.player.factionReputation?.['faction-id']

// Test territory function
import { getLocationControllingFaction } from './engine/factionTerritoryEngine'
getLocationControllingFaction(state, 'location-id')
```

## Next Steps After Testing

✅ M49-A1 Complete and tested?
→ Proceed to **M49-A2: Rumor Investigation Pipeline**

Issues found?
→ Document in GitHub issues
→ Create hotfix branch
→ Re-test after fix

---

**M49-A1 Testing Status**: Ready for QA validation
