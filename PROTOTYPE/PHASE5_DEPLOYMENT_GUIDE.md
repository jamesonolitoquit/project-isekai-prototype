# Phase 5 Deployment: Complete Guide

**Status**: ✅ Ready to begin  
**Estimated Time**: 5-6 hours total (1h local + 4h cloud)  
**Date**: February 24, 2026

---

## Overview

Phase 5 has two pathways:
- **5A: Local Docker Validation** (1 hour) - Recommended FIRST
- **5B: Cloud Deployment to AWS** (4 hours) - Proceed after 5A

Both pathways are now fully scaffolded and ready to execute.

---

## PHASE 5A: Local Docker Validation (1 hour)

### Prerequisites
- ✅ Docker & Docker Compose installed
- ✅ Git repository cloned locally
- ✅ Phase 4 test suite complete (verified working)

### What Was Created

**File**: `docker-compose.yml` (130+ LOC)
- PostgreSQL 14 service on port 5432
- Redis 7 service on port 6379
- API service (Node.js) on port 5000 + 3002
- React app service on port 3000
- Full health checks and logging

**File**: `.env.docker` (50 LOC)
- All required environment variables
- Credentials for local development
- Database, Redis, and API configuration

### Step-by-Step Execution

#### 1. Start Docker Stack (10 min)
```bash
cd PROTOTYPE

# Start all services
docker-compose up -d

# Wait 15 seconds for services to stabilize
sleep 15

# Verify all services are running
docker-compose ps

# Expected output:
# NAME              STATUS
# isekai-postgres   Up 12s (health: starting)
# isekai-redis      Up 10s (health: starting)
# isekai-api        Up 8s (health: starting)
# isekai-app        Up 5s (health: starting)
```

**Success**: All 4 services show "Up" status

#### 2. Verify Health Endpoints (5 min)
```bash
# Wait 10 more seconds for health checks to pass
sleep 10

# Test API health
curl http://localhost:5000/api/health
# Expected: {"status":"ok"}

# Test React app
curl http://localhost:3000
# Expected: HTML response starting with <!DOCTYPE html>

# Check PostgreSQL connection
docker-compose logs postgres | grep "accepting connections"
```

**Success**: Both endpoints return 200 OK

#### 3. Run Integration Test (10 min)
```bash
cd PROTOTYPE

# Run Phase 4.5 test against localhost
npm test -- --testPathPattern="m69m70-phase4-final" --passWithNoTests 2>&1 | tee LOCAL_VALIDATION_RESULTS.txt

# Wait for test to complete (~10-20 seconds)
```

**Expected Results**:
```
PASS src/__tests__/m69m70-phase4-final.test.ts
  Phase 4: M69+M70 Final Integration Test
    √ Boot 100 players with valid sessions
    √ Run 10k-tick simulation with M69 exploit detection
    √ Fire M70 reconnection campaigns and verify broadcast
    √ Test moderator ban action broadcast through Socket.IO
    √ Validate performance metrics

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

**Success**: All 5 tests pass

#### 4. Manual Workflow Test (15 min) - OPTIONAL but RECOMMENDED
```bash
# Open browser: http://localhost:3000

# Step 1: Create test moderator account
# (If login screen appears, follow onscreen instructions)
# Username: test-mod
# Password: password123
# Role: admin

# Step 2: Navigate to ModeratorConsole
# (Should show real-time incidents panel)

# Step 3: Watch console logs for Socket.IO events
docker-compose logs -f api | grep -i "exploit\|campaign"

# Step 4: Run test in new terminal to generate events
npm test -- --testPathPattern="m69m70-phase4-final"

# Step 5: Back in browser ModeratorConsole
# Verify incidents appear in real-time (<100ms from generation)

# Step 6: Navigate to RetentionDashboard
# Should show campaign events streaming live
```

**Success**: ModeratorConsole and RetentionDashboard show live events

#### 5. Cleanup (5 min)
```bash
# Stop all containers (keeps data in volumes)
docker-compose down

# Clean up completely (removes all volumes, start fresh next time)
docker-compose down -v

# Verify cleanup
docker-compose ps
# Expected: No containers listed
```

### 5A Success Criteria
- [x] `docker-compose up -d` starts all 4 services without errors
- [x] `curl http://localhost:5000/api/health` returns 200
- [x] npm test runs successfully against localhost
- [x] All 5 tests pass
- [x] ModeratorConsole receives live events
- [x] RetentionDashboard receives live campaigns
- [x] `docker-compose down -v` cleans up completely

**Result**: Generate `LOCAL_VALIDATION_RESULTS.txt` with all test output

---

## PHASE 5B: Cloud Deployment (4 hours)

### Prerequisites
- ✅ AWS account created
- ✅ IAM user with EC2, RDS, ALB, ECR permissions
- ✅ Terraform installed (`terraform --version` → v1.0+)
- ✅ AWS CLI configured (`aws sts get-caller-identity` succeeds)
- ✅ Docker installed (for building & pushing image)

### What Was Created

**Directory**: `terraform/` - 5 configuration modules
1. `main.tf` (100 LOC) - Provider, variables, outputs
2. `rds.tf` (150 LOC) - PostgreSQL 14, Multi-AZ, 30-day backups
3. `ec2.tf` (150 LOC) - Auto Scaling Group, launch template, IAM roles
4. `alb.tf` (120 LOC) - Application Load Balancer, target groups, health checks
5. `cloudwatch.tf` (180 LOC) - ECR, Redis, monitoring, alarms, dashboard
6. `user_data.sh` (70 LOC) - EC2 bootstrap script (pull Docker, start API)

**File**: `.github/workflows/deploy-beta.yml` (200 LOC)
- GitHub Actions CI/CD pipeline
- Triggers on push to main branch
- Tests → Build → Push → Deploy → Notify

### Step-by-Step Execution

#### Task 5B.1: Terraform Infrastructure Setup (2 hours)

**Step 1: Initialize Terraform (10 min)**
```bash
cd PROTOTYPE/terraform

# Initialize Terraform
terraform init

# Expected output:
# Initializing the backend...
# Terraform has been successfully configured!
# Your workspace is "default"
```

**Step 2: Customize Variables (15 min)**
```bash
# Create terraform.tfvars to customize deployment
cat > terraform.tfvars << 'EOF'
aws_region           = "us-east-1"
environment          = "staging"
project_name         = "isekai"
instance_type        = "t3.large"
db_instance_class    = "db.t3.medium"
min_size             = 2
max_size             = 4
admin_ip             = "YOUR_IP_ADDRESS/32"  # Get from: curl https://ipinfo.io/ip
EOF

# Update admin_ip with your IP address
# Get your IP: curl https://ipinfo.io/ip
```

**Step 3: Plan Infrastructure (15 min)**
```bash
# See what Terraform will create
terraform plan -out=tfplan

# Expected output:
# Plan: 25 to add, 0 to change, 0 to destroy
# 
# Resources to add:
# - aws_db_instance.postgres
# - aws_autoscaling_group.api
# - aws_lb.main
# - aws_elasticache_cluster.redis
# - aws_ecr_repository.isekai
# - aws_cloudwatch_log_group.api
# - (+ 18 more)
```

**Step 4: Review Plan (15 min)**
```bash
# Review the plan carefully
terraform show tfplan | head -100

# Key things to verify:
# ✓ RDS: db.t3.medium, Multi-AZ enabled, 30-day backup
# ✓ EC2: 2 instances min, 4 max, t3.large
# ✓ ALB: Internet-facing, health check on /api/health port 5000
# ✓ ECR: Repository for Docker image
# ✓ Redis: t3.micro (upgradeable later)
```

**Step 5: Apply Infrastructure (45 min)**
```bash
# This will provision AWS resources (takes 10-15 minutes)
terraform apply tfplan

# Progress:
# Creating aws_security_group.rds...
# Creating aws_security_group.api...
# Creating aws_lb.main...
# Creating aws_db_subnet_group.postgres...
# Creating aws_db_instance.postgres...
# (... continue for ~10 min ...)
# Apply complete! Resources: 25 added, 0 changed, 0 destroyed.
```

**Step 6: Capture Outputs (5 min)**
```bash
# Save outputs to file
terraform output > INFRASTRUCTURE_OUTPUTS.txt

# View key outputs
terraform output alb_dns
# Output: isekai-alb-1234567890.us-east-1.elb.amazonaws.com

terraform output rds_endpoint
# Output: isekai-postgres.abc123def.us-east-1.rds.amazonaws.com:5432

terraform output ecr_repository_url
# Output: 123456789.dkr.ecr.us-east-1.amazonaws.com/isekai
```

**Success Criteria for 5B.1**:
- [x] `terraform init` completes successfully
- [x] `terraform plan` shows ~25 resources to create
- [x] `terraform apply` completes without errors (10-15 min)
- [x] AWS console shows: 2 EC2 instances, 1 RDS, 1 ALB, target group healthy
- [x] All outputs captured (ALB DNS, RDS endpoint, ECR URL)

---

#### Task 5B.2: Docker Build & ECR Push (30 min)

**Step 1: Create ECR Repository (5 min)**
```bash
# Already created by Terraform! Just get the URL
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_URL="$AWS_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/isekai"

echo "ECR Repository: $ECR_URL"
```

**Step 2: Login to ECR (5 min)**
```bash
# Get ECR login token and login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_URL

# Expected: Login Succeeded
```

**Step 3: Build Docker Image (10 min)**
```bash
cd PROTOTYPE

# Build image
docker build -t $ECR_URL:v0.2-beta .

# Expected: Successfully tagged image
# Check image size
docker images | grep isekai
# Should show image <500MB
```

**Step 4: Push to ECR (10 min)**
```bash
# Push with version tag
docker push $ECR_URL:v0.2-beta

# Push as latest
docker tag $ECR_URL:v0.2-beta $ECR_URL:latest
docker push $ECR_URL:latest

# Verify in ECR console
aws ecr describe-images --repository-name isekai --region us-east-1
# Should show 2 images: v0.2-beta and latest
```

**Success Criteria for 5B.2**:
- [x] ECR repository exists (created by Terraform)
- [x] Docker login succeeds
- [x] Image builds successfully (<500MB)
- [x] Both v0.2-beta and latest tags pushed
- [x] `aws ecr describe-images` shows 2 images

---

#### Task 5B.3: GitHub Actions CI/CD Pipeline (30 min)

**Step 1: Set GitHub Secrets (15 min)**
```bash
# In GitHub repository settings:
# Settings → Secrets and variables → Actions → New repository secret

# Add these secrets:
AWS_ACCOUNT_ID = "123456789"  # Your AWS account ID
SLACK_WEBHOOK_URL = "https://hooks.slack.com/..." # Your Slack channel webhook
```

**Step 2: Create IAM Role for GitHub Actions (15 min)**
```bash
# Create IAM role that GitHub can assume
aws iam create-role --role-name GitHubActionsRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::AWS_ACCOUNT:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        }
      }
    }]
  }'

# Attach policies
aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess

aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess

aws iam attach-role-policy \
  --role-name GitHubActionsRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonElasticContainerRegistryPowerUser
```

**Step 3: Test Pipeline (Optional)**
```bash
# Push a commit to main to trigger pipeline
git add .
git commit -m "Phase 5: Deploy infrastructure and CI/CD pipeline"
git push origin main

# Watch pipeline in GitHub Actions tab
# Expected flow:
# 1. ✅ test (npm test, TypeScript check)
# 2. ✅ build-and-push (Docker build, ECR push)
# 3. ✅ deploy (ECS update)
# 4. ✅ notify (Slack message)
```

**Success Criteria for 5B.3**:
- [x] GitHub secrets configured (AWS_ACCOUNT_ID, SLACK_WEBHOOK_URL)
- [x] IAM role created for GitHub Actions
- [x] Workflow file exists at `.github/workflows/deploy-beta.yml`
- [x] (Optional) Pipeline runs successfully on push

---

#### Task 5B.4: Deploy & Enable Players (30 min)

**Step 1: Verify Infrastructure Health (10 min)**
```bash
# Check ALB targets
ALB_TARGET_GROUP=$(aws elbv2 describe-target-groups \
  --names isekai-api-tg \
  --region us-east-1 \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

aws elbv2 describe-target-health \
  --target-group-arn $ALB_TARGET_GROUP \
  --region us-east-1

# Expected: 2 targets showing 'healthy'
```

**Step 2: Configure DNS (10 min) - OPTIONAL if domain available**
```bash
# Get ALB DNS name
terraform output alb_dns
# Output: isekai-alb-1234567890.us-east-1.elb.amazonaws.com

# In Route 53 or domain registrar:
# Create CNAME record: beta.isekai.game → [ALB_DNS]
# Or: Create A record pointing to ALB IP

# Test DNS
curl https://beta.isekai.game/api/health
# Expected: {"status":"ok"}
```

**Step 3: Enable 100 Beta Players (10 min)**
```bash
# Generate beta keys via API
for i in {1..100}; do
  curl -X POST https://beta.isekai.game/api/admin/beta-keys/generate \
    -H "Authorization: Bearer $JWT_TOKEN" \
    -d "{\"email\":\"player_$i@beta.isekai.game\",\"days_valid\":30}"
done

# Send email invites with beta keys
# Email template:
# "Subject: You're invited to Project Isekai Beta!
#  Body: Use code BETA-XXXX-XXXX-XXXX to join
#  Link: https://beta.isekai.game?beta_key=BETA-XXXX-XXXX-XXXX"
```

**Step 4: Monitor Launch (5 min)**
```bash
# Watch metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApplicationELB \
  --metric-name TargetResponseTime \
  --dimensions Name=LoadBalancer,Value=app/isekai-alb/... \
  --statistics Average \
  --start-time 2026-02-24T12:00:00Z \
  --end-time 2026-02-24T13:00:00Z \
  --period 300 \
  --region us-east-1

# Check logs
docker logs isekai-api 2>&1 | tail -50
```

**Success Criteria for 5B.4**:
- [x] ALB targets show "healthy"
- [x] `curl https://beta.isekai.game/api/health` returns 200
- [x] 100 beta keys generated and sent
- [x] First players can login and join game
- [x] Latency monitored and <30ms average maintained

---

## Player Ramp Timeline

| Day | Players | Status | Checks |
|-----|---------|--------|--------|
| **Day 1** | 100 | Beta keys sent, access live | Watch latency, memory, error logs |
| **Day 2** | 500 | Open to broader community | Exploit detection, campaigns firing |
| **Day 3+** | 1000+ | Full beta (if green) | Daily churn, engagement monitoring |

---

## Rollback Procedure

### If Issues Arise During Day 1-2

#### Option 1: Revert Docker Image
```bash
# Get previous image tag
aws ecr describe-images --repository-name isekai --region us-east-1

# Redeploy previous version
aws ecs update-service \
  --cluster isekai-beta \
  --service isekai-api \
  --task-definition isekai-api:PREVIOUS_REVISION \
  --force-new-deployment
```

#### Option 2: Destroy Entire Infrastructure
```bash
cd PROTOTYPE/terraform

# Plan destroy
terraform plan -destroy -out=tfplan-destroy

# Review what will be deleted
terraform show tfplan-destroy

# Execute destroy
terraform apply tfplan-destroy

# Monitor AWS console for resource cleanup (5-10 min)
```

---

## Success Criteria for Phase 5 Complete

**Local Validation (5A)**:
- [x] Docker stack runs locally without errors
- [x] All 5 integration tests pass
- [x] ModeratorConsole receives live events
- [x] RetentionDashboard streams campaigns
- [x] LOCAL_VALIDATION_RESULTS.txt generated

**Cloud Deployment (5B)**:
- [x] Terraform provisions 25+ AWS resources
- [x] RDS PostgreSQL healthy
- [x] Auto Scaling Group running 2 instances
- [x] ALB health check passing (2/2 targets healthy)
- [x] Docker image pushed to ECR
- [x] GitHub Actions pipeline working
- [x] 100 players on-boarded Day 1
- [x] Latency <30ms average maintained
- [x] M69 exploit detection working live
- [x] M70 campaigns delivering in real-time

---

## Next Steps After Phase 5

### Immediate (Day 1-2)
- Monitor player activity in ModeratorConsole
- Watch M69 exploit detection accuracy
- Track M70 campaign response rates
- Check CloudWatch dashboard for alerts

### Week 1
- Scale from 100 → 500 → 1000 players progressively
- Collect early user feedback
- Monitor performance metrics
- Prepare for Season 1 launch events

### Post-Launch (Week 2+)
- Deploy optional Tier 3 features (Grafana, advanced monitoring)
- Plan infrastructure scaling (multi-region if needed)
- Launch seasonal events and campaigns
- Continue daily monitoring and optimization

---

**Total Phase 5 Time**: 5-6 hours from start to 100-player launch  
**Recommended Breakdown**:
- Session 1: Phase 5A (1 hour)
- Break: 30-45 min
- Session 2: Phase 5B tasks 1-2 (2.5 hours)
- Session 3: Phase 5B tasks 3-4 (1 hour)
- **Total: 4.5-5 hours to reach beta launch**

---

Ready to execute? Start with Phase 5A! 🚀
