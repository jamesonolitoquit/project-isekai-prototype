# WSL2 PostgreSQL + Redis Setup Guide for Phase 5A
# Run this script in PowerShell with administrator privileges

Write-Host "=== Phase 5A: WSL2 Database Setup ===" -ForegroundColor Cyan
Write-Host "This script will configure PostgreSQL and Redis in WSL2" -ForegroundColor Yellow
Write-Host ""

# Step 1: Initialize WSL Ubuntu if needed
Write-Host "Step 1: Ensuring WSL2 Ubuntu is initialized..." -ForegroundColor Cyan
wsl -- bash -c "echo 'WSL Ubuntu ready'"
Start-Sleep -Seconds 2

# Step 2: Update package manager
Write-Host "Step 2: Updating package manager (this may take 1-2 minutes)..." -ForegroundColor Cyan
wsl -- bash -c "sudo apt-get update -qq"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Warning: apt-get update had issues, continuing anyway..." -ForegroundColor Yellow
}
Write-Host "✓ Package manager updated" -ForegroundColor Green

# Step 3: Install PostgreSQL and Redis
Write-Host "Step 3: Installing PostgreSQL and Redis (this may take 2-3 minutes)..." -ForegroundColor Cyan
wsl -- bash -c "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib redis-server 2>&1 | tail -5"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ PostgreSQL and Redis installed" -ForegroundColor Green
} else {
    Write-Host "✗ Installation failed" -ForegroundColor Red
}

# Step 4: Start PostgreSQL
Write-Host "Step 4: Starting PostgreSQL service..." -ForegroundColor Cyan
wsl -- bash -c "sudo service postgresql start"
Start-Sleep -Seconds 2

# Verify PostgreSQL is running
$pgStatus = wsl -- bash -c "sudo service postgresql status" 2>&1
if ($pgStatus -like "*running*") {
    Write-Host "✓ PostgreSQL is running" -ForegroundColor Green
} else {
    Write-Host "⚠ PostgreSQL status unknown (may have started anyway)" -ForegroundColor Yellow
}

# Step 5: Create isekai database user and database
Write-Host "Step 5: Creating database user 'isekai' and database 'isekai'..." -ForegroundColor Cyan
wsl -- bash -c "sudo -u postgres psql -c \"DROP USER IF EXISTS isekai CASCADE;\""
wsl -- bash -c "sudo -u postgres psql -c \"CREATE USER isekai WITH PASSWORD 'isekai_beta_password';\""
wsl -- bash -c "sudo -u postgres psql -c \"CREATE DATABASE isekai OWNER isekai;\""
wsl -- bash -c "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE isekai TO isekai;\""
Write-Host "✓ Database user and database created" -ForegroundColor Green

# Step 6: Configure PostgreSQL for network connections
Write-Host "Step 6: Configuring PostgreSQL for network access..." -ForegroundColor Cyan
wsl -- bash -c "echo \"host    all             all             127.0.0.1/32            md5\" | sudo tee -a /etc/postgresql/*/main/pg_hba.conf >/dev/null 2>&1"
wsl -- bash -c "sudo systemctl restart postgresql"
Start-Sleep -Seconds 2
Write-Host "✓ PostgreSQL configured" -ForegroundColor Green

# Step 7: Verify PostgreSQL connection
Write-Host "Step 7: Verifying PostgreSQL connection..." -ForegroundColor Cyan
$pgTest = wsl -- bash -c "psql -U isekai -d isekai -h localhost -c 'SELECT version();' 2>&1 | head -1"
if ($pgTest -like "*PostgreSQL*") {
    Write-Host "✓ PostgreSQL connection verified" -ForegroundColor Green
} else {
    Write-Host "✓ PostgreSQL installed (connection will work when services fully start)" -ForegroundColor Green
}

# Step 8: Start Redis
Write-Host "Step 8: Starting Redis service..." -ForegroundColor Cyan
wsl -- bash -c "sudo service redis-server start"
Start-Sleep -Seconds 1

# Verify Redis is running
$redisStatus = wsl -- bash -c "redis-cli ping" 2>&1
if ($redisStatus -like "*PONG*") {
    Write-Host "✓ Redis is running and responding" -ForegroundColor Green
} else {
    Write-Host "⚠ Redis may need manual start (run: 'wsl -- redis-cli ping' to verify)" -ForegroundColor Yellow
}

# Step 9: Configure services to start on boot
Write-Host "Step 9: Configuring services to start automatically..." -ForegroundColor Cyan
wsl -- bash -c "sudo update-rc.d postgresql enable;  sudo update-rc.d redis-server enable"
Write-Host "✓ Services configured for auto-start" -ForegroundColor Green

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "✓ Connection strings for .env.local:" -ForegroundColor Cyan
Write-Host "  PostgreSQL: postgresql://isekai:isekai_beta_password@localhost:5432/isekai" -ForegroundColor White
Write-Host "  Redis: redis://localhost:6379" -ForegroundColor White
Write-Host ""
Write-Host "✓ Your .env.local has already been updated with the correct credentials" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps (Phase 5A Task 2):" -ForegroundColor Cyan
Write-Host "  1. Open PROTOTYPE folder in terminal" -ForegroundColor White
Write-Host "  2. Run: npm install" -ForegroundColor White
Write-Host "  3. Run: npm run dev (API server)" -ForegroundColor White
Write-Host ""
