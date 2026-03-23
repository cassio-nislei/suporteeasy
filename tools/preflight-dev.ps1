param(
  [ValidateSet('dev', 'start')][string]$WebMode = 'dev',
  [int]$WebPort = 3000,
  [int]$ApiPort = 3001
)

$ErrorActionPreference = 'Stop'

function Write-Check {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][string]$Message
  )

  Write-Host ("[{0}] {1}" -f $Status, $Message)
}

function Get-ListeningProcessIds {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $matches = netstat -ano | Select-String (":{0}\s" -f $Port)
  $processIds = @()

  foreach ($match in $matches) {
    $line = ($match.Line -replace '^\s+', '') -replace '\s+', ' '
    $parts = $line.Split(' ')
    if ($parts.Length -ge 5 -and $parts[0] -eq 'TCP' -and $parts[3] -eq 'LISTENING') {
      $processIds += $parts[4]
    }
  }

  return $processIds | Sort-Object -Unique
}

function Test-PortFree {
  param(
    [Parameter(Mandatory = $true)][int]$Port
  )

  $processIds = Get-ListeningProcessIds -Port $Port
  if ($processIds.Count -eq 0) {
    return @{
      IsFree = $true
      ProcessIds = @()
    }
  }

  return @{
    IsFree = $false
    ProcessIds = $processIds
  }
}

function Test-RequiredPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Label
  )

  if (Test-Path $Path) {
    Write-Check -Status 'PASS' -Message ("{0} encontrado em {1}" -f $Label, $Path)
    return $true
  }

  Write-Check -Status 'FAIL' -Message ("{0} ausente em {1}" -f $Label, $Path)
  return $false
}

function Test-EnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowNull()][object]$Fallback = $null
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if (![string]::IsNullOrWhiteSpace($value)) {
    Write-Check -Status 'PASS' -Message ("{0} definido" -f $Name)
    return $true
  }

  if ($PSBoundParameters.ContainsKey('Fallback')) {
    Write-Check -Status 'WARN' -Message ("{0} nao definido. Usando fallback esperado: {1}" -f $Name, $Fallback)
    return $true
  }

  Write-Check -Status 'WARN' -Message ("{0} nao definido" -f $Name)
  return $false
}

function Test-NodeSpawnSupport {
  $command = "const { spawnSync } = require('child_process'); const result = spawnSync(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'pipe' }); if (result.error) { console.error(result.error.code || result.error.message); process.exit(1); } process.exit(result.status ?? 0);"

  $tempBase = Join-Path ([System.IO.Path]::GetTempPath()) ("codex-preflight-" + [Guid]::NewGuid().ToString('N'))
  $scriptPath = "$tempBase.js"
  $stdoutPath = "$tempBase.out.log"
  $stderrPath = "$tempBase.err.log"

  try {
    Set-Content -Path $scriptPath -Value $command -Encoding ASCII
    $process = Start-Process -FilePath node.exe -ArgumentList $scriptPath -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
    $exitCode = $process.ExitCode
    $stdout = if (Test-Path $stdoutPath) { Get-Content $stdoutPath -Raw } else { '' }
    $stderr = if (Test-Path $stderrPath) { Get-Content $stderrPath -Raw } else { '' }
    $output = @($stdout, $stderr) -join [Environment]::NewLine
  } finally {
    foreach ($path in @($scriptPath, $stdoutPath, $stderrPath)) {
      if (Test-Path $path) {
        Remove-Item $path -Force
      }
    }
  }

  if ($exitCode -eq 0) {
    Write-Check -Status 'PASS' -Message 'child_process.spawn esta disponivel para o web dev'
    return $true
  }

  $reason = ($output | Out-String).Trim()
  if ([string]::IsNullOrWhiteSpace($reason)) {
    $reason = 'erro desconhecido'
  }

  Write-Check -Status 'FAIL' -Message ("child_process.spawn falhou: {0}" -f $reason)
  return $false
}

Write-Output '== Preflight de desenvolvimento =='
Write-Output ("Diretorio: {0}" -f (Get-Location).Path)

$hasIssues = $false

Write-Output ''
Write-Output 'API'

if (-not (Test-RequiredPath -Path 'apps\api\package.json' -Label 'package do api')) {
  $hasIssues = $true
}

if (-not (Test-RequiredPath -Path 'apps\api\node_modules' -Label 'dependencias do api')) {
  $hasIssues = $true
}

if (-not (Test-EnvValue -Name 'MONGODB_URI')) {
  $hasIssues = $true
}

$queuesDisabled = [Environment]::GetEnvironmentVariable('DISABLE_QUEUES')
if ($queuesDisabled -eq 'true') {
  Write-Check -Status 'PASS' -Message 'DISABLE_QUEUES=true'
} else {
  if (-not (Test-EnvValue -Name 'REDIS_HOST' -Fallback 'localhost')) {
    $hasIssues = $true
  }
  if (-not (Test-EnvValue -Name 'REDIS_PORT' -Fallback '6379')) {
    $hasIssues = $true
  }
}

$apiPortCheck = Test-PortFree -Port $apiPort
if ($apiPortCheck.IsFree) {
  Write-Check -Status 'PASS' -Message ("porta {0} livre para o api" -f $apiPort)
} else {
  Write-Check -Status 'FAIL' -Message ("porta {0} ocupada pelos PIDs: {1}" -f $apiPort, ($apiPortCheck.ProcessIds -join ', '))
  $hasIssues = $true
}

Write-Output ''
Write-Output 'WEB'

if (-not (Test-RequiredPath -Path 'apps\web\package.json' -Label 'package do web')) {
  $hasIssues = $true
}

if (-not (Test-RequiredPath -Path 'apps\web\node_modules' -Label 'dependencias do web')) {
  $hasIssues = $true
}

if (-not (Test-EnvValue -Name 'NEXT_PUBLIC_API_URL' -Fallback '/backend-api')) {
  $hasIssues = $true
}

if (-not (Test-EnvValue -Name 'NEXT_PUBLIC_APP_URL' -Fallback ("http://localhost:{0}" -f $WebPort))) {
  $hasIssues = $true
}

$webPortCheck = Test-PortFree -Port $webPort
if ($webPortCheck.IsFree) {
  Write-Check -Status 'PASS' -Message ("porta {0} livre para o web" -f $webPort)
} else {
  Write-Check -Status 'FAIL' -Message ("porta {0} ocupada pelos PIDs: {1}" -f $webPort, ($webPortCheck.ProcessIds -join ', '))
  $hasIssues = $true
}

if ($WebMode -eq 'dev') {
  if (-not (Test-NodeSpawnSupport)) {
    $hasIssues = $true
  }
} else {
  Write-Check -Status 'PASS' -Message 'modo next start selecionado: child_process.spawn do next dev nao e necessario'
}

Write-Output ''
if ($hasIssues) {
  Write-Check -Status 'FAIL' -Message 'Preflight concluiu com bloqueios. Corrija os itens acima antes de iniciar os servicos.'
  exit 1
}

Write-Check -Status 'PASS' -Message 'Preflight concluiu sem bloqueios.'
