# Deployment Guide: Railway

## Prerequisites
- GitHub account
- Railway account (https://railway.app)
- Project pushed to GitHub

## Step 1: Create Railway Project

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub"
4. Authorize Railway to access your repositories
5. Select `project-isekai-v2`
6. Select PROTOTYPE as the root directory
7. Click "Deploy"

## Step 2: Add Services

### PostgreSQL
1. In Railway Dashboard, click "Add Service"
2. Select "PostgreSQL"
3. Railway auto-provisions and provides `DATABASE_URL` environment variable

### Redis
1. Click "Add Service" again
2. Select "Redis"
3. Railway auto-provides `REDIS_URL` environment variable

## Step 3: Configure Environment Variables

In Railway Dashboard → Project → Variables tab, add:

```
JWT_SECRET=generate-strong-random-secret-min-32-chars
NODE_ENV=production
PORT=5000
BETA_MODE=true
ENABLE_METRICS=true
MAX_CONCURRENT_PLAYERS=1000
LOG_LEVEL=info
```

**Important**: PostgreSQL and Redis URLs are automatically provided by Railway - don't add them manually.

## Step 4: Deploy

```bash
# Simply push to main
git add -A
git commit -m "Ready for Railway beta deployment"
git push origin main

# Railway automatically:
# 1. Detects push to main
# 2. Installs dependencies (npm install)
# 3. Runs tests (npm test)
# 4. Type checks (tsc --noEmit)
# 5. Builds application (npm run build)
# 6. Starts server on port 5000
```

## Step 5: Access Application

Railway provides a domain automatically:
```
https://project-isekai-production-[random-id].railway.app
```

### Custom Domain (Optional)
1. Buy domain (Namecheap, GoDaddy, etc.)
2. In Railway Dashboard → Domains → Add Domain
3. Add CNAME record in domain registrar pointing to Railway
4. Wait 5-10 minutes for DNS propagation

## Monitoring

### Application Logs
```
Railway Dashboard → Logs tab → Shows real-time application output
```

### Metrics
```
https://[your-railway-domain]/metrics
```
Prometheus-format metrics including:
- HTTP request counts and latencies
- Memory usage
- Event processing rates

### Health Check
```bash
curl https://[your-railway-domain]/api/health
```

Expected response:
```json
{"status": "healthy", "timestamp": "2026-02-24T12:00:00Z", "uptime": 3600}
```

## Scaling

### Increase Capacity
1. Railway Dashboard → Your Project → Settings
2. Increase RAM/CPU allocation as needed
3. Changes take effect immediately

### Auto-scaling
Railway automatically manages resources based on usage. Monitor CPU/Memory in the dashboard.

## Rollback

To revert to a previous deployment:

```bash
# View deployment history in Railway Dashboard
# Click on previous deployment and select "Rollback"

# Or revert the commit and push:
git revert HEAD
git push origin main
```

## Cost Estimation

| Service | Cost | Notes |
|---------|------|-------|
| PostgreSQL | $10-15/mo | Includes backups |
| Redis | $5-10/mo | Managed cache |
| Compute (Node.js) | $5-10/mo | Auto-scales |
| **Total** | **~$20-35/mo** | For 100+ concurrent players |

## Troubleshooting

### Application won't start
```
1. Check Railway Logs tab for errors
2. Common issues:
   - Missing environment variables (add in dashboard)
   - Database not initialized (check DATABASE_URL)
   - Port conflict (use port 5000)
3. Check that package.json has correct start script
```

### Slow database queries
```
1. Check PostgreSQL size: Railway Dashboard → PostgreSQL → Resources
2. If needed, upgrade to higher plan
3. Verify database indexes are created (auto-created on deploy)
4. Check Redis connection (should cache frequently-used data)
```

### High memory usage
```
1. Monitor in Railway Dashboard
2. If consistently > 500MB:
   - Check for memory leaks (check logs for patterns)
   - Increase Node.js memory allocation
   - Upgrade Railway compute plan
3. Profile with: /metrics endpoint
```

### Connection timeouts
```
1. Check if services are running (green icon in dashboard)
2. Restart services if needed
3. Check firewall/network settings
4. Verify DATABASE_URL and REDIS_URL are correct
```

## Security Checklist

- [ ] JWT_SECRET is strong (min 32 characters, random)
- [ ] DATABASE_URL only accessible to Railway services
- [ ] REDIS_URL only accessible to Node.js application
- [ ] HTTPS enforced (Railway auto-certificates)
- [ ] Environment variables never committed to git
- [ ] `.env.local` in .gitignore (never committed)
- [ ] Backups enabled (Railway auto-backs up PostgreSQL)
- [ ] Logs monitored for errors/anomalies

## Next Steps

After deployment:
1. Monitor first 24 hours for stability
2. Collect performance metrics
3. Invite beta testers
4. Track user engagement (M70 retention engine)
5. Monitor exploit detection (M69 alerts)
6. Adjust MAX_CONCURRENT_PLAYERS if needed

## Getting Help

- Railway Docs: https://docs.railway.app
- Railway Support: support@railway.app
- Project Issues: See GitHub issue tracker
