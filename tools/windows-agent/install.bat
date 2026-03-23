@echo off
REM ==================================================
REM  Easyli Windows Agent - Interactive Installer
REM ==================================================
REM  This script launches the GUI installer with
REM  administrative privileges
REM ==================================================

setlocal enabledelayedexpansion

cd /d "%~dp0"

REM Check for admin privileges
net session >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERROR] Administrator privileges are required to install the Windows agent.
    echo.
    echo Requesting admin privileges...
    powershell -Command "Start-Process -FilePath '%0' -Verb RunAs"
    exit /b 1
)

REM Run the GUI installer
echo [INFO] Launching Easyli Windows Agent installer...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agent-gui.ps1"

if errorlevel 1 (
    echo.
    echo [ERROR] Installation failed. See details above.
    pause
    exit /b 1
)

echo.
echo [SUCCESS] Installation completed successfully!
echo.
pause
exit /b 0
