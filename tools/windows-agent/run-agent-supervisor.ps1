[CmdletBinding()]
param(
  [int]$BridgePort = 37609,
  [int]$RestartDelaySeconds = 5,
  [int]$MaxRestartDelaySeconds = 60
)

$ErrorActionPreference = 'Stop'

$agentHome = if ($env:EASYLI_AGENT_HOME) {
  [System.IO.Path]::GetFullPath($env:EASYLI_AGENT_HOME)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
}
$configPath = Join-Path $agentHome 'config\agent-config.json'
$logRoot = Join-Path $agentHome 'logs'
$runRoot = Join-Path $agentHome 'run'
$controlRoot = Join-Path $agentHome 'control'
$launcherPath = Join-Path $PSScriptRoot 'launch-agent.ps1'
$supervisorLog = Join-Path $logRoot 'windows-agent-supervisor.log'
$supervisorPidFile = Join-Path $runRoot 'windows-agent-supervisor.pid'
$stopFile = Join-Path $controlRoot 'stop'

foreach ($path in @($logRoot, $runRoot, $controlRoot)) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Write-SupervisorLog([string]$Message) {
  $timestamp = (Get-Date).ToString('o')
  Add-Content -Path $supervisorLog -Value "[$timestamp] $Message"
}

function Read-AgentConfig([string]$Path) {
  if (-not (Test-Path $Path)) {
    throw "Agent config file not found at $Path"
  }

  $raw = Get-Content -Path $Path -Raw
  if ([string]::IsNullOrWhiteSpace($raw)) {
    throw "Agent config file at $Path is empty."
  }

  return $raw | ConvertFrom-Json
}

function Apply-AgentConfiguration($Config) {
  foreach ($property in $Config.PSObject.Properties) {
    if ([string]::IsNullOrWhiteSpace($property.Name)) {
      continue
    }

    if ($null -eq $property.Value) {
      continue
    }

    Set-Item -Path ("Env:{0}" -f $property.Name) -Value ([string]$property.Value)
  }

  foreach ($required in @('EASYLI_API_URL', 'EASYLI_EMAIL', 'EASYLI_PASSWORD')) {
    $envVar = Get-Item -Path ("Env:{0}" -f $required) -ErrorAction SilentlyContinue
    if ($null -eq $envVar -or [string]::IsNullOrWhiteSpace([string]$envVar.Value)) {
      throw "Required agent setting '$required' is missing from $configPath"
    }
  }

  $env:EASYLI_AGENT_HOME = $agentHome
  $env:EASYLI_AGENT_LOG_DIR = $logRoot
}

$PID | Set-Content -Path $supervisorPidFile
$delaySeconds = [Math]::Max(3, $RestartDelaySeconds)

try {
  Write-SupervisorLog "supervisor starting bridgePort=$BridgePort"

  while ($true) {
    if (Test-Path $stopFile) {
      Write-SupervisorLog 'stop file detected before launch; supervisor exiting'
      break
    }

    $config = Read-AgentConfig -Path $configPath
    Apply-AgentConfiguration -Config $config

    $sessionStamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $sessionLog = Join-Path $logRoot "windows-agent-session-$sessionStamp.log"
    Write-SupervisorLog "starting agent launcher log=$sessionLog"

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $launcherPath -BridgePort $BridgePort *>> $sessionLog
    $exitCode = $LASTEXITCODE

    if (Test-Path $stopFile) {
      Write-SupervisorLog "stop file detected after launcher exit code=$exitCode"
      break
    }

    Write-SupervisorLog "launcher exited code=$exitCode; restart in $delaySeconds second(s)"
    Start-Sleep -Seconds $delaySeconds
    $delaySeconds = [Math]::Min([Math]::Max($delaySeconds * 2, 3), [Math]::Max($MaxRestartDelaySeconds, 5))
  }
} catch {
  Write-SupervisorLog "supervisor fatal error: $($_.Exception.Message)"
  throw
} finally {
  if (Test-Path $supervisorPidFile) {
    Remove-Item -Path $supervisorPidFile -Force -ErrorAction SilentlyContinue
  }

  if (Test-Path $stopFile) {
    Remove-Item -Path $stopFile -Force -ErrorAction SilentlyContinue
  }

  Write-SupervisorLog 'supervisor stopped'
}
