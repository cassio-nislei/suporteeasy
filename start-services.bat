@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0"
set "ROOT=%cd%"
set "API_PORT=3001"
set "WEB_PORT=3000"
set "MONGODB_URI=mongodb://admin:Ncm%%40647534@104.234.173.105:27017/atera?authSource=admin"

where npm >nul 2>nul
if errorlevel 1 (
  echo [FAIL] npm was not found in PATH.
  exit /b 1
)

call :ensure_port_free %API_PORT% API
if errorlevel 1 exit /b 1

call :ensure_port_free %WEB_PORT% WEB
if errorlevel 1 exit /b 1

echo [INFO] Building WEB before startup...
call npm --prefix apps/web run build
if errorlevel 1 (
  echo [FAIL] WEB build failed.
  exit /b 1
)

echo [INFO] Starting API on port %API_PORT%...
start "Easyli API" cmd /k "cd /d ""%ROOT%"" && set ""MONGODB_URI=%MONGODB_URI%"" && set ""DISABLE_QUEUES=true"" && set ""PORT=%API_PORT%"" && set ""CORS_ORIGIN=http://localhost:%WEB_PORT%"" && npm --prefix apps/api run start:dev"

echo [INFO] Starting WEB on port %WEB_PORT%...
start "Easyli WEB" cmd /k "cd /d ""%ROOT%"" && set ""NEXT_PUBLIC_API_URL=http://localhost:%API_PORT%/api/v1"" && set ""API_PROXY_TARGET=http://127.0.0.1:%API_PORT%/api/v1"" && set ""NEXT_PUBLIC_APP_URL=http://localhost:%WEB_PORT%"" && set ""NEXT_PUBLIC_WS_URL=http://localhost:%API_PORT%"" && npm --prefix apps/web run start"

echo [DONE] API and WEB windows were started.
echo [DONE] API: http://localhost:%API_PORT%/api/v1
echo [DONE] Swagger: http://localhost:%API_PORT%/api/docs
echo [DONE] WEB: http://localhost:%WEB_PORT%
exit /b 0

:ensure_port_free
set "PORT_PID="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":%~1 .*LISTENING"') do (
  set "PORT_PID=%%P"
  goto :port_in_use
)
exit /b 0

:port_in_use
echo [FAIL] %~2 port %~1 is already in use by PID !PORT_PID!.
echo [FAIL] Stop the existing process before running start-services.bat again.
exit /b 1
