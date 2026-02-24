#!/env ts-node

# Phase 4: Local Development Mode - Quick Start

## Current Status ✅

Your BETA environment is **ready to run** without database dependencies:

- ✅ Game engine: Production-ready (25 epochs tested)
- ✅ API server: Compiled and ready
- ✅ React UI: Built and ready  
- ✅ TypeScript: Zero compilation errors
- ✅ Socket.IO: Preconfigured for real-time

## What You Can Test NOW (Without PostgreSQL)

✅ Full game engine simulation  
✅ Real-time UI updates via Socket.IO  
✅ Faction dynamics and epoch transitions  
✅ NPC behavior and world state  
✅ All in-game systems (trades, quests, rituals, combat)  

## What Requires PostgreSQL (For Later)

🔲 Player progress persistence  
🔲 Save/load game states  
🔲 Multiplayer data sync  
🔲 Long-term storage  

---

## Quick Start: Test Everything NOW

### Open 2 Terminal Windows

#### Terminal 1: Start the Backend
```bash
cd c:\Users\Jaoce\OneDrive\Documents\GitHub\project-isekai-v2\BETA
npm run server:dev
```

**Expected Output:**
```
✅ Server running on http://localhost:5000
⚠️  PostgreSQL connection failed (continuing without persistence)
⚠️  Redis not available (in-memory cache only)
📡 Socket.IO ready
```

#### Terminal 2: Start the Frontend
```bash
cd c:\Users\Jaoce\OneDrive\Documents\GitHub\project-isekai-v2\BETA
npm run dev
```

**Expected Output:**
```
> next dev
- ready on http://localhost:3000
```

### Test in Browser

1. Open: **http://localhost:3000**
2. Watch for this in Console (DevTools F12):
   ```
   📡 Socket connected: [connection-id]
   ```
3. Navigate to game interface
4. Verify that game updates happen in real-time

---

## Detailed Launch Guide

### Step 1: Start Backend Server

```powershell
cd BETA
npm run server:dev
```

The server will start on **port 5000** and attempt to connect to:
- PostgreSQL: If not running, continues anyway
- Redis: If not running, continues anyway
- Socket.IO: Fully functional

**You're looking for these lines:**
```
🔌 Server started: http://localhost:5000
✅ Socket.IO ready for connections
```

### Step 2: Start Frontend UI

In a new terminal:

```powershell
cd BETA
npm run dev
```

Next.js will compile and start on **port 3000**.

**You're looking for:**
```
- ready on http://localhost:3000
```

### Step 3: Open Browser

Navigate to: `http://localhost:3000`

**Browser Console (F12) should show:**
```
[Next.js or React console messages]
📡 Socket connection established
```

### Step 4: Test Core Functionality

1. **Verify Socket.IO connection:**
   - Open DevTools Network tab
   - Look for `localhost:5000/socket.io/...`
   - Should see WebSocket or long-polling connection

2. **Trigger game actions:**
   - Click through the UI
   - Watch for real-time updates from the backend
   - Verify no JavaScript errors in console

3. **Check game engine status:**
   - Backend terminal should log simulation ticks
   - UI should reflect world state changes

---

## Troubleshooting

### Issue: "Socket.IO failed to connect"
**Solution:** 
- Verify backend is running on port 5000
- Check no firewall is blocking port 5000
- Restart both frontend and backend

### Issue: "Cannot connect to database" errors
**Solution:** 
- This is expected and safe if PostgreSQL isn't running
- Game engine will work in memory
- Data won't persist between restarts

### Issue: UI shows blank page
**Solution:**
- Check browser console for errors (F12)
- Verify backend is running (`npm run server:dev`)
- Clear browser cache: Ctrl+Shift+Delete
- Restart both services

---

## What's Running Without Database

✅ **Game Engine** (M69/M70)
- All faction dynamics
- All NPC behaviors
- All quest/ritual/combat systems
- All world evolution
- All epoch transitions

✅ **Live Updates**  
- Real-time Socket.IO transport
- Live UI state synchronization
- Instant action feedback

✅ **API Endpoints**
- `/api/health` - Server status
- `/api/world/state` - Current game state
- Socket events: world state updates

---

## For Later: PostgreSQL Setup

Once you're ready to add persistence (after testing):

```bash
# Windows + WSL2:
wsl -d Ubuntu -- bash
sudo apt-get install postgresql redis-server
sudo service postgresql start
npm run setup-db

# macOS:
brew install postgresql redis
brew services start postgresql
brew services start redis
npm run setup-db

# Windows (native):
# Download from https://www.postgresql.org/download/windows/
# Then: npm run setup-db
```

---

## Command Reference

```bash
# Game Simulations (Test engine integrity)
npm run stress-test        # 1000 ticks stress test
npm run millennium         # 25-epoch simulation

# Services (Run in separate terminals)
npm run server:dev         # Backend on :5000
npm run dev                # Frontend on :3000

# Database (When ready)
npm run setup-db           # Initialize PostgreSQL schema
npm run dev-mode           # Check service readiness

# Build & Test
npm run build              # Production build
npm run test               # Run Jest tests
npm run test:coverage      # Coverage report
```

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│      Browser (localhost:3000)       │
│        ┌──────────────────┐         │
│        │   React UI       │         │
│        │   Components     │         │
│        └────────┬─────────┘         │
└─────────────────┼───────────────────┘
                  │
            WebSocket / HTTP
            (Socket.IO)
                  │
┌─────────────────▼───────────────────┐
│  Express Server (localhost:5000)    │
│  ┌──────────────────────────────┐   │
│  │  Socket.IO Handler           │   │
│  ├──────────────────────────────┤   │
│  │  Game Engine / State Manager │   │
│  │  (M69/M70 systems)           │   │
│  ├──────────────────────────────┤   │
│  │  API Routes                  │   │
│  └──────────┬───────────────────┘   │
│             │                        │
│      ┌──────┴──────┬──────────┐     │
│      │             │          │     │
│   [PG]         [Redis]    [In-Memory] 
│ OPTIONAL       OPTIONAL    Cache ✅
│                                     │
└─────────────────────────────────────┘
```

---

## Current Phase Status

| Component | Status | Ready? |
|-----------|--------|--------|
| Game Engine | ✅ Tested with 25 epochs | YES |
| Backend Server | ✅ Built, no errors | YES |
| Frontend UI | ✅ Built, no errors | YES |
| Socket.IO | ✅ Configured | YES |
| PostgreSQL | ⏳ Installation needed | NO* |
| Redis | ⏳ Installation needed | NO* |

*Not required for local testing. Optional for persistence.

---

## Next Steps

1. ✅ **NOW**: Run `npm run server:dev` + `npm run dev`
2. ✅ **NOW**: Test UI + core game systems
3. 🔲 **Later**: Install PostgreSQL (if needed)
4. 🔲 **Later**: Run `npm run setup-db`
5. 🔲 **Later**: Deploy to Railway

---

## Support Commands

```bash
# Check service availability
npm run dev-mode

# Verify game engine works
npm run stress-test

# Test 25-epoch run
npm run millennium

# Rebuild everything
npm run build

# Clean and rebuild
rm -r .next && npm run build
```

---

## Key Links

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:5000
- **API Health**: http://localhost:5000/api/health
- **Socket.IO**: ws://localhost:5000/socket.io

---

**You're all set! Launch the services and test the game. 🎮**
