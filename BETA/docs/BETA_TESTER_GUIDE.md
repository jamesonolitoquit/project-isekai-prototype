# Project Isekai V2: Beta Tester Guide
## A Complete Guide to Testing the 10,000-Year Simulation

**Version**: 1.0  
**Status**: BETA READINESS MILESTONE  
**Last Updated**: Phase 28+ Production Infrastructure  

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Testing the Persistent Multiverse](#testing-the-persistent-multiverse)
3. [Discovering Epic Conclusions](#discovering-epic-conclusions)
4. [Validating Community Patches](#validating-community-patches)
5. [Understanding Paradox Bleed](#understanding-paradox-bleed)
6. [Known Limitations](#known-limitations)
7. [Reporting Bugs](#reporting-bugs)

---

## Quick Start

### Prerequisites

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Configure PostgreSQL and Redis

# Run database setup
npx ts-node scripts/deploy-genesis.ts --auto-advance true

# Start development server
npm run dev

# Verify systems are online
curl http://localhost:3000/health
curl http://localhost:3001/health
```

### First Test Session (5 minutes)

1. **Initialize World-0**: Run `deploy-genesis.ts` to create your first persistent world
2. **Observe Seasonal Cycles**: Play through winter → spring → summer → autumn (4 in-game years)
3. **Check Weaver API**: Visit `http://localhost:3001/api/weaver/globalMetrics` to see world stats
4. **Note Paradox Level**: Look for paradox-induced visual tints (#1a0a2e) at >50% global paradox

---

## Testing the Persistent Multiverse

### 1. World Instance Creation

**Goal**: Verify persistence layer saves world state correctly

```bash
# Create World-0 from template
npx ts-node scripts/deploy-genesis.ts \
  --name "World-0" \
  --template luxfier-world.json \
  --auto-advance true \
  --monitor-paradox true

# Output should show:
# ✅ Step 1: Database initialization
# ✅ Step 2: Template loading (Luxfier World)
# ✅ Step 3: World state initialization
# ✅ Step 4: Hard facts registration (immutable anchors)
# ✅ Step 5: Auto-advance simulation (1000 ticks)
# ✅ Step 6: Genesis summary
```

**What to verify**:
- [ ] World created with unique ID
- [ ] Hard facts are immutable (cannot be modified)
- [ ] Tick counter advances 1000 times
- [ ] Paradox metrics initialized to 0

### 2. Redis Cache Performance

**Goal**: Confirm <15ms latency for active world access

```bash
# Monitor cache performance
npm test -- scripts/persistence-load-test.ts --watch

# Expected latency:
# - Redis GET: <5ms (cache hit)
# - Redis SET: <10ms (cache write)
# - Postgres cold boot: <100ms
# - World state save: <50ms
```

**What to verify**:
- [ ] All latency tests pass
- [ ] No timeout errors after 5000 iterations
- [ ] Memory usage stays <100MB
- [ ] Cache hitrate >95% after warmup

### 3. Database Persistence Across Restarts

**Goal**: Verify world state persists when server restarts

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Play for 5 in-game minutes
# (press spacebar to advance ticks)

# Terminal 1: Stop server (Ctrl+C)

# Terminal 1: Restart server
npm run dev

# Terminal 2: Verify world state is identical
# - Same tick counter
# - Same NPC positions
# - Same paradox level
```

**What to verify**:
- [ ] Tick counter resumes from saved value
- [ ] NPC state is preserved
- [ ] Seasonal modifiers still active
- [ ] No data corruption

### 4. Seasonal Modifiers Across Seasons

**Goal**: Verify seasonal effects apply consistently

**Spring (Ticks 0-25,000)**:
- [ ] MP recovery: 33 per tick (base 12 × 1.3 multiplier × 1.06 seasonal bonus)
- [ ] Plant loot tables: 60% chance for berries/seeds
- [ ] Visual palette: Green/gold (#2d5016 primary)

**Summer (Ticks 25,000-50,000)**:
- [ ] Attack damage: 1.2× multiplier active
- [ ] Fire damage: +50% effectiveness
- [ ] Loot: Sunstones drop frequently

**Autumn (Ticks 50,000-75,000)**:
- [ ] XP gain: 1.15× multiplier
- [ ] Harvest events: Trigger regularly
- [ ] Loot: Grains/seeds abundant

**Winter (Ticks 75,000-100,000)**:
- [ ] Cold terrain damage: +25% to ice
- [ ] Void-wastes berries: 20% drop rate (vs 10% other seasons)
- [ ] Visual: Deep blue palette (#1a0a2e tint)

**Test Command**:
```bash
# Jump to winter in Luxfier World-0
curl -X POST http://localhost:3000/api/engine/setTick \
  -H "Content-Type: application/json" \
  -d '{"worldId":"World-0", "tick":75000}'

# Verify winter modifiers active
curl http://localhost:3001/api/weaver/timeline/World-0?fromTick=75000&toTick=75001
```

---

## Discovering Epic Conclusions

### Understanding the 4 Victory Conditions

The game ends when ONE of these conditions triggers:

| Condition | Trigger | Timeline | Reward |
|-----------|---------|----------|--------|
| **Temporal Apex** | 10,000 years (100,000 ticks) | Can achieve immediately | "Chronarch" title + eternal observer class |
| **Paradox Cascade** | Global paradox >90% | Rare (need many rule changes) | "Paradox Sovereign" title + paradox mastery |
| **Bloodline Convergence** | Ancestral traces collapse | Requires deep genealogy | "Progenitor Ascendant" + lineage unlocks |
| **Weaver Revelation** | Complete narrative quest chain | Story-based conclusion | "Weaver's Successor" + new game+ mode |

### Testing Temporal Apex (Easiest)

**Goal**: Play through the full 10,000 years

```bash
# Initialize with auto-advance
npx ts-node scripts/deploy-genesis.ts \
  --auto-advance true \
  --monitor-paradox true

# Watch the logs for conclusion trigger:
# [EPIC CONCLUSION] Temporal Apex triggered at tick 100,001
# Rewards: title="Chronarch", unlocks=["eternal_observer_class"]

# Navigate to game
# You should see the epic conclusion cutscene
```

**Estimated Time**: 5-10 minutes (auto-advance runs 100 ticks per second)

**What to verify**:
- [ ] Game plays through all 10,000 years
- [ ] Seasonal cycles complete (40 full seasons)
- [ ] Paradox level evolves naturally
- [ ] Epic conclusion triggers at exactly tick 100,001
- [ ] Player receives title reward

### Testing Paradox Cascade (Challenging)

**Goal**: Accumulate paradox to >90% through patch application

```bash
# Create high-paradox patch
cat > extreme-patch.json << 'EOF'
{
  "id": "paradox-test-001",
  "version": "1.0",
  "description": "Test high paradox conditions",
  "injectedRules": {
    "combatFormulas": {
      "critMultiplier": 35,
      "damageScaleFactor": 11
    }
  }
}
EOF

# Validate patch
npx ts-node scripts/validate-patch.ts extreme-patch.json

# Apply patch (if valid)
curl -X POST http://localhost:3000/api/engine/applyPatch \
  -H "Content-Type: application/json" \
  -d @extreme-patch.json

# Monitor paradox level
while true; do
  curl http://localhost:3001/api/weaver/globalMetrics | jq '.globalParadox'
  sleep 1
done

# Watch for conclusion trigger when > 90
```

**Time to Victory**: 30-60 seconds after patch application

### Testing Narrative Conclusions (Story-Based)

**Goal**: Complete all narrative quest chains

```bash
# Check available narrative quests
curl http://localhost:3001/api/weaver/worlds/World-0 | jq '.narativeConclusions'

# Available quests:
# 1. "The Weaver's Origin" - Talk to Weaver NPC
# 2. "Bloodline Secrets" - Trace genealogy to origin
# 3. "Paradox Understanding" - Collect 5 paradox artifacts
# 4. "Final Revelation" - Complete all 3 above

# In-game: Visit Weaver location and complete dialogs
# Watch for quest completion events in mutation log

# Check progress
curl http://localhost:3001/api/weaver/mutations/World-0?type=narrative_complete
```

---

## Validating Community Patches

### What is a Patch?

A patch is a JSON file describing modifications to the world template:
- New seasons or seasonal modifiers
- Combat formula adjustments (within 10x variance rule)
- Custom macro events (faction collapse, natural disasters)
- Custom loot tables

### Running the Patch Validator

```bash
# Validate a community patch
npx ts-node scripts/validate-patch.ts community-patch.json

# With base template comparison
npx ts-node scripts/validate-patch.ts community-patch.json \
  --base luxfier-world.json

# Output example:
# ✅ VALID - community-patch.json
# 📊 VALIDATION SCORE: 95/100
#
# ✔️  CHECKS:
# ✅ Required Fields - All required fields present
# ✅ Paradox Risk Assessment - No extreme balance changes
# ⚠️  Narrative Consistency - Warnings: Invalid color format...
# ✅ Hard Facts Protection - No immutable modification conflicts
# ✅ Patch Complexity - Complexity score: 45
```

### Common Validation Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `critMultiplier 50x exceeds limit` | Damage too high | Reduce to ≤35x |
| `Invalid color format in summer palette` | Wrong hex code | Use #RRGGBB format |
| `Unknown seasons: midseason` | Typo in season name | Use: winter/spring/summer/autumn |
| `Attempting to modify immutable hard facts` | Trying to rewrite history | Remove epic soul events |

### Creating Your Own Patch

**Template**:
```json
{
  "id": "my-patch-001",
  "version": "1.0",
  "description": "Winter berries abundance boost",
  "namespace": "my-mods",
  "seasonalRules": {
    "winter": {
      "mechanicalModifiers": {
        "lootTableOverride": {
          "void-wastes": {
            "berries": 0.4
          }
        }
      },
      "visualPalette": {
        "primary": "#1a0a2e",
        "secondary": "#16213e"
      }
    }
  }
}
```

**Validation Rules**:
- ✅ Keep damage scaling within 10x of base
- ✅ Use valid color hex codes (#RRGGBB)
- ✅ Never modify `epicSoulEvents` (hard facts immutable)
- ✅ Keep complexity score <100
- ✅ Don't override more than 3 seasonal attributes
- ❌ Cannot exceed 10x power scaling in any formula
- ❌ Cannot add new seasons (only modify existing 4)
- ❌ Cannot delete canonical events

---

## Understanding Paradox Bleed

### What is Paradox?

**Paradox** measures rule-breaking and narrative inconsistency in the simulation:
- Range: 0% (perfectly consistent) to 100% (total chaos)
- Increases when patches conflict with hard facts
- Increases with each extreme balance change
- Visualized as purple tint overlay (#1a0a2e) at >50%

### Real-Time Monitoring

```bash
# Check current global paradox
curl http://localhost:3001/api/weaver/globalMetrics | jq '.globalParadox'

# Watch paradox history over time
curl 'http://localhost:3001/api/weaver/paradoxHistory/World-0?fromTick=0&toTick=100000' \
  | jq '.paradoxTimeline'
```

### Interpreting Paradox Levels

| Level | Effect | Visual | Example |
|-------|--------|--------|---------|
| 0-25% | Minimal instability | Normal colors | Single small patch applied |
| 25-50% | Noticeable glitches | Slight purple tint | Multiple patches, small conflicts |
| 50-75% | Visible paradox bleed | #4a3b5c tint (30% opacity) | Many conflicting patches |
| 75-90% | World destabilizing | #1a0a2e tint (50% opacity) | Extreme rule changes |
| >90% | Paradox Cascade triggers | Full tint (100% opacity) | Game ending condition |

### Testing Paradox Visualization

```bash
# Force high paradox for testing
curl -X POST http://localhost:3000/api/engine/setParadox \
  -H "Content-Type: application/json" \
  -d '{"worldId":"World-0", "level":75}'

# In-game: You should see purple overlay
# Navigate to world view - colors should shift toward #1a0a2e

# Reset paradox
curl -X POST http://localhost:3000/api/engine/setParadox \
  -H "Content-Type: application/json" \
  -d '{"worldId":"World-0", "level":0}'
```

---

## Known Limitations

### Current Phase 28 Limitations

| Feature | Status | Workaround |
|---------|--------|-----------|
| Multiple worlds | Partial | Only World-0 tested (others in theory) |
| WebSocket real-time | Planned | Use polling (5 sec intervals) |
| Frontend integration | In progress | CLI/API only for now |
| Player save/load | Partial | Manual world snapshots only |
| NPC AI expansion | Planned | Simple state machine for alphas |
| Mobile UI | Not started | Desktop browsers only |

### Server Stability

- **Crash on paradox >100%**: Restart with `deploy-genesis.ts --monitor-paradox true`
- **Memory leak after 24h**: Restart server daily (Redis auto-cleanup runs)
- **Slow queries >1m**: Hit DB query limit, restart PostgreSQL

### Performance

| Operation | Latency | Note |
|-----------|---------|------|
| World tick advancement | <50ms | <100ms acceptable |
| Patch application | 200-500ms | May stutter UI |
| Calculate conclusion | <20ms | Background check |
| History query 1000 ticks | 50-100ms | Within budget |

---

## Reporting Bugs

### Bug Report Template

```markdown
## Summary
[One-line description]

## Reproduction Steps
1. [First step]
2. [Second step]
3. [Observed behavior]

## Expected Behavior
[What should happen]

## Environment
- World ID: World-0
- Tick: 50,000
- Patch applied: [if applicable]
- Paradox level: 35%
- Server log: [last 10 lines of output]

## Severity
[ ] Critical (game crash)
[ ] High (major feature broken)
[ ] Medium (feature partially broken)
[ ] Low (cosmetic issue)
```

### Where to Report

1. **Critical Issues**: `issues/critical/` folder with full logs
2. **Patch Conflicts**: `validate-patch.ts` output + paradox level at time
3. **Performance**: Server logs + `persistence-load-test.ts` results
4. **Narrative Bugs**: Mutation log export + NPC state snapshot

### Example Bug Report

```markdown
## Summary
Void-wastes berries not dropping in winter despite 40% loot table

## Reproduction Steps
1. Deploy World-0 with `deploy-genesis.ts`
2. Jump to winter (tick 75,000)
3. Kill 100 void-wastes enemies
4. Observe: 0 berries dropped (expected 40)

## Expected Behavior
40 berries should drop (40% * 100 kills)

## Environment
- World ID: World-0
- Tick: 75,050
- Patch applied: none
- Paradox level: 0%

## Server Log
[WORLD] Void-wastes death event triggered (tick 75,050)
[ACTION] LOOT calculation: lootTableLookup(void-wastes, winter)
[ACTION] Result: empty array (should be [berries])
```

---

## Testing Checklist

Use this to verify system readiness for each phase:

### Phase 27: Persistence Layer ✅
- [ ] Red Redis cache <5ms GET latency
- [ ] PostgreSQL persistence verified
- [ ] Hard facts immutability confirmed
- [ ] Global paradox averaging working
- [ ] Paradox tint visual override active at >50%

### Phase 28: Production Infrastructure (Current)
- [ ] Genesis deployment script runs successfully
- [ ] Epic Conclusion engine monitors all 4 conditions
- [ ] Weaver API returns correct historical data
- [ ] Patch validator rejects paradox-breaking rules
- [ ] All endpoints respond <200ms

### Phase 29: Content Expansion (Next)
- [ ] Custom seasonal rules inject correctly
- [ ] New NPC factions spawn properly
- [ ] Bloodline genealogy tracks through 100 generations
- [ ] Macro events trigger at expected rates

---

## Support

**Need help?**

1. Check latest logs: `tail -f server.log`
2. Validate patch: `npx ts-node scripts/validate-patch.ts <patch>`
3. Query world state: `curl http://localhost:3001/api/weaver/worlds`
4. Review errors: `npm run build 2>&1 | grep error`

**Community**:
- Discord: [coming soon]
- Wiki: [coming soon]
- Issue tracker: GitHub Issues

---

**Happy testing! 🎮**

Your feedback shapes the final 10,000 years of Luxfier World-0.

*Last updated: Phase 28+ Production Infrastructure*
*Next: Phase 29 Content Expansion (Custom Seasons & Factions)*
