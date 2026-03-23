@echo off
REM docker-stop.bat - Stop Docker containers (Windows)

setlocal enabledelayedexpansion

echo.
echo 🐳 Easyli Docker - Stop Script
echo ========================================

docker-compose stop

echo ✓ Containers stopped
echo.
echo To remove containers and volumes:
echo   docker-compose down -v
echo.
pause
