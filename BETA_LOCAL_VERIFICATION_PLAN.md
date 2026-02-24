# BETA Local Runtime Verification & Logic Troubleshooting

## Current Status
- ✅ BETA builds successfully (`npm run build`)
- ✅ Dependencies installed (599 packages)
- ❌ **Server is a stub** (src/server/index.ts only logs, no Express)
- ❌ **Phantom exports** (chronicleEngine imports non-existent functions from factionEngine)
- ❌ **AJV validation disabled** (worldEngine.ts schema validation commented out)
- ❌ **Atomic trade engine is stub** (atomicTradeEngine.ts returns `{ success: true }` for all operations)

## Critical Issues to Fix

### Issue 1: Server Stub (HIGH PRIORITY)
**File**: `BETA/src/server/index.ts`
**Current State**: Only contains:
```typescript
export function startServer() {
  console.log('[server] Stub: startServer called');
}
```
**Required**: Complete Express + Socket.IO server with:
- `/api/health` endpoint for health checks
- Socket.IO connection handling
- Database connection pool
- Redis connection
- Middleware setup (CORS, auth, etc.)
**Impact**: Cannot run `npm run dev` or deploy without this

### Issue 2: Phantom Exports from factionEngine (MEDIUM PRIORITY)
**File**: `BETA/src/engine/chronicleEngine.ts` (lines 12-13)
**Current State**: Commented-out imports with note:
```typescript
// import { evolveFactionGeneology, redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
// import { redistributeExtinctTerritories, isNpcFromExtinctFaction } from './factionEngine'; // [M48-A4: Functions not exported]
```
**Missing Functions**:
- `evolveFactionGeneology` - Generational faction evolution across epochs
- `redistributeExtinctTerritories` - Redistribute territories when factions fall
- `isNpcFromExtinctFaction` - Check if NPC belongs to extinct faction

**Fix Options**:
1. Implement the three missing functions in factionEngine.ts
2. OR: Remove these imports and verify chronicleEngine doesn't need them
**Impact**: Blocking epoch transitions and legacy systems (Phase 12-13)

### Issue 3: AJV Schema Validation (LOW PRIORITY FOR DEV)
**File**: `BETA/src/engine/worldEngine.ts` (lines 37-45)
**Current State**: Validation code commented out
```typescript
// const Ajv = require('ajv');
// const ajv = new Ajv({ allErrors: true, strict: false });
// const schema = schemaJson;
// const validate = ajv.compile(schema);
// valid = validate(maybe);
```
**Impact**: World template validation skipped but doesn't block development
**Fix**: Un-comment when ready for strict schema enforcement

### Issue 4: Atomic Trade Engine (MINOR)
**File**: `BETA/src/engine/atomicTradeEngine.ts`
**Current State**: All functions return `{ success: true }` or minimal stubs
```typescript
export const respondToTrade = (trade, responderId, accepted, inventory) => 
  ({ success: true, error: undefined });
```
**Impact**: Trade transactions not actually validated; only mocked
**When to Fix**: Before M48-A4 trade mechanics testing

## Setup Instructions for Local Verification

### Prerequisites
1. PostgreSQL 16 running on `localhost:5432`
2. Redis 7 running on `localhost:6379`  
3. Node.js 22+ with npm 11+

### Step 1: Configure Environment
```bash
cd BETA
cp .env.example .env
```
Edit `.env` to point to your local services:
```dotenv
DATABASE_URL=postgresql://isekai:isekai_beta_password@localhost:5432/isekai
REDIS_URL=redis://localhost:6379
NODE_ENV=development
PORT=5000
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Run Stress Test (Before Fixing Server)
```bash
npm run stress-test
```
This tests core economic systems without needing the server:
- Rumor distortion logic
- NPC trades
- Scarcity-based pricing
- Memory stability under 1000+ ticks

**Expected Output**:
```json
{
  "totalTicks": 1000,
  "tradeExecutions": 150,
  "maxMemoryUsageMB": 45.3,
  "errorCount": 0,
  "completedSuccessfully": true
}
```

### Step 4: Run Ten-Thousand-Year Simulation (Multi-Gen Test)
```bash
npm run millennium
```
Tests Phase 12-13 systems:
- Multi-generational legacy transmission
- Temporal paradox tracking
- Memory stability (should be < 100MB peak)

**Expected Output**:
```json
{
  "totalEpochs": 25,
  "completedSuccessfully": true,
  "memoryProfile": {
    "peakMB": 65.2,
    "averageMB": 52.1,
    "finalMB": 42.1
  },
  "phase13ValidationPassed": true
}
```

### Step 5: Start Dev Server (After Fixing Server Stub)
```bash
npm run dev
```
Expected output:
```
✅ Server running on http://localhost:5000
✅ Socket.IO connected to Redis adapter
✅ UI available on http://localhost:3000
```

## Implementation Priority

### PHASE 1: Critical (Blocks All Development)
**Status**: ⏳ NOT STARTED

**Task 1.1**: Implement `startServer()` in `BETA/src/server/index.ts`
- Create Express app with proper middleware
- Setup Socket.IO with Redis adapter
- Add `/api/health`, `/api/auth/login`, `/api/auth/signup` endpoints
- Connect to PostgreSQL and Redis
- Return fully functional server

**Task 1.2**: Test `npm run dev` runs without errors
- Server should start on port 5000
- UI should load on port 3000
- Socket.IO should establish connection

### PHASE 2: Important (Blocks Simulations)
**Status**: ⏳ NOT STARTED

**Task 2.1**: Fix Phantom Exports in factionEngine.ts
- Decision: Implement or remove?
- If implement: Add `evolveFactionGeneology`, `redistributeExtinctTerritories`, `isNpcFromExtinctFaction`
- If remove: Clean up chronicleEngine.ts imports
- Verify chronicle transitions work

**Task 2.2**: Verify Simulations Pass
- Run `npm run stress-test` → confirms no errors, memory OK
- Run `npm run millennium` → confirms multi-gen logic works

### PHASE 3: Validation (Nice-to-Have)
**Status**: ⏳ NOT STARTED

**Task 3.1**: Enable AJV Schema Validation
- Un-comment validation code in worldEngine.ts
- Test against luxfier-world.json schema
- Verify template loads correctly

## Testing Checkpoints

### ✅ Checkpoint 1: Build Verification
```bash
npm run build
```
Expected: `.next` folder created, no TypeScript errors

### ✅ Checkpoint 2: Stress Test Success
```bash
npm run stress-test
```
Expected: JSON output with `errorCount: 0`

### ✅ Checkpoint 3: Millennium Sim Success
```bash
npm run millennium
```
Expected: `completedSuccessfully: true`, memory < 100MB peak

### ⏳ Checkpoint 4: Server Startup (PENDING)
```bash
npm run dev
```
Expected: Server on 5000, UI on 3000, no console errors

## Known Limitations

### Safe to Leave As-Is
- **atomicTradeEngine.ts** – All stubs, returns `{ success: true }`
  - Only used in M48-A4 trade module
  - Can mock trades without implementation for now

- **directorCommandEngine.ts** – Commented mutation logging
  - Logic still works, just incomplete logging
  - Not critical for core functionality

- **AJV Validation** – Commented out in worldEngine.ts
  - World template loads even without schema validation
  - Can un-comment when strict validation required

## Key Decisions

### Why Avoid Docker for Local Dev
- Reduces RAM overhead (no container orchestration)
- Faster iteration cycles (direct service access)
- Easier debugging (direct logs, memory profiling)

### Why Prioritize Simulations Over UI
- Catch deep logic issues (paradox accumulation, memory leaks) that only appear after long-term gameplay
- Simulations catch issues before UI testing (faster feedback loop)
- Stress test + millennium sim give early warning of engine issues

### Why Leave atomicTradeEngine Stubbed
- Trade mechanic (M48-A4) not needed for core loop validation
- Mocking with `{ success: true }` sufficient for epoch transitions
- Can implement fully when reaching M48-A4 testing phase

## Next Immediate Steps

1. **Read** this plan
2. **Implement** server stub (HIGH PRIORITY)
3. **Test** with `npm run stress-test`
4. **Run** `npm run millennium` 
5. **Verify** with `npm run dev` and load UI
6. **Debug** any failures with engine logic fixes

---

**Status**: 🔴 Setup Required  
**Last Updated**: 2026-02-24  
**Owner**: BETA Local Development