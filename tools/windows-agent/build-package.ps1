[CmdletBinding()]
param(
  [string]$OutputRoot = '',
  [switch]$SkipZip
)

$ErrorActionPreference = 'Stop'

$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if ([string]::IsNullOrWhiteSpace($OutputRoot)) {
  $OutputRoot = Join-Path $repoRoot 'dist\windows-agent-package'
}

$resolvedOutputRoot = [System.IO.Path]::GetFullPath($OutputRoot)
$payloadRoot = Join-Path $resolvedOutputRoot 'payload'
$payloadAgentRoot = Join-Path $payloadRoot 'agent'
$payloadConfigRoot = Join-Path $payloadRoot 'config'
$payloadBinRoot = Join-Path $payloadRoot 'bin'
$payloadNodeModulesRoot = Join-Path $payloadRoot 'node_modules'
$sourceNodeModulesRoot = Join-Path $repoRoot 'node_modules'
$zipPath = "$resolvedOutputRoot.zip"

foreach ($path in @($resolvedOutputRoot, $zipPath)) {
  if (Test-Path $path) {
    Remove-Item -Path $path -Recurse -Force
  }
}

foreach ($path in @($payloadAgentRoot, $payloadConfigRoot, $payloadBinRoot, $payloadNodeModulesRoot)) {
  New-Item -ItemType Directory -Path $path -Force | Out-Null
}

function Copy-PackageDependencyTree {
  param(
    [string]$PackageName,
    [hashtable]$Visited
  )

  if ($Visited.ContainsKey($PackageName)) {
    return
  }

  $Visited[$PackageName] = $true
  $relativePackagePath = $PackageName -replace '/', '\\'
  $sourcePackagePath = Join-Path $sourceNodeModulesRoot $relativePackagePath
  $destinationPackagePath = Join-Path $payloadNodeModulesRoot $relativePackagePath

  if (-not (Test-Path $sourcePackagePath)) {
    throw "Required dependency '$PackageName' was not found at $sourcePackagePath"
  }

  $destinationParent = Split-Path -Parent $destinationPackagePath
  if (-not (Test-Path $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  Copy-Item -Path $sourcePackagePath -Destination $destinationParent -Recurse -Force

  $packageJsonPath = Join-Path $sourcePackagePath 'package.json'
  if (-not (Test-Path $packageJsonPath)) {
    return
  }

  $packageJson = Get-Content -Path $packageJsonPath -Raw | ConvertFrom-Json
  if ($null -eq $packageJson.dependencies) {
    return
  }

  foreach ($dependencyProperty in $packageJson.dependencies.PSObject.Properties) {
    Copy-PackageDependencyTree -PackageName $dependencyProperty.Name -Visited $Visited
  }
}

foreach ($scriptName in @(
  'index.js',
  'launch-agent.ps1',
  'run-agent-supervisor.ps1',
  'windows-bridge-server.ps1',
  'windows-bridge.ps1'
)) {
  Copy-Item -Path (Join-Path $PSScriptRoot $scriptName) -Destination $payloadAgentRoot -Force
}

Copy-Item -Path (Join-Path $PSScriptRoot 'agent-config.template.json') -Destination (Join-Path $payloadConfigRoot 'agent-config.template.json') -Force

$nodeRuntimePath = & node -p "process.execPath"
if (-not (Test-Path $nodeRuntimePath)) {
  throw "Resolved node runtime not found at $nodeRuntimePath"
}

Copy-Item -Path $nodeRuntimePath -Destination (Join-Path $payloadBinRoot 'node.exe') -Force

$visitedDependencies = @{}
Copy-PackageDependencyTree -PackageName 'socket.io-client' -Visited $visitedDependencies

Copy-Item -Path (Join-Path $PSScriptRoot 'install-agent.ps1') -Destination (Join-Path $resolvedOutputRoot 'install-agent.ps1') -Force
Copy-Item -Path (Join-Path $PSScriptRoot 'uninstall-agent.ps1') -Destination (Join-Path $resolvedOutputRoot 'uninstall-agent.ps1') -Force
Copy-Item -Path (Join-Path $PSScriptRoot 'install-agent.bat') -Destination (Join-Path $resolvedOutputRoot 'install-agent.bat') -Force
Copy-Item -Path (Join-Path $PSScriptRoot 'uninstall-agent.bat') -Destination (Join-Path $resolvedOutputRoot 'uninstall-agent.bat') -Force

$packageReadme = @"
Easyli Windows Agent package

Files:
- install-agent.ps1 / install-agent.bat
- uninstall-agent.ps1 / uninstall-agent.bat
- payload\\

Install example:
powershell.exe -ExecutionPolicy Bypass -File .\\install-agent.ps1 -ApiUrl 'http://your-api-host:3001/api/v1' -Email 'agent-user@tenant.local' -Password 'ChangeMe@123'
"@
$packageReadme | Set-Content -Path (Join-Path $resolvedOutputRoot 'README.txt') -Encoding UTF8

if (-not $SkipZip) {
  Compress-Archive -Path (Join-Path $resolvedOutputRoot '*') -DestinationPath $zipPath -Force
}

Write-Output "Windows agent package created at $resolvedOutputRoot"
if (-not $SkipZip) {
  Write-Output "Zip archive created at $zipPath"
}
