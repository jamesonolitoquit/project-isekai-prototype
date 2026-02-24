# SENSORY LAYER TESTING GUIDE - M48-A5

## Overview
This guide covers manual testing of the three sensory resonance layers integrated in ALPHA:
1. **Truth Ripple**: Dialogue distortion effects
2. **Goal Flashes**: Personality trait visual indicators
3. **Spatial Mapping**: World fragment coordinate representation

---

## TEST 1: TRUTH RIPPLE (Dialogue Distortion)

### What It Is:
Truth Ripple is the chromatic aberration and text glitch effect that appears during dialogue when NPCs are communicating rumors or distorted information. Higher belief distortion = stronger visual effect.

### Prerequisites:
- ✅ Character creation complete (skip if already in game)
- ✅ Game world loaded with NPCs
- ✅ EnhancedDialogPanel visible

### Test Steps:

1. **Locate an NPC** in the game world
2. **Initiate dialogue**:
   - Click on NPC
   - Wait for DialogPanel or EnhancedDialogPanel to appear
3. **Observe dialogue text**:
   - **Look for**: Chromatic aberration (red-cyan color separation)
   - **Look for**: Text glitch/flicker effects
   - **Look for**: Slight distortion shader applied to text
4. **Check component integration**:
   - Press F12 to open DevTools
   - Go to Console tab
   - Verify NO errors related to `PerceptionGlitchOverlay`
   - Check that paradoxDebt from WorldState is > 0 (enables glitch effects)

### Expected Results:
- ✅ Dialogue text shows subtle chromatic aberration
- ✅ Text may flicker or distort based on rumor confidence
- ✅ Effect intensity correlates with paradoxDebt value
- ✅ No console errors

### Data Sources:
```typescript
// Truth Ripple uses these from WorldState:
- paradoxDebt: number (0-100+)
- beliefRegistry: BeliefEntry[] (rumor data)
- directorState: {distortionLevel, dissonance}

// Component: PerceptionGlitchOverlay
// Applies CSS transforms: chromatic-aberration, text-glitch
// Canvas shader: Creates visual distortion effect
```

---

## TEST 2: GOAL FLASHES (Personality Traits)

### What It Is:
Goal Flashes are colored visual indicators that appear during NPC dialogue based on their core personality traits. Each trait has a signature color that "flashes" when relevant.

### Personality Color Mapping:
```
GREED    → 🟡 Gold       (#FFD700)
PIETY    → ⚪ White      (#FFFFFF)
WRATH    → 🔴 Red        (#FF4444)
MERCY    → 💚 Green      (#44FF44)
KNOWLEDGE → 🟣 Purple    (#BB44FF)
AMBITION → 🔵 Blue       (#4488FF)
```

### Prerequisites:
- ✅ NPC with personality traits loaded
- ✅ Dialogue UI (EnhancedDialogPanel) visible
- ✅ `npcSocialAutonomyEngine` populating NPC traits

### Test Steps:

1. **Locate an NPC** with personality traits
2. **Start dialogue** to see NPCs' personality motivations
3. **Watch for colored flashes**:
   - Flash occurs when NPC personality aligns with dialogue topic
   - Example: GREED trait flashes when talking about treasure/wealth
4. **Verify personality badges** (if visible in UI):
   - Badge colors match the mapping above
   - Multiple personalities may show for complex NPCs
5. **Check component**:
   - Open DevTools Console
   - Search for personality trait data in NPC instance
   - Verify `getPersonalityTraits()` returns trait array

### Expected Results:
- ✅ Colored flashes appear during relevant dialogue topics
- ✅ Personality badges display with correct colors
- ✅ Multiple personalities shown for NPCs with complex traits
- ✅ Colors remain consistent across different NPCs
- ✅ No console errors

### Data Sources:
```typescript
// Goal Flashes use these from NPC:
- personalityTraits: { greed, piety, wrath, mercy, knowledge, ambition }
- disposition: number (affects which traits activate)
- reputation: number (affects dialogue approach)

// Components involved:
- EnhancedDialogPanel: Displays NPC traits
- NPC personality system: Determines trait strength
- Visual effects: CSS color overlays, canvas flashes
```

---

## TEST 3: SPATIAL MAPPING (ChronicleMap Rendering)

### What It Is:
Spatial Mapping is the 3D coordinate representation of world fragments on the ChronicleMap. Each discovered fragment appears at its absolute world coordinates, creating a visual map of traversable locations.

### Prerequisites:
- ✅ Game world loaded with multiple locations
- ✅ At least 3-5 locations discovered or visible
- ✅ ChronicleMap component available in UI

### Test Steps:

1. **Access ChronicleMap**:
   - Look for map button or "Chronicle" section in UI tabs
   - Or find ChronicleMap component in available panels
2. **Observe world fragments**:
   - Each location should appear as a marker/icon
   - Location should have name and coordinates visible
3. **Verify coordinate accuracy**:
   - Check X,Y coordinates match actual game world positions
   - Relative distances between markers should match game layout
   - Markers should form coherent world geography
4. **Test interactions** (if supported):
   - Click on marker → Verify location details appear
   - Zoom/pan → Verify coordinates scale correctly
   - Filter → Verify discovered/undiscovered distinction
5. **Check component**:
   - Open DevTools Console
   - Verify `worldFragments` array populated
   - Check `locations` array has proper coordinate data

### Expected Results:
- ✅ All discovered locations appear on map
- ✅ Coordinates are accurate (within game world scale)
- ✅ Markers positioned correctly relative to each other
- ✅ Map is interactive (clickable, zoomable if implemented)
- ✅ Undiscovered areas show as fog/unknown
- ✅ No console errors

### Data Sources:
```typescript
// Spatial Mapping uses these from WorldState:
- locations: Location[] ({id, name, x, y, z, discoveryChance})
- worldFragments: WorldFragment[] ({id, name, x, y, isDiscovered})
- player.currentLocationId: string (current position marker)

// Component: ChronicleMap
// Renders: SVG or Canvas with coordinate markers
// Coordinate system: Absolute world coordinates (0,0 = origin)
```

---

## COMPREHENSIVE VERIFICATION CHECKLIST

### Manual Testing Checklist:

**Truth Ripple**:
- [ ] Dialogue text shows chromatic aberration effect
- [ ] Effect intensity changes with paradoxDebt
- [ ] Text glitch appears for high-distortion rumors
- [ ] Console shows zero PerceptionGlitchOverlay errors
- [ ] Effect disabled when paradoxDebt = 0

**Goal Flashes**:
- [ ] Personality colors appear during dialogue
- [ ] Correct color for each personality type
- [ ] Multiple flashes for multi-trait NPCs
- [ ] Colors match the defined color mapping
- [ ] Console shows zero personality system errors
- [ ] Personality badges render correctly

**Spatial Mapping**:
- [ ] Map displays all discovered locations
- [ ] Location coordinates are accurate
- [ ] Discovered vs undiscovered distinction clear
- [ ] Map interactions work smoothly
- [ ] Console shows zero ChronicleMap errors
- [ ] Fog of war/unknown areas handled correctly

### Performance Checks During Testing:

- [ ] Frame rate stays at/near 60 FPS during effects
- [ ] No frame drops when effects trigger
- [ ] Smooth transitions between sensory states
- [ ] Browser responsive to user input
- [ ] No memory leaks (Monitor tab in DevTools)

### Console Health Check:

Open DevTools (F12) → Console tab:
- [ ] Zero React warnings
- [ ] Zero hydration mismatch errors
- [ ] Zero component render errors
- [ ] Warning count: 0 or minimal
- [ ] Error count: 0
- [ ] Messages only contain expected logging

---

## TROUBLESHOOTING GUIDE

### If Truth Ripple NOT showing:
1. Check `paradoxDebt` > 0 in WorldState
2. Verify `PerceptionGlitchOverlay` is imported in `EnhancedDialogPanel`
3. Check browser DevTools for CSS shader errors
4. Verify `beliefRegistry` is not empty
5. Check if glitch enabled flag is true

### If Goal Flashes NOT showing:
1. Verify NPC has personality traits assigned
2. Check `personalityTraits` object is not empty
3. Verify trait strength values > 0
4. Check `EnhancedDialogPanel` displays personality section
5. Verify NPC is interactable and dialogue initiates

### If Spatial Mapping NOT working:
1. Check `worldFragments` array is populated
2. Verify `locations` array has x,y coordinates
3. Check ChronicleMap component is mounted
4. Verify coordinates are numbers, not null/undefined
5. Check for exceptions in canvas/SVG rendering

---

## DATA FLOW VERIFICATION

### Truth Ripple Data Path:
```
WorldState.paradoxDebt 
  ↓
PerceptionGlitchOverlay.props.glitchIntensity
  ↓
CSS Shader (chromatic-aberration)
  ↓
Text rendering with distortion effect
```

### Goal Flashes Data Path:
```
NPC.getPersonalityTraits()
  ↓
EnhancedDialogPanel.displayPersonalityBadges()
  ↓
Color mapping (trait → color)
  ↓
Visual flash effect on canvas/CSS
```

### Spatial Mapping Data Path:
```
WorldState.locations
  ↓
ChronicleMap.renderLocations()
  ↓
Convert coordinates to screen space
  ↓
Render markers at (x,y) positions
  ↓
User sees map with location pins
```

---

## SUCCESS CRITERIA

All three sensory layers pass when:

✅ **Truth Ripple**
- Visual glitch effect visible during dialogue
- Effect intensity correlates with game state (paradoxDebt)
- No console errors

✅ **Goal Flashes**  
- Personality colors visible during NPC interactions
- Colors match defined schema
- Multiple traits display for complex personalities

✅ **Spatial Mapping**
- Map shows all discovered locations
- Coordinates are accurate and consistent
- Interactive map responds to user actions

✅ **Overall**
- 60 FPS performance maintained
- Zero React hydration errors
- Zero component render errors
- Clean, responsive UI

---

## PERFORMANCE TARGETS

- **Frame Rate**: 60 FPS (target), 30 FPS minimum acceptable
- **Initial Load**: < 5 seconds to interactive
- **Sensory Effect Latency**: < 100ms for visual response
- **Map Render Time**: < 500ms for full map draw

---

## POST-TESTING DOCUMENTATION

After completing manual tests, document:
1. Which sensory layers passed ✅
2. Which layers had minor issues ⚠️
3. Which layers failed ❌
4. Performance metrics measured
5. Console error summary
6. Screenshots of each layer (if possible)
7. Overall assessment for M48-A5 completion

---

*This testing guide is part of M48-A5: Production Stability & Sensory Verification*  
*Use in conjunction with manual browser testing at http://localhost:3000*
