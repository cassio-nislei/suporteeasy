[CmdletBinding()]
param(
  [string]$OutputPath = (Join-Path (Split-Path $PSScriptRoot -Parent) 'dist'),
  [switch]$SourceOnly
)

$ErrorActionPreference = 'Stop'

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Easyli Windows Agent MSI Builder" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$scriptRoot = $PSScriptRoot
$rootDir = Split-Path -Parent (Split-Path -Parent $scriptRoot)

# Step 1: Build the package payload
Write-Host "`n[Build] Building agent package payload..."
$buildScriptPath = Join-Path $scriptRoot 'build-package.ps1'

if (-not (Test-Path $buildScriptPath)) {
  throw "build-package.ps1 not found at $buildScriptPath"
}

& $buildScriptPath -OutputRoot "$scriptRoot\build"

Write-Host "✓ Package payload built successfully"

# Step 2: Check WiX Toolset
Write-Host "`n[WiX] Checking for WiX Toolset installation..."

$heatExe = Get-Command heat.exe -ErrorAction SilentlyContinue
$candleExe = Get-Command candle.exe -ErrorAction SilentlyContinue
$lightExe = Get-Command light.exe -ErrorAction SilentlyContinue

if (-not ($heatExe -and $candleExe -and $lightExe)) {
  Write-Host "`n⚠ WiX Toolset not found. Installing..." -ForegroundColor Yellow
  
  # Download and install WiX
  $wixUrl = 'https://github.com/wixtoolset/wix3/releases/download/wix3111rtm/wix311.exe'
  $wixInstaller = Join-Path $env:TEMP 'wix311.exe'
  
  Write-Host "Downloading WiX Toolset from $wixUrl..."
  Invoke-WebRequest -Uri $wixUrl -OutFile $wixInstaller
  
  Write-Host "Installing WiX Toolset..."
  & $wixInstaller /install /quiet /norestart
  
  Remove-Item $wixInstaller -Force
  
  $heatExe = Get-Command heat.exe -ErrorAction SilentlyContinue
  $candleExe = Get-Command candle.exe -ErrorAction SilentlyContinue
  $lightExe = Get-Command light.exe -ErrorAction SilentlyContinue
  
  if (-not ($heatExe -and $candleExe -and $lightExe)) {
    throw "Failed to install WiX Toolset. Please install manually from https://wixtoolset.org/"
  }
}

Write-Host "✓ WiX Toolset found"

# Step 3: Create output directory
if (-not (Test-Path $OutputPath)) {
  New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

Write-Host "`n[Build] Building MSI..."

$wxsFile = Join-Path $scriptRoot 'Product.wxs'
$wixObjFile = Join-Path $OutputPath 'Product.wixobj'
$msiFile = Join-Path $OutputPath 'EasyliWindowsAgent.msi'

# Step 4: Compile WiX source
Write-Host "  Compiling WiX source ($wxsFile)..."
& candle.exe `
  -out "$wixObjFile" `
  "-I$scriptRoot" `
  "-I$(Join-Path $env:ProgramFiles 'WiX Toolset v3*\bin')" `
  $wxsFile

if ($LASTEXITCODE -ne 0) {
  throw "WiX compilation failed with exit code $LASTEXITCODE"
}

Write-Host "  ✓ WiX source compiled"

# Step 5: Link WiX object
Write-Host "  Linking WiX object ($wixObjFile)..."
& light.exe `
  -out "$msiFile" `
  "-I$(Join-Path $env:ProgramFiles 'WiX Toolset v3*\bin')" `
  $wixObjFile

if ($LASTEXITCODE -ne 0) {
  throw "WiX linking failed with exit code $LASTEXITCODE"
}

Write-Host "  ✓ MSI created successfully"

# Summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Build Completed Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nOutput:"
Write-Host "  MSI installer: $msiFile"
Write-Host "`nNext steps:"
Write-Host "  1. Distribute EasyliWindowsAgent.msi to target machines"
Write-Host "  2. Run: msiexec /i EasyliWindowsAgent.msi"
Write-Host "  3. Or use the interactive installer UI"
Write-Host ""

# Optional: Sign the MSI
Write-Host "`nNote: Consider signing the MSI with a code signing certificate"
Write-Host "  signtool.exe sign /f certificate.pfx /p password /t http://timestamp.server /d ""Easyli Windows Agent"" ""$msiFile"""
Write-Host ""
