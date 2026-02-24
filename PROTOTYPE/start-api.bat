@echo off
cd /d "C:\Users\Jaoce\OneDrive\Documents\GitHub\project-isekai-v2\PROTOTYPE"

echo.
echo === Phase 5A Task 2: Starting API Server ===
echo.
echo Checking prerequisites...

REM Check if node is installed
where node > nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Node.js not found
    pause
    exit /b 1
)

REM Display Node and npm versions
echo Node version:
node --version
echo npm version:
npm --version
echo.

REM Clean up lock files
echo Cleaning up lock files...
if exist ".next\dev\lock" del ".next\dev\lock" /f /q
if exist "node_modules\.package-lock.json" del "node_modules\.package-lock.json" /f /q

echo.
echo Starting API server on port 3001...
echo Complete output will be shown below.
echo.
echo =====================================
echo.

REM Start the dev server
npm run dev

pause
