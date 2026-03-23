[CmdletBinding()]
param()

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Easyli Windows Agent - Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$installRoot = "$env:ProgramFiles\Easyli Windows Agent"
$configFile = Join-Path $installRoot 'config\agent-config.json'
$taskName = 'Easyli Windows Agent'
$logDir = Join-Path $installRoot 'logs'

$issues = @()
$warnings = @()
$successes = @()

# 1. Check installation directory
Write-Host "`n[Check 1] Installation Directory"
if (Test-Path $installRoot) {
  Write-Host "✓ Installation directory found: $installRoot" -ForegroundColor Green
  $successes += "Installation directory exists"
} else {
  Write-Host "✗ Installation directory not found: $installRoot" -ForegroundColor Red
  $issues += "Installation directory missing"
}

# 2. Check configuration file
Write-Host "`n[Check 2] Configuration File"
if (Test-Path $configFile) {
  Write-Host "✓ Configuration file found" -ForegroundColor Green
  $successes += "Configuration file exists"
  
  try {
    $config = Get-Content $configFile | ConvertFrom-Json
    Write-Host "  API URL: $($config.EASYLI_API_URL)"
    Write-Host "  Email: $($config.EASYLI_EMAIL)"
    Write-Host "  Port: $($config.EASYLI_AGENT_HOME)"
  } catch {
    Write-Host "⚠ Warning: Could not parse configuration file" -ForegroundColor Yellow
    $warnings += "Configuration file may be invalid"
  }
} else {
  Write-Host "✗ Configuration file not found" -ForegroundColor Red
  $issues += "Configuration file missing"
}

# 3. Check scheduled task
Write-Host "`n[Check 3] Scheduled Task"
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Write-Host "✓ Scheduled task found: '$taskName'" -ForegroundColor Green
  Write-Host "  Status: $($task.State)"
  Write-Host "  Run level: $($task.Principal.RunLevel)"
  $successes += "Scheduled task configured correctly"
  
  if ($task.State -ne 'Ready') {
    Write-Host "⚠ Warning: Task is not in Ready state" -ForegroundColor Yellow
    $warnings += "Scheduled task not in Ready state"
  }
} else {
  Write-Host "✗ Scheduled task not found" -ForegroundColor Red
  $issues += "Scheduled task missing"
}

# 4. Check logs
Write-Host "`n[Check 4] Logs"
if (Test-Path $logDir) {
  Write-Host "✓ Logs directory found" -ForegroundColor Green
  $logFiles = Get-ChildItem -Path $logDir -ErrorAction SilentlyContinue
  if ($logFiles) {
    Write-Host "  Recent logs:"
    $logFiles | Select-Object -Last 3 | ForEach-Object {
      Write-Host "    - $($_.Name) ($('{0:N0}' -f $_.Length) bytes)"
    }
    $successes += "Logs being generated"
  } else {
    Write-Host "⚠ Warning: No log files generated yet" -ForegroundColor Yellow
    $warnings += "No logs generated yet (agent may not have run)"
  }
} else {
  Write-Host "⚠ Logs directory not found" -ForegroundColor Yellow
  $warnings += "Logs directory not yet created"
}

# 5. Check firewall rules
Write-Host "`n[Check 5] Windows Firewall Rules"
$fwRules = Get-NetFirewallRule -DisplayName "*Easyli*" -ErrorAction SilentlyContinue
if ($fwRules) {
  Write-Host "✓ Firewall rules found" -ForegroundColor Green
  $fwRules | ForEach-Object {
    Write-Host "  - $($_.DisplayName) (Direction: $($_.Direction), Enabled: $($_.Enabled))"
  }
  $successes += "Firewall rules configured"
} else {
  Write-Host "⚠ No Easyli firewall rules found" -ForegroundColor Yellow
  $warnings += "Firewall rules not configured"
}

# 6. Check Defender exclusion
Write-Host "`n[Check 6] Microsoft Defender Exclusion"
try {
  $defenderStatus = Get-MpPreference -ErrorAction SilentlyContinue
  if ($defenderStatus.ExclusionPath -contains $installRoot) {
    Write-Host "✓ Defender exclusion found" -ForegroundColor Green
    $successes += "Defender exclusion configured"
  } else {
    Write-Host "⚠ Defender exclusion not found" -ForegroundColor Yellow
    $warnings += "Defender exclusion not configured"
  }
} catch {
  Write-Host "⚠ Could not check Defender status" -ForegroundColor Yellow
  $warnings += "Could not verify Defender configuration"
}

# 7. Check Node.js runtime
Write-Host "`n[Check 7] Node.js Runtime"
$nodeExe = Join-Path $installRoot 'bin\node.exe'
if (Test-Path $nodeExe) {
  Write-Host "✓ Node.js runtime found" -ForegroundColor Green
  try {
    $nodeVersion = & $nodeExe --version 2>&1
    Write-Host "  Version: $nodeVersion" -ForegroundColor Green
    $successes += "Node.js runtime available"
  } catch {
    Write-Host "⚠ Could not determine Node.js version" -ForegroundColor Yellow
    $warnings += "Node.js version check failed"
  }
} else {
  Write-Host "✗ Node.js runtime not found" -ForegroundColor Red
  $issues += "Node.js runtime missing"
}

# 8. Check manifest
Write-Host "`n[Check 8] Installation Manifest"
$manifestFile = Join-Path $installRoot 'install-manifest.json'
if (Test-Path $manifestFile) {
  Write-Host "✓ Installation manifest found" -ForegroundColor Green
  try {
    $manifest = Get-Content $manifestFile | ConvertFrom-Json
    Write-Host "  Installed at: $($manifest.installedAt)"
    Write-Host "  User: $($manifest.runAsUser)"
  } catch {
    Write-Host "⚠ Could not parse manifest" -ForegroundColor Yellow
  }
} else {
  Write-Host "⚠ Installation manifest not found" -ForegroundColor Yellow
}

# Summary
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Verification Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host "`n✓ Passed Checks: $($successes.Count)"
if ($successes.Count -gt 0) {
  $successes | ForEach-Object { Write-Host "  ✓ $_" -ForegroundColor Green }
}

if ($warnings.Count -gt 0) {
  Write-Host "`n⚠ Warnings: $($warnings.Count)" -ForegroundColor Yellow
  $warnings | ForEach-Object { Write-Host "  ⚠ $_" -ForegroundColor Yellow }
}

if ($issues.Count -gt 0) {
  Write-Host "`n✗ Critical Issues: $($issues.Count)" -ForegroundColor Red
  $issues | ForEach-Object { Write-Host "  ✗ $_" -ForegroundColor Red }
    Write-Host "`nThe installation appears to have issues. Please run the installer again."
} else {
  Write-Host "`n✓ Installation verification passed!" -ForegroundColor Green
  Write-Host "`nThe Easyli Windows Agent is properly installed and configured."
}

Write-Host "`nNext steps:"
Write-Host "  1. Reboot the machine for scheduled task to take effect"
Write-Host "  2. Verify agent appears in Easyli web console"
Write-Host "  3. Check logs at: $logDir"
Write-Host "`n"
