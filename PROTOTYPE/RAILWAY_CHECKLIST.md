# Railway Deployment Checklist

## Pre-Deployment (Local)

- [ ] **Tests Passing**: `npm test` outputs 5/5 passing
- [ ] **Type Checking**: `npx tsc --noEmit` shows 0 errors
- [ ] **Build Successful**: `npm run build` completes without errors
- [ ] **No Console Errors**: `npm run dev` runs clean
- [ ] **.gitignore Updated**: Comprehensive rules in place
- [ ] **.env.local Exists**: Template variables configured locally
- [ ] **Not in Git**: `.env.local` NOT tracked (verify `git ls-files | grep env`)
- [ ] **Dependencies Complete**: `npm list` shows all packages
- [ ] **Node Modules Clean**: No uncommitted changes in package.json

## Code Quality

- [ ] **Security Audit**: `npm audit` shows 0 vulnerabilities
- [ ] **Linting**: `npm run lint` shows 0 issues (if configured)
- [ ] **Formatting**: Code follows project style
- [ ] **Dead Code Removed**: No commented-out code blocks
- [ ] **Comments Added**: Complex logic documented
- [ ] **README Updated**: Reflects current system state
- [ ] **API Documented**: docs/API.md is complete
- [ ] **Architecture Clear**: docs/ARCHITECTURE.md explains design

## Files & Structure

- [ ] ✅ **docs/DEPLOYMENT.md**: Railway setup guide created
- [ ] ✅ **docs/API.md**: API reference complete
- [ ] ✅ **docs/ARCHITECTURE.md**: System design documented
- [ ] ✅ **.env.example**: Template for local development
- [ ] ✅ **.env.example.production**: Template for Railway
- [ ] ✅ **build-clean.sh**: Build script ready
- [ ] ✅ **prepare-railway.sh**: Pre-deployment check script
- [ ] ✅ **README.md**: Project overview complete
- [ ] ✅ **.gitignore**: Comprehensive and updated
- [ ] **No Secret Files**: Verify no API keys, tokens in code
- [ ] **No node_modules**: Check `git ls-files | grep node_modules` (should be empty)
- [ ] **No dist/**: Check `git ls-files | grep /dist/` (should be empty)

## Git Status

- [ ] **All Changes Staged**: `git status` shows clean tree
- [ ] **No Uncommitted Code**: Everything committed
- [ ] **Branch is Main**: `git branch` shows main
- [ ] **Up to Date**: `git pull` shows "Already up to date"
- [ ] **Ready to Push**: No merge conflicts

## Railway Setup

- [ ] **Railway Account**: Created at https://railway.app
- [ ] **GitHub Connected**: Railway authorized to access repos
- [ ] **New Project Created**: "Deploy from GitHub" selected
- [ ] **Repository Selected**: project-isekai-v2 chosen
- [ ] **Root Directory**: PROTOTYPE folder set as root
- [ ] **PostgreSQL Added**: Service shows green/connected
- [ ] **Redis Added**: Service shows green/connected
- [ ] **Environment Variables Set**:
  - [ ] JWT_SECRET (strong, 32+ chars, random)
  - [ ] NODE_ENV=production
  - [ ] BETA_MODE=true
  - [ ] ENABLE_METRICS=true
  - [ ] MAX_CONCURRENT_PLAYERS=1000
  - [ ] LOG_LEVEL=info
- [ ] **No DATABASE_URL Manually Added**: Railway auto-provides
- [ ] **No REDIS_URL Manually Added**: Railway auto-provides

## Final Checks Before Deployment

```bash
# Run these commands locally:
npm test                          # ✅ All tests pass
npx tsc --noEmit                 # ✅ 0 type errors
npm audit                        # ✅ 0 vulnerabilities
git status                       # ✅ Clean tree
git log --oneline | head -5      # ✅ Recent commits visible
```

- [ ] **Test Results Visible**: Can show 5/5 passing
- [ ] **Type Errors: Zero**: tsc output clean
- [ ] **Vulnerabilities: Zero**: npm audit clean
- [ ] **Git Clean**: No uncommitted changes

## Deployment

- [ ] **Commit Message Written**: Descriptive message prepared
- [ ] **Ready to Push**: All checks passed above

```bash
# Execute:
git add -A
git commit -m "Ready for Railway beta deployment

- Comprehensive documentation (API, Architecture, Deployment)
- Environment templates created
- Build scripts prepared
- .gitignore updated (no secrets, no build artifacts)
- All tests passing (5/5)
- Type checking: 0 errors
- Security: 0 vulnerabilities
- Ready for production beta launch"

git push origin main
# Railway automatically deploys! Watch logs.
```

- [ ] **Push Successful**: No errors in `git push`
- [ ] **Railway Detected**: Email from Railway about new push (or check dashboard)

## Post-Deployment (Railway Dashboard)

- [ ] **Deployment Triggered**: Railway shows "Building" or "Deploying"
- [ ] **No Build Errors**: Railway logs show npm install, build, start succeeding
- [ ] **Services Connected**: PostgreSQL and Redis show green
- [ ] **Application Started**: Port 5000 shows "LISTEN" status
- [ ] **Wait 2-3 Minutes**: Full startup and initialization

## Health Verification

```bash
# Once Railway deployment shows "Live":

# 1. Health Check
curl https://[your-railway-domain]/api/health
# Expected: 200 OK with {"status":"healthy",...}

# 2. Access in Browser  
# Open: https://[your-railway-domain]
# Should load without 500 errors

# 3. Check Logs
# Railway Dashboard → Logs tab
# Should see: "✅ API Server ready on http://localhost:5000"
```

- [ ] **Health Check Passing**: `/api/health` returns 200
- [ ] **Browser Loads**: No 500 errors or ERR_CONNECTION errors
- [ ] **Console Connected**: ModeratorConsole shows "Connected ✅"
- [ ] **Logs Clean**: No ERROR or CRITICAL messages
- [ ] **Response Times**: <100ms from tests

## Monitoring (First 24 Hours)

- [ ] **Check Logs Every Hour**: Look for errors/anomalies
- [ ] **Monitor CPU**: Should be <80% consistently
- [ ] **Monitor Memory**: Should be <500MB
- [ ] **Track Error Rate**: Should be 0% or <1%
- [ ] **Test M69**: Verify exploit detection works
- [ ] **Test M70**: Verify campaign firing works
- [ ] **Test ModeratorConsole**: Real-time incident updates working
- [ ] **Check Metrics Endpoint**: `/metrics` returning Prometheus data

## Successful Deployment ✅

If all boxes checked:

```
✅ Code deployed to Railway
✅ Database initialized
✅ Application running
✅ Health check passing
✅ Real-time events working
✅ All systems green
✅ Ready for beta testers!
```

## Next Steps

1. **Invite Beta Testers**: Share production URL
2. **Monitor Actively**: First 48 hours are critical
3. **Track Metrics**: M69 exploits, M70 campaigns
4. **Gather Feedback**: Issues, performance, gameplay
5. **Iterate**: Deploy fixes/features with `git push`

## Rollback Procedure (If Issues)

If deployment has critical issues:

```bash
# Option 1: Railway Dashboard
# Go to Deployments tab
# Click previous successful deployment
# Click "Rollback"
# ← Automatic!

# Option 2: Git Revert (for code issues)
git revert HEAD
git push origin main
# Railway auto-deploys old code
```

## Troubleshooting

**App won't start**:
→ Check Railway Logs tab  
→ Look for DATABASE_URL or REDIS_URL errors  
→ Verify environment variables set  

**"502 Bad Gateway"**:
→ Application crashed  
→ Check logs for errors  
→ Likely: Missing env variable or database not initialized  

**Slow response times**:
→ Check CPU/Memory in dashboard  
→ Increase Railway compute if needed  
→ Check PostgreSQL query logs  

**Cannot connect to database**:
→ DATABASE_URL auto-provided by Railway  
→ Don't manually set DATABASE_URL  
→ Check PostgreSQL service shows green  

---

**Ready to deploy? Follow this checklist step-by-step!** 🚀
