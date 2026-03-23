[CmdletBinding()]
param(
  [string]$InstallRoot = "$env:ProgramFiles\Easyli Windows Agent",
  [string]$TaskName = 'Easyli Windows Agent',
  [switch]$KeepFiles
)

$ErrorActionPreference = 'Stop'

function Assert-Administrator {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Administrator privileges are required to uninstall the Windows agent package.'
  }
}

function Resolve-InstallMetadata([string]$Root, [string]$DefaultTaskName) {
  $resolvedRoot = [System.IO.Path]::GetFullPath($Root)
  $manifestPath = Join-Path $resolvedRoot 'install-manifest.json'
  if (-not (Test-Path $manifestPath)) {
    return @{
      InstallRoot = $resolvedRoot
      TaskName = $DefaultTaskName
    }
  }

  $manifest = Get-Content -Path $manifestPath -Raw | ConvertFrom-Json
  return @{
    InstallRoot = if ($manifest.installRoot) { [string]$manifest.installRoot } else { $resolvedRoot }
    TaskName = if ($manifest.taskName) { [string]$manifest.taskName } else { $DefaultTaskName }
  }
}

function Stop-PidFileProcess([string]$Path) {
  if (-not (Test-Path $Path)) {
    return
  }

  $pidValue = Get-Content -Path $Path -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($pidValue -match '^\d+$') {
    try {
      Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
    } catch {
    }
  }

  Remove-Item -Path $Path -Force -ErrorAction SilentlyContinue
}

Assert-Administrator

$metadata = Resolve-InstallMetadata -Root $InstallRoot -DefaultTaskName $TaskName
$resolvedInstallRoot = $metadata.InstallRoot
$resolvedTaskName = $metadata.TaskName
$controlRoot = Join-Path $resolvedInstallRoot 'control'
$runRoot = Join-Path $resolvedInstallRoot 'run'
$stopFile = Join-Path $controlRoot 'stop'

if (Test-Path $controlRoot) {
  if (-not (Test-Path $stopFile)) {
    Set-Content -Path $stopFile -Value ((Get-Date).ToString('o'))
  }
}

try {
  Stop-ScheduledTask -TaskName $resolvedTaskName -ErrorAction SilentlyContinue | Out-Null
} catch {
}

try {
  Unregister-ScheduledTask -TaskName $resolvedTaskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {
}

foreach ($pidFileName in @('windows-agent-supervisor.pid', 'windows-agent.pid', 'windows-bridge.pid')) {
  Stop-PidFileProcess -Path (Join-Path $runRoot $pidFileName)
}

$command = Get-Command Remove-MpPreference -ErrorAction SilentlyContinue
if ($command) {
  try {
    $preferences = Get-MpPreference
    if ($preferences.ExclusionPath -contains $resolvedInstallRoot) {
      Remove-MpPreference -ExclusionPath $resolvedInstallRoot
    }
  } catch {
  }
}

if (-not $KeepFiles -and (Test-Path $resolvedInstallRoot)) {
  Remove-Item -Path $resolvedInstallRoot -Recurse -Force
}

Write-Output "Easyli Windows agent uninstalled from $resolvedInstallRoot"
Write-Output "Scheduled task removed: $resolvedTaskName"
