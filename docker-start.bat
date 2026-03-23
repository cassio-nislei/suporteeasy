@echo off
REM docker-start.bat - Start Docker containers (Windows)

setlocal enabledelayedexpansion

echo.
echo 🐳 Easyli Docker - Start Script
echo ========================================

REM Check Docker installation
where docker >nul 2>nul
if errorlevel 1 (
    echo ❌ Docker is not installed
    exit /b 1
)

where docker-compose >nul 2>nul
if errorlevel 1 (
    echo ❌ Docker Compose is not installed
    exit /b 1
)

echo ✓ Docker is installed
echo ✓ Docker Compose is installed

echo.
echo ========================================
echo Starting containers...
echo ========================================
echo.

REM Start containers
docker-compose up --build

echo.
echo ✅ Containers started!
echo.
echo API:      http://localhost:3001
echo Swagger:  http://localhost:3001/api/docs
echo Web:      http://localhost:3000
echo.
pause
