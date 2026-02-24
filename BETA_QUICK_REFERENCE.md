# BETA Quick Reference - Commands

## Pre-Requisites Verification

```bash
# Verify Node.js
node --version          # Should be v22+

# Verify npm
npm --version           # Should be v11+

# Verify PostgreSQL
psql --version          # Should show PostgreSQL version

# Verify Redis
redis-cli ping          # Should return: PONG
```

---

## Phase 2: Game Logic Verification (No Services Needed)

```bash
cd BETA

# Economic Systems Test
npm run stress-test

# Multi-Generation Test  
npm run millennium
```

**Expected Results**:
- `errorCount: 0`
- `completedSuccessfully: true`
- Memory < 100MB peak

---

## Phase 4: Full Stack Launch

```bash
# Terminal 1: Start API Server
cd BETA
npm run server:dev

# Terminal 2: Start React UI
cd BETA
npm run dev

# Terminal 3: Health Check
curl http://localhost:5000/api/health

# Browser
open http://localhost:3000
```

---

## Service Management

### PostgreSQL

```powershell
# Check if running
Get-Service PostgreSQL*

# Start
Start-Service -Name PostgreSQL14

# Stop
Stop-Service -Name PostgreSQL14

# Connect
psql -U isekai -d isekai -h localhost
```

### Redis

```powershell
# Start Redis
redis-server.exe

# Or if service
Start-Service -Name Redis

# Test
redis-cli ping
```

---

## Logs & Debugging

```bash
# View API Server logs (running in terminal)
# All console.log output appears here

# View React UI debug console
# Browser F12 → Console tab
# Look for: "Socket connected: ..."

# API Response
curl http://localhost:5000/api/game/state

# Check database
psql -U isekai -d isekai
SELECT COUNT(*) FROM players;
```

---

## Common Issues

| Error | Fix |
|-------|-----|
| PORT 5000 IN USE | `taskkill /PID <pid> /F` or change PORT in .env |
| PSQL CONNECTION FAILED | `psql -U isekai -d isekai` to test |
| REDIS CONNECTION FAILED | `redis-cli ping` to test |
| MODULE NOT FOUND | `npm install` in BETA/ |
| WEBSOCKET FAILED | Check DevTools Network → WS connection |

---

## Testing Checklist

```
Simulations:
  [ ] npm run stress-test → passed
  [ ] npm run millennium → passed

Services:
  [ ] PostgreSQL running (port 5432)
  [ ] Redis running (port 6379)

Application:
  [ ] npm run server:dev → ✅ Server running
  [ ] curl /api/health → status: "healthy"
  [ ] npm run dev → ✅ Ready on localhost:3000
  [ ] Browser → WebSocket connected

Cleanup:
  [ ] Phantom exports fixed (chronicleEngine.ts)
  [ ] AJV validation enabled (worldEngine.ts)
```

---

## Environment Variables Quick Ref

| Variable | Value | Purpose |
|----------|-------|---------|
| `DATABASE_URL` | `postgresql://isekai:isekai_beta_password@localhost:5432/isekai` | World data |
| `REDIS_URL` | `redis://localhost:6379` | Cache & multiplayer |
| `PORT` | `5000` | API server port |
| `CORS_ORIGIN` | `http://localhost:3000` | UI origin |
| `NODE_ENV` | `development` | Logging level |

---

## Deployment Preparation

Once all tests pass:

```bash
# Production build
npm run build

# Final test
npm run dev

# Create git commit
git add -A
git commit -m "Ready for Railway deployment"

# Push to GitHub
git push origin main
```

---

**Last Updated**: 2026-02-24  
**Setup Guide**: `BETA_RUNTIME_SETUP_GUIDE.md`
