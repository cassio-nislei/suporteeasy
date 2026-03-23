@echo off
REM ==================================================
REM  Easyli Windows Agent - Complete Setup Package
REM ==================================================
REM  This batch file demonstrates all installation
REM  methods and provides quick access to tools
REM ==================================================

setlocal enabledelayedexpansion

:menu
cls
echo.
echo ========================================
echo   Easyli Windows Agent Setup Menu
echo ========================================
echo.
echo Available options:
echo.
echo   1. Install Agent (GUI Installer)
echo   2. Verify Installation
echo   3. Uninstall Agent
echo   4. View Documentation
echo   5. Build MSI Installer
echo   6. Run Verification Tests
echo   0. Exit
echo.
set /p choice="Select option (0-6): "

if "%choice%"=="1" goto install_gui
if "%choice%"=="2" goto verify
if "%choice%"=="3" goto uninstall
if "%choice%"=="4" goto docs
if "%choice%"=="5" goto build_msi
if "%choice%"=="6" goto verify_tests
if "%choice%"=="0" goto exit_menu
goto menu

:install_gui
cls
echo Running GUI Installer...
echo Please wait, requesting administrator privileges...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%~dp0install-agent-gui.ps1\"'"
pause
goto menu

:verify
cls
if exist "C:\Program Files\Easyli Windows Agent" (
    echo Verifying installation...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-installation.ps1"
) else (
    echo Agent not installed at default location.
    echo Install path: C:\Program Files\Easyli Windows Agent
)
pause
goto menu

:uninstall
cls
echo Checking for installed agent...
if exist "C:\Program Files\Easyli Windows Agent\uninstall-agent.ps1" (
    echo Found uninstall script. Executing...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"C:\\Program Files\\Easyli Windows Agent\\uninstall-agent.ps1\"'"
) else (
    echo Agent not found at default location.
)
pause
goto menu

:docs
cls
echo Opening documentation...
if exist "%~dp0INSTALLATION_GUIDE.md" (
    start notepad "%~dp0INSTALLATION_GUIDE.md"
) else if exist "%~dp0README.md" (
    start notepad "%~dp0README.md"
)
timeout /t 2 /nobreak
goto menu

:build_msi
cls
echo Building MSI Installer...
echo This requires WiX Toolset to be installed.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-msi.ps1" -OutputPath "%CD%\dist"
pause
goto menu

:verify_tests
cls
echo Running verification tests...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0verify-installation.ps1"
pause
goto menu

:exit_menu
cls
echo.
echo Exiting Easyli Windows Agent Setup.
echo.
exit /b 0
