[CmdletBinding()]
param(
  [int]$BridgePort = 37609
)

$ErrorActionPreference = 'Stop'

$agentHome = if ($env:EASYLI_AGENT_HOME) {
  [System.IO.Path]::GetFullPath($env:EASYLI_AGENT_HOME)
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
}
$logRoot = if ($env:EASYLI_AGENT_LOG_DIR) {
  [System.IO.Path]::GetFullPath($env:EASYLI_AGENT_LOG_DIR)
} else {
  Join-Path $agentHome 'logs'
}
$runRoot = Join-Path $agentHome 'run'

foreach ($path in @($logRoot, $runRoot)) {
  if (-not (Test-Path $path)) {
    New-Item -ItemType Directory -Path $path -Force | Out-Null
  }
}

function Resolve-NodeRuntimePath {
  $candidates = @()

  if (-not [string]::IsNullOrWhiteSpace($env:EASYLI_NODE_PATH)) {
    $candidates += $env:EASYLI_NODE_PATH
  }

  $bundledRuntime = Join-Path (Join-Path $agentHome 'bin') 'node.exe'
  $candidates += $bundledRuntime

  foreach ($candidate in $candidates) {
    if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path $candidate)) {
      return [System.IO.Path]::GetFullPath($candidate)
    }
  }

  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "Node.js runtime not found. Expected bundled runtime at $bundledRuntime or node.exe on PATH."
}

$bridgeServerPath = Join-Path $PSScriptRoot 'windows-bridge-server.ps1'
$agentScriptPath = Join-Path $PSScriptRoot 'index.js'
$nodeRuntimePath = Resolve-NodeRuntimePath
$captureBackend = if ($env:EASYLI_CAPTURE_BACKEND) { $env:EASYLI_CAPTURE_BACKEND } else { 'auto' }
$ffmpegPath = if ($env:EASYLI_FFMPEG_PATH) { $env:EASYLI_FFMPEG_PATH } else { 'ffmpeg' }
$bridgeUrl = "http://127.0.0.1:$BridgePort"

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$bridgeOut = Join-Path $logRoot "windows-bridge-live-$timestamp.out.log"
$bridgeErr = Join-Path $logRoot "windows-bridge-live-$timestamp.err.log"
$agentPidFile = Join-Path $runRoot 'windows-agent.pid'
$bridgePidFile = Join-Path $runRoot 'windows-bridge.pid'

$bridgeArgumentList = @(
  '-NoProfile',
  '-STA',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  $bridgeServerPath,
  '-Port',
  $BridgePort.ToString(),
  '-CaptureBackend',
  $captureBackend,
  '-FfmpegPath',
  $ffmpegPath
)

$bridgeProcess = Start-Process -FilePath powershell.exe -ArgumentList $bridgeArgumentList -PassThru -RedirectStandardOutput $bridgeOut -RedirectStandardError $bridgeErr
$PID | Set-Content -Path $agentPidFile
$bridgeProcess.Id | Set-Content -Path $bridgePidFile

try {
  $ready = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 500
    try {
      $health = Invoke-RestMethod -Method Get -Uri "$bridgeUrl/health"
      if ($health.ok) {
        $ready = $true
        break
      }
    } catch {
    }
  }

  if (-not $ready) {
    throw "Local Windows bridge did not become ready at $bridgeUrl. See $bridgeErr"
  }

  $env:EASYLI_LOCAL_BRIDGE_URL = $bridgeUrl
  $env:EASYLI_AGENT_HOME = $agentHome
  $env:EASYLI_AGENT_LOG_DIR = $logRoot
  Write-Output "[windows-agent-launcher] local bridge ready at $bridgeUrl"
  Write-Output "[windows-agent-launcher] node runtime=$nodeRuntimePath"
  & $nodeRuntimePath $agentScriptPath

  if ($LASTEXITCODE -ne 0) {
    throw "Windows agent exited with code $LASTEXITCODE."
  }
} finally {
  if ($bridgeProcess -and -not $bridgeProcess.HasExited) {
    try {
      Invoke-RestMethod -Method Post -Uri "$bridgeUrl/input-lock" -ContentType 'application/json' -Body '{"enabled":false}' | Out-Null
    } catch {
    }

    Stop-Process -Id $bridgeProcess.Id -Force
  }

  foreach ($pidFile in @($agentPidFile, $bridgePidFile)) {
    if (Test-Path $pidFile) {
      Remove-Item -Path $pidFile -Force -ErrorAction SilentlyContinue
    }
  }
}
