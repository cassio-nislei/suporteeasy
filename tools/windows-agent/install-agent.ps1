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
    return
  }

  Add-MpPreference -ExclusionPath $Path
}

Assert-Administrator

$packageRoot = $PSScriptRoot
$payloadRoot = Join-Path $packageRoot 'payload'
$resolvedInstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$configRoot = Join-Path $resolvedInstallRoot 'config'
$logRoot = Join-Path $resolvedInstallRoot 'logs'
$runRoot = Join-Path $resolvedInstallRoot 'run'
$controlRoot = Join-Path $resolvedInstallRoot 'control'
$manifestPath = Join-Path $resolvedInstallRoot 'install-manifest.json'

if (-not (Test-Path $payloadRoot)) {
  throw "Agent payload directory not found at $payloadRoot. Build the package first with tools/windows-agent/build-package.ps1."
}

if ([string]::IsNullOrWhiteSpace($RunAsUser)) {
  throw 'RunAsUser cannot be empty.'
}

try {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
} catch {
}

Ensure-Directory -Path $resolvedInstallRoot
Copy-Item -Path (Join-Path $payloadRoot '*') -Destination $resolvedInstallRoot -Recurse -Force

foreach ($path in @($configRoot, $logRoot, $runRoot, $controlRoot)) {
  Ensure-Directory -Path $path
}

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

if (-not $SkipDefenderExclusion) {
  Add-DefenderExclusion -Path $resolvedInstallRoot
}

$runnerPath = Join-Path $resolvedInstallRoot 'agent\run-agent-supervisor.ps1'
if (-not (Test-Path $runnerPath)) {
  throw "Installed supervisor runner not found at $runnerPath"
}

$taskAction = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runnerPath`" -BridgePort $BridgePort"
$taskTrigger = New-ScheduledTaskTrigger -AtLogOn -User $RunAsUser
$taskPrincipal = New-ScheduledTaskPrincipal -UserId $RunAsUser -LogonType Interactive -RunLevel Highest
$taskSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $taskTrigger -Principal $taskPrincipal -Settings $taskSettings -Description 'Easyli Windows agent interactive supervisor' -Force | Out-Null

$manifest = [ordered]@{
  installedAt = (Get-Date).ToString('o')
  installRoot = $resolvedInstallRoot
  taskName = $TaskName
  runAsUser = $RunAsUser
  bridgePort = $BridgePort
  defenderExclusionAdded = (-not $SkipDefenderExclusion.IsPresent)
}
$manifest | ConvertTo-Json -Depth 4 | Set-Content -Path $manifestPath -Encoding UTF8

if (-not $SkipStart) {
  Start-ScheduledTask -TaskName $TaskName
}

Write-Output "Easyli Windows agent installed at $resolvedInstallRoot"
Write-Output "Task name: $TaskName"
Write-Output "Run as user: $RunAsUser"
Write-Output "Config file: $configPath"
Write-Output "Logs directory: $logRoot"
