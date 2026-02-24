#!/bin/bash
set -e

echo "=== Phase 5A: WSL2 Database Setup ==="
echo ""

echo "Step 1: Updating package manager..."
sudo apt-get update -qq

echo "Step 2: Installing PostgreSQL and Redis..."
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql postgresql-contrib redis-server

echo "Step 3: Starting PostgreSQL service..."
sudo service postgresql start
sleep 2

echo "Step 4: Creating database user and database..."
sudo -u postgres psql -c "DROP USER IF EXISTS isekai;"
sudo -u postgres psql -c "CREATE USER isekai WITH PASSWORD 'isekai_beta_password';"
sudo -u postgres psql -c "CREATE DATABASE isekai OWNER isekai;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE isekai TO isekai;"

echo "Step 5: Restarting PostgreSQL..."
sudo systemctl restart postgresql
sleep 2

echo "Step 6: Starting Redis service..."
sudo service redis-server start
sleep 1

echo "Step 7: Configuring services to start on boot..."
sudo update-rc.d postgresql enable
sudo update-rc.d redis-server enable

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Connection Details:"
echo "  PostgreSQL: postgresql://isekai:isekai_beta_password@localhost:5432/isekai"
echo "  Redis: redis://localhost:6379"
echo ""
echo "Status: .env.local already updated"
echo ""
echo "Next: Run 'npm run dev' to start the API server"
