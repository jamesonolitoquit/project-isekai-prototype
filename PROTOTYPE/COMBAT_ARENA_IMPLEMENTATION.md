# Combat Arena Implementation

## Overview
A full-screen combat arena UI component has been implemented for the Luxfier prototype, displaying real-time combat encounters with player and enemy status, health bars, and action buttons.

## Files Created

### [src/client/components/CombatArena.tsx](src/client/components/CombatArena.tsx)
The main CombatArena component that renders when combat is active (`state.combatState.active === true`).

**Features:**
- **Full-screen overlay** with dark background
- **Player status card** showing:
  - Current HP / Max HP
  - Dynamic health bar with color coding (green > 50%, orange 25-50%, red < 25%)
  - Active status effects
- **Enemy status cards** (grid layout, auto-responsive):
  - Enemy name and HP display
  - Individual health bars
  - Attack and Defend buttons per enemy
  - Hover scale animation
- **Combat log** showing last 10 combat events
- **Action buttons**:
  - ❤️ Heal - Global healing action
  - 🛡️ Block (per enemy) - Defensive stance
  - ⚔️ Attack (per enemy) - Offensive action
  - Flee Combat - Exit combat state

**Props:**
```typescript
interface CombatArenaProps {
  state?: any;              // World state
  onAttack?: (targetId: string) => void;      // Attack action
  onDefend?: (targetId: string) => void;      // Defend/Block action
  onParry?: (targetId: string) => void;       // Parry action (unused in UI)
  onHeal?: () => void;                        // Self-heal action
  onExitCombat?: () => void;                  // Flee/exit combat
}
```

## Integration

### Modified Files

#### [src/pages/index.tsx](src/pages/index.tsx)
1. **Import added** (line 16):
   ```typescript
   import CombatArena from "../client/components/CombatArena";
   ```

2. **Handler added** (after `doHeal`):
   ```typescript
   const doExitCombat = () => {
     if (!controller) return;
     controller.performAction({
       worldId: controller.getState().id,
       playerId: controller.getState().player.id,
       type: "EXIT_COMBAT",
       payload: {}
     });
   };
   ```

3. **Component rendered** (before closing `</div>`):
   ```typescript
   <CombatArena
     state={state}
     onAttack={doAttack}
     onDefend={doDefend}
     onParry={doParry}
     onHeal={doHeal}
     onExitCombat={doExitCombat}
   />
   ```

## UI Design

### Colors
- **Gold (#ffd700)**: Player UI accent
- **Red (#d32f2f)**: Enemy indicators, attack buttons
- **Green (#4CAF50)**: Defend buttons
- **Blue (#42a5f5)**: Heal/utility buttons
- **Dark background**: `rgba(0, 0, 0, 0.9)` for visibility

### Layout
- **Responsive grid**: Auto-fit columns (min 200px, max 1fr)
- **Max-width**: 1000px for desktop readability
- **Mobile-friendly**: Stacks on smaller screens
- **Z-index**: 2000 (topmost layer)

### Health Bar Logic
```
> 50% remaining: Green (#66bb6a)
25-50% remaining: Orange (#ffa726)
< 25% remaining: Red (#d32f2f)
```

## State Requirements

The component expects `state.combatState` with:
```typescript
{
  active: boolean;
  roundNumber: number;
  participants: string[];  // NPC IDs in combat
  log?: string[];          // Combat event logs
}
```

Player state expected:
```typescript
{
  hp: number;
  maxHp: number;
  statusEffects?: string[];
}
```

NPC state expected:
```typescript
{
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  locationId: string;
}
```

## Activation Conditions

Combat arena displays when:
1. `state.combatState.active === true`
2. Player is in active combat encounter
3. Component returns `null` when not in combat (no UI rendered)

## Action Flow

```
User clicks action button
    ↓
Callback fired (e.g., onAttack(enemyId))
    ↓
Handler (e.g., doAttack) creates action
    ↓
Controller.performAction() processes action
    ↓
Engine updates state
    ↓
Component re-renders with new state
```

## Styling Notes

- **All inline styles** for self-contained component
- **No external CSS** dependency
- **Responsive sizing** with percentage-based widths
- **Smooth transitions** on health bar changes (0.3s)
- **Accessibility**: Color-coded HP for visibility

## Future Enhancements

1. Add ability selection/quick slots
2. Combat turn order display
3. Damage numbers floating animation
4. Sound effects for actions
5. Experience/loot preview on victory
6. Tactical grid positioning
7. Spell/ability cooldown indicators
8. Enhanced particle effects during combat
