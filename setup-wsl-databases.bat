@echo off
echo Setting up PostgreSQL and Redis in WSL2...
echo.

REM Install PostgreSQL and Redis in WSL
wsl -- bash -c "sudo service postgresql start 2>/dev/null; sudo service postgresql status"
echo PostgreSQL status check complete.
echo.

echo Installing packages...
wsl -- bash -c "sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib redis-server"
echo.

echo Starting services...
wsl -- bash -c "sudo service postgresql start && sudo service redis-server start"
echo.

echo Creating isekai database and user...
wsl -- bash -c "sudo -u postgres psql -c \"CREATE USER isekai WITH PASSWORD 'isekai_beta_password';\" || echo 'User may already exist'"
wsl -- bash -c "sudo -u postgres psql -c \"CREATE DATABASE isekai OWNER isekai;\" || echo 'Database may already exist'"
wsl -- bash -c "sudo -u postgres psql -c \"GRANT ALL PRIVILEGES ON DATABASE isekai TO isekai;\""
echo.

echo Verifying connection...
wsl -- bash -c "psql -U isekai -d isekai -h localhost -c 'SELECT version();' 2>/dev/null || echo 'Testing connection...'"
echo.

echo Verifying Redis...
wsl -- bash -c "redis-cli ping"
echo.

echo WSL2 setup complete! Connection strings:
echo   PostgreSQL: postgresql://isekai:isekai_beta_password@localhost:5432/isekai
echo   Redis: redis://localhost:6379
echo.
pause
