[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$ApiUrl,

  [Parameter(Mandatory = $true)]
  [string]$Email,

  [Parameter(Mandatory = $true)]
  [string]$Password,

  [string]$WsUrl,
  [string]$InstallRoot = "$env:ProgramFiles\Easyli Windows Agent",
  [string]$TaskName = 'Easyli Windows Agent',
  [string]$RunAsUser = "$env:USERDOMAIN\$env:USERNAME",
  [switch]$SkipDefenderExclusion,
  [switch]$SkipFirewallConfig,
  [switch]$SkipStart,
  [switch]$DisableLocalInputControl,
  [ValidateSet('auto', 'powershell', 'ffmpeg')]
  [string]$CaptureBackend = 'auto',
  [string]$FfmpegPath = 'ffmpeg',
  [int]$BridgePort = 37609,
  [int]$CaptureIntervalMs = 250,
  [int]$InputFeedbackFrameDebounceMs = 80,
  [int]$CapturePauseAfterInputMs = 600,
  [int]$CapturePauseAfterDisplaySwitchMs = 1200
)

$ErrorActionPreference = 'Stop'

# ======================================
# UTILITY FUNCTIONS
# ======================================

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to install the Windows agent package.'
  }
}

function Ensure-Directory([string]$Path) {
  if (-not (Test-Path $Path)) {
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
  }
}

function Add-DefenderExclusion([string]$Path) {
  $command = Get-Command Add-MpPreference -ErrorAction SilentlyContinue
  if (-not $command) {
    throw 'Microsoft Defender cmdlets are unavailable. Re-run with -SkipDefenderExclusion only if your endpoint policy manages exclusions elsewhere.'
  }

  $status = Get-MpPreference
  if ($status.ExclusionPath -contains $Path) {
    Write-Host "✓ Defender exclusion already exists for $Path"
    return
  }

  Add-MpPreference -ExclusionPath $Path
  Write-Host "✓ Added Defender exclusion for $Path"
}

function Configure-Firewall([string]$ApplicationPath, [int]$BridgePort) {
  Write-Host "`n[Firewall] Configuring Windows Firewall rules..."

  $ruleName = 'Easyli Windows Agent'
  $existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue

  if ($existingRule) {
    Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
    Write-Host "✓ Removed existing firewall rule"
  }

  try {
    # Regra para o executor principal
    $logFile = Join-Path $InstallRoot 'logs\firewall.log'
    
    New-NetFirewallRule `
      -DisplayName $ruleName `
      -Description 'Easyli Windows Agent - Remote access service' `
      -Program $ApplicationPath `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -Enabled True `
      -ErrorAction Stop | Out-Null

    Write-Host "✓ Added firewall rule for application: $ApplicationPath"

    # Regra para a porta bridge (local loopback)
    New-NetFirewallRule `
      -DisplayName "$ruleName - Bridge Port" `
      -Description "Easyli Windows Agent - Local bridge communication on port $BridgePort" `
      -Direction Inbound `
      -Action Allow `
      -Protocol TCP `
      -LocalPort $BridgePort `
      -LocalAddress 127.0.0.1 `
      -Enabled True `
      -ErrorAction Stop | Out-Null

    Write-Host "✓ Added firewall rule for local bridge port $BridgePort"

  } catch {
    throw "Failed to configure firewall: $_"
  }
}

function Create-ScheduledTask([string]$RunnerPath, [int]$BridgePort, [string]$User) {
  Write-Host "`n[Scheduler] Registering scheduled task..."

  try {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
  } catch {
  }

  $taskAction = New-ScheduledTaskAction `
    -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$RunnerPath`" -BridgePort $BridgePort"

  $taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $User

  $taskPrincipal = New-ScheduledTaskPrincipal `
    -UserId $User `
    -LogonType Interactive `
    -RunLevel Highest

  $taskSettings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -MultipleInstances IgnoreNew

  Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $taskAction `
    -Trigger $taskTrigger `
    -Principal $taskPrincipal `
    -Settings $taskSettings `
    -Description 'Easyli Windows agent interactive supervisor' `
    -Force | Out-Null

  Write-Host "✓ Scheduled task created: $TaskName"
  Write-Host "  Trigger: At user logon"
  Write-Host "  Run level: Highest (Administrator)"
  Write-Host "  Run as: $User"
}

# ======================================
# MAIN INSTALLATION LOGIC
# ======================================

Clear-Host
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Easyli Windows Agent Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Assert-Administrator
Write-Host "`n✓ Administrator privileges verified"

$packageRoot = $PSScriptRoot
$payloadRoot = Join-Path $packageRoot 'payload'
$resolvedInstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$configRoot = Join-Path $resolvedInstallRoot 'config'
$logRoot = Join-Path $resolvedInstallRoot 'logs'
$runRoot = Join-Path $resolvedInstallRoot 'run'
$controlRoot = Join-Path $resolvedInstallRoot 'control'
$manifestPath = Join-Path $resolvedInstallRoot 'install-manifest.json'

if (-not (Test-Path $payloadRoot)) {
  throw "Agent payload directory not found at $payloadRoot. Run build-package.ps1 first."
}

if ([string]::IsNullOrWhiteSpace($RunAsUser)) {
  throw 'RunAsUser cannot be empty.'
}

Write-Host "`n[Installation] Installing to: $resolvedInstallRoot"

# Copy payload
Write-Host "`n[Files] Copying application files..."
Ensure-Directory -Path $resolvedInstallRoot
Copy-Item -Path (Join-Path $payloadRoot '*') -Destination $resolvedInstallRoot -Recurse -Force
Write-Host "✓ Files copied successfully"

# Create directories
foreach ($path in @($configRoot, $logRoot, $runRoot, $controlRoot)) {
  Ensure-Directory -Path $path
}

# Create configuration
Write-Host "`n[Config] Creating configuration file..."
$config = [ordered]@{
  EASYLI_API_URL = $ApiUrl
  EASYLI_EMAIL = $Email
  EASYLI_PASSWORD = $Password
  EASYLI_CAPTURE_BACKEND = $CaptureBackend
  EASYLI_FFMPEG_PATH = $FfmpegPath
  EASYLI_CAPTURE_INTERVAL_MS = $CaptureIntervalMs
  EASYLI_INPUT_FEEDBACK_FRAME_DEBOUNCE_MS = $InputFeedbackFrameDebounceMs
  EASYLI_CAPTURE_PAUSE_AFTER_INPUT_MS = $CapturePauseAfterInputMs
  EASYLI_CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS = $CapturePauseAfterDisplaySwitchMs
  EASYLI_DISABLE_LOCAL_INPUT_CONTROL = if ($DisableLocalInputControl) { 'true' } else { 'false' }
  EASYLI_AGENT_HOME = $resolvedInstallRoot
}

if (-not [string]::IsNullOrWhiteSpace($WsUrl)) {
  $config.EASYLI_WS_URL = $WsUrl
}

$configPath = Join-Path $configRoot 'agent-config.json'
$config | ConvertTo-Json -Depth 8 | Set-Content -Path $configPath -Encoding UTF8
Write-Host "✓ Config saved to: $configPath"

# Defender exclusion
if (-not $SkipDefenderExclusion) {
  Write-Host "`n[Defender] Configuring exclusion..."
  Add-DefenderExclusion -Path $resolvedInstallRoot
}

# Firewall configuration
if (-not $SkipFirewallConfig) {
  $supervisorPath = Join-Path $resolvedInstallRoot 'agent\run-agent-supervisor.ps1'
  if (Test-Path $supervisorPath) {
    Configure-Firewall -ApplicationPath $supervisorPath -BridgePort $BridgePort
  }
}

# Create scheduled task
$runnerPath = Join-Path $resolvedInstallRoot 'agent\run-agent-supervisor.ps1'
if (-not (Test-Path $runnerPath)) {
  throw "Installed supervisor runner not found at $runnerPath"
}

Create-ScheduledTask -RunnerPath $runnerPath -BridgePort $BridgePort -User $RunAsUser

# Create manifest
Write-Host "`n[Manifest] Creating installation manifest..."
$manifest = [ordered]@{
  installedAt = (Get-Date).ToString('o')
  installRoot = $resolvedInstallRoot
  taskName = $TaskName
  runAsUser = $RunAsUser
  bridgePort = $BridgePort
  defenderExclusionAdded = (-not $SkipDefenderExclusion.IsPresent)
  firewallConfigured = (-not $SkipFirewallConfig.IsPresent)
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8
Write-Host "✓ Manifest saved to: $manifestPath"

# Start agent
if (-not $SkipStart) {
  Write-Host "`n[Startup] Starting agent..."
  Start-ScheduledTask -TaskName $TaskName
  Start-Sleep -Seconds 2
  Write-Host "✓ Agent started successfully"
}

# Summary
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Installation Completed Successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "`nAgent Details:"
Write-Host "  Install path:      $resolvedInstallRoot"
Write-Host "  Scheduled task:    $TaskName"
Write-Host "  Run as:            $RunAsUser"
Write-Host "  Config file:       $configPath"
Write-Host "  Logs directory:    $logRoot"
Write-Host "  Bridge port:       $BridgePort"
Write-Host "`nExecution:"
Write-Host "  • Agent will run automatically at user logon"
Write-Host "  • Logs are saved to $logRoot"
Write-Host "  • Firewall rules have been configured"
Write-Host "`nTo uninstall, run: $resolvedInstallRoot\uninstall-agent.ps1"
Write-Host ""
