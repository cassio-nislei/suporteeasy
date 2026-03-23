[CmdletBinding()]
param(
  [int]$Port = 37609,
  [ValidateSet('auto', 'powershell', 'ffmpeg')]
  [string]$CaptureBackend = 'auto',
  [string]$FfmpegPath = 'ffmpeg'
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$BridgeScriptPath = Join-Path $PSScriptRoot 'windows-bridge.ps1'
$DefaultCaptureFormat = if ($env:EASYLI_CAPTURE_FORMAT -and $env:EASYLI_CAPTURE_FORMAT.Trim().ToLowerInvariant() -eq 'png') { 'png' } else { 'jpeg' }
$DefaultCaptureJpegQuality = if ($env:EASYLI_CAPTURE_JPEG_QUALITY) { [Math]::Max(35, [Math]::Min(95, [int]$env:EASYLI_CAPTURE_JPEG_QUALITY)) } else { 68 }
$DefaultCaptureMaxWidth = if ($env:EASYLI_CAPTURE_MAX_WIDTH) { [Math]::Max(0, [int]$env:EASYLI_CAPTURE_MAX_WIDTH) } else { 1280 }

function Write-BridgeLog([string]$Message) {
  Write-Output "[windows-bridge-server] $Message"
}

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class EasyliBridgeInputControl
{
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BlockInput(bool blockIt);
}
"@

function Set-LocalInputLock([bool]$Enabled) {
  if ($script:localInputLocked -eq $Enabled) {
    return @{
      ok = $true
      locked = $script:localInputLocked
    }
  }

  $result = [EasyliBridgeInputControl]::BlockInput($Enabled)
  if (-not $result) {
    $win32Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
    throw "BlockInput($Enabled) failed with Win32 error $win32Error."
  }

  $script:localInputLocked = $Enabled
  return @{
    ok = $true
    locked = $script:localInputLocked
  }
}

function Resolve-FfmpegPath([string]$PreferredPath) {
  if ($PreferredPath -and $PreferredPath -ne 'ffmpeg' -and (Test-Path $PreferredPath)) {
    return $PreferredPath
  }

  $wingetPackagesRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $wingetPackagesRoot) {
    $candidate = Get-ChildItem $wingetPackagesRoot -Directory -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like 'Gyan.FFmpeg*' } |
      Sort-Object Name -Descending |
      Select-Object -First 1

    if ($candidate) {
      $binary = Get-ChildItem $candidate.FullName -Recurse -Filter 'ffmpeg.exe' -ErrorAction SilentlyContinue |
        Select-Object -First 1 -ExpandProperty FullName

      if ($binary) {
        return $binary
      }
    }
  }

  $command = Get-Command ffmpeg -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  return $null
}

function Invoke-BridgeAction([string]$Action, [string[]]$Arguments = @()) {
  $commandArguments = @(
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $BridgeScriptPath,
    '-Action',
    $Action
  ) + $Arguments

  $output = & powershell.exe @commandArguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output | Out-String).Trim()
  }

  $text = ($output | Out-String).Trim()
  if (-not $text) {
    return $null
  }

  return $text | ConvertFrom-Json
}

function Get-CaptureSize {
  param(
    [int]$SourceWidth,
    [int]$SourceHeight,
    [int]$MaxWidth
  )

  if ($MaxWidth -le 0 -or $SourceWidth -le $MaxWidth) {
    return @{
      Width = $SourceWidth
      Height = $SourceHeight
    }
  }

  $targetWidth = $MaxWidth
  $targetHeight = [Math]::Max(1, [int][Math]::Round(($SourceHeight * $targetWidth) / [Math]::Max(1, $SourceWidth)))
  return @{
    Width = $targetWidth
    Height = $targetHeight
  }
}

function Get-CaptureActionArguments($Body) {
  $arguments = Get-DisplayActionArguments -Body $Body
  $arguments += @('-ImageFormat', $DefaultCaptureFormat)
  $arguments += @('-JpegQuality', $DefaultCaptureJpegQuality.ToString())
  $arguments += @('-MaxWidth', $DefaultCaptureMaxWidth.ToString())
  return $arguments
}

function Invoke-FfmpegCapture {
  param(
    [string]$BinaryPath,
    [string]$DisplayId,
    [string]$ImageFormat = $DefaultCaptureFormat,
    [int]$JpegQuality = $DefaultCaptureJpegQuality,
    [int]$MaxWidth = $DefaultCaptureMaxWidth
  )

  $boundsArguments = @()
  if (-not [string]::IsNullOrWhiteSpace($DisplayId)) {
    $boundsArguments += @('-DisplayId', $DisplayId)
  }

  $bounds = Invoke-BridgeAction -Action 'screen-bounds' -Arguments $boundsArguments
  if (-not $bounds) {
    throw 'Unable to resolve screen bounds before ffmpeg capture.'
  }

  $captureSize = Get-CaptureSize -SourceWidth $bounds.width -SourceHeight $bounds.height -MaxWidth $MaxWidth
  $isJpeg = $ImageFormat -ne 'png'
  $tempExtension = if ($isJpeg) { 'jpg' } else { 'png' }
  $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("easyli-frame-{0}.{1}" -f ([Guid]::NewGuid().ToString('N'), $tempExtension))

  try {
    $ffmpegArguments = @(
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'gdigrab',
      '-framerate',
      '1',
      '-offset_x',
      $bounds.x,
      '-offset_y',
      $bounds.y,
      '-video_size',
      "$($bounds.width)x$($bounds.height)",
      '-i',
      'desktop'
    )

    if ($captureSize.Width -ne $bounds.width -or $captureSize.Height -ne $bounds.height) {
      $ffmpegArguments += @('-vf', "scale=$($captureSize.Width):-2")
    }

    if ($isJpeg) {
      $qScale = [Math]::Max(2, [Math]::Min(15, [int][Math]::Round((100 - $JpegQuality) / 6.5)))
      $ffmpegArguments += @('-q:v', $qScale)
    }

    $ffmpegArguments += @('-frames:v', '1', $tempFile)

    $ffmpegOutput = & $BinaryPath @ffmpegArguments 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempFile)) {
      $reason = ($ffmpegOutput | Out-String).Trim()
      if ([string]::IsNullOrWhiteSpace($reason)) {
        $reason = 'ffmpeg gdigrab capture failed.'
      }

      throw $reason
    }

    return @{
      ok = $true
      mimeType = if ($isJpeg) { 'image/jpeg' } else { 'image/png' }
      captureBackend = 'ffmpeg'
      payload = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($tempFile))
      displayId = $bounds.displayId
      displayLabel = $bounds.displayLabel
      width = $captureSize.Width
      height = $captureSize.Height
    }
  } finally {
    if (Test-Path $tempFile) {
      Remove-Item $tempFile -Force
    }
  }
}

function Get-DisplayActionArguments($Body) {
  $arguments = @()

  if ($null -ne $Body -and -not [string]::IsNullOrWhiteSpace([string]$Body.displayId)) {
    $arguments += @('-DisplayId', [string]$Body.displayId)
  }

  return $arguments
}

function Invoke-CaptureWithFallback($Body) {
  $displayId = if ($null -ne $Body -and -not [string]::IsNullOrWhiteSpace([string]$Body.displayId)) { [string]$Body.displayId } else { $null }
  $captureArguments = Get-CaptureActionArguments -Body $Body
  $failures = @()

  if ($resolvedBackend -eq 'ffmpeg' -and $resolvedFfmpegPath) {
    try {
      return Invoke-FfmpegCapture -BinaryPath $resolvedFfmpegPath -DisplayId $displayId -ImageFormat $DefaultCaptureFormat -JpegQuality $DefaultCaptureJpegQuality -MaxWidth $DefaultCaptureMaxWidth
    } catch {
      $failures += "ffmpeg: $($_.Exception.Message)"
      if ($CaptureBackend -ne 'auto') {
        throw $_.Exception.Message
      }
    }
  }

  try {
    $result = Invoke-BridgeAction -Action 'capture' -Arguments $captureArguments
    if ($result -is [pscustomobject]) {
      $result | Add-Member -NotePropertyName captureBackend -NotePropertyValue 'powershell' -Force
    }
    return $result
  } catch {
    $failures += "powershell: $($_.Exception.Message)"
  }

  if ($CaptureBackend -eq 'auto' -and $resolvedFfmpegPath -and $resolvedBackend -ne 'ffmpeg') {
    try {
      return Invoke-FfmpegCapture -BinaryPath $resolvedFfmpegPath -DisplayId $displayId -ImageFormat $DefaultCaptureFormat -JpegQuality $DefaultCaptureJpegQuality -MaxWidth $DefaultCaptureMaxWidth
    } catch {
      $failures += "ffmpeg: $($_.Exception.Message)"
    }
  }

  $summary = ($failures | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ' | '
  if ([string]::IsNullOrWhiteSpace($summary)) {
    $summary = 'Desktop capture failed.'
  }

  throw "Desktop capture blocked in the current Windows session. $summary"
}

function Write-HttpJsonResponse([System.IO.Stream]$Stream, [int]$StatusCode, $Body) {
  if (-not $Stream -or -not $Stream.CanWrite) {
    return
  }

  try {
    $json = $Body | ConvertTo-Json -Compress -Depth 8
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $statusText = switch ($StatusCode) {
      200 { 'OK' }
      404 { 'Not Found' }
      500 { 'Internal Server Error' }
      default { 'OK' }
    }

    $header = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
  } catch [System.IO.IOException], [System.ObjectDisposedException], [System.Net.Sockets.SocketException] {
    return
  }
}

function Read-HttpRequest([System.IO.Stream]$Stream) {
  $reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return $null
  }

  $parts = $requestLine.Split(' ')
  $headers = @{}

  while ($true) {
    $line = $reader.ReadLine()
    if ($null -eq $line -or $line -eq '') {
      break
    }

    $separatorIndex = $line.IndexOf(':')
    if ($separatorIndex -lt 0) {
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()
    $headers[$name] = $value
  }

  $contentLength = 0
  if ($headers.ContainsKey('Content-Length')) {
    [void][int]::TryParse($headers['Content-Length'], [ref]$contentLength)
  }

  $bodyText = ''
  if ($contentLength -gt 0) {
    $buffer = New-Object char[] $contentLength
    $read = 0
    while ($read -lt $contentLength) {
      $chunk = $reader.Read($buffer, $read, $contentLength - $read)
      if ($chunk -le 0) {
        break
      }

      $read += $chunk
    }

    $bodyText = New-Object string($buffer, 0, $read)
  }

  return @{
    Method = $parts[0]
    Path = $parts[1].TrimStart('/')
    Body = $bodyText
  }
}

$resolvedFfmpegPath = Resolve-FfmpegPath -PreferredPath $FfmpegPath
$resolvedBackend = if ($CaptureBackend -eq 'auto') {
  if ($resolvedFfmpegPath) { 'ffmpeg' } else { 'powershell' }
} else {
  $CaptureBackend
}
$maxConcurrentBridgeRequests = [Math]::Max(2, [Math]::Min(6, [Environment]::ProcessorCount * 2))
$sharedState = [hashtable]::Synchronized(@{
  LocalInputLocked = $false
  StateLock = New-Object object
})
$serverConfig = @{
  BridgeScriptPath = $BridgeScriptPath
  DefaultCaptureFormat = $DefaultCaptureFormat
  DefaultCaptureJpegQuality = $DefaultCaptureJpegQuality
  DefaultCaptureMaxWidth = $DefaultCaptureMaxWidth
  ResolvedBackend = $resolvedBackend
  ResolvedFfmpegPath = $resolvedFfmpegPath
  CaptureBackend = $CaptureBackend
}
$clientHandlerScript = @'
param($Client, $ServerConfig, $SharedState)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

if (-not ([System.Management.Automation.PSTypeName]'EasyliBridgeInputControl').Type) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class EasyliBridgeInputControl
{
    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool BlockInput(bool blockIt);
}
"@
}

function Invoke-BridgeAction([string]$Action, [string[]]$Arguments = @()) {
  $commandArguments = @(
    '-NoProfile',
    '-STA',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    $ServerConfig['BridgeScriptPath'],
    '-Action',
    $Action
  ) + $Arguments

  $output = & powershell.exe @commandArguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw ($output | Out-String).Trim()
  }

  $text = ($output | Out-String).Trim()
  if (-not $text) {
    return $null
  }

  return $text | ConvertFrom-Json
}

function Get-CaptureSize {
  param(
    [int]$SourceWidth,
    [int]$SourceHeight,
    [int]$MaxWidth
  )

  if ($MaxWidth -le 0 -or $SourceWidth -le $MaxWidth) {
    return @{
      Width = $SourceWidth
      Height = $SourceHeight
    }
  }

  $targetWidth = $MaxWidth
  $targetHeight = [Math]::Max(1, [int][Math]::Round(($SourceHeight * $targetWidth) / [Math]::Max(1, $SourceWidth)))
  return @{
    Width = $targetWidth
    Height = $targetHeight
  }
}

function Get-DisplayActionArguments($Body) {
  $arguments = @()

  if ($null -ne $Body -and -not [string]::IsNullOrWhiteSpace([string]$Body.displayId)) {
    $arguments += @('-DisplayId', [string]$Body.displayId)
  }

  return $arguments
}

function Get-CaptureActionArguments($Body) {
  $arguments = Get-DisplayActionArguments -Body $Body
  $arguments += @('-ImageFormat', $ServerConfig['DefaultCaptureFormat'])
  $arguments += @('-JpegQuality', ([string]$ServerConfig['DefaultCaptureJpegQuality']))
  $arguments += @('-MaxWidth', ([string]$ServerConfig['DefaultCaptureMaxWidth']))
  return $arguments
}

function Invoke-FfmpegCapture {
  param(
    [string]$BinaryPath,
    [string]$DisplayId,
    [string]$ImageFormat = 'jpeg',
    [int]$JpegQuality = 68,
    [int]$MaxWidth = 1280
  )

  $boundsArguments = @()
  if (-not [string]::IsNullOrWhiteSpace($DisplayId)) {
    $boundsArguments += @('-DisplayId', $DisplayId)
  }

  $bounds = Invoke-BridgeAction -Action 'screen-bounds' -Arguments $boundsArguments
  if (-not $bounds) {
    throw 'Unable to resolve screen bounds before ffmpeg capture.'
  }

  $captureSize = Get-CaptureSize -SourceWidth $bounds.width -SourceHeight $bounds.height -MaxWidth $MaxWidth
  $isJpeg = $ImageFormat -ne 'png'
  $tempExtension = if ($isJpeg) { 'jpg' } else { 'png' }
  $tempFile = Join-Path ([System.IO.Path]::GetTempPath()) ("easyli-frame-{0}.{1}" -f ([Guid]::NewGuid().ToString('N'), $tempExtension))

  try {
    $ffmpegArguments = @(
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'gdigrab',
      '-framerate',
      '1',
      '-offset_x',
      $bounds.x,
      '-offset_y',
      $bounds.y,
      '-video_size',
      "$($bounds.width)x$($bounds.height)",
      '-i',
      'desktop'
    )

    if ($captureSize.Width -ne $bounds.width -or $captureSize.Height -ne $bounds.height) {
      $ffmpegArguments += @('-vf', "scale=$($captureSize.Width):-2")
    }

    if ($isJpeg) {
      $qScale = [Math]::Max(2, [Math]::Min(15, [int][Math]::Round((100 - $JpegQuality) / 6.5)))
      $ffmpegArguments += @('-q:v', $qScale)
    }

    $ffmpegArguments += @('-frames:v', '1', $tempFile)

    $ffmpegOutput = & $BinaryPath @ffmpegArguments 2>&1
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $tempFile)) {
      $reason = ($ffmpegOutput | Out-String).Trim()
      if ([string]::IsNullOrWhiteSpace($reason)) {
        $reason = 'ffmpeg gdigrab capture failed.'
      }

      throw $reason
    }

    return @{
      ok = $true
      mimeType = if ($isJpeg) { 'image/jpeg' } else { 'image/png' }
      captureBackend = 'ffmpeg'
      payload = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($tempFile))
      displayId = $bounds.displayId
      displayLabel = $bounds.displayLabel
      width = $captureSize.Width
      height = $captureSize.Height
    }
  } finally {
    if (Test-Path $tempFile) {
      Remove-Item $tempFile -Force
    }
  }
}

function Invoke-CaptureWithFallback($Body) {
  $displayId = if ($null -ne $Body -and -not [string]::IsNullOrWhiteSpace([string]$Body.displayId)) { [string]$Body.displayId } else { $null }
  $captureArguments = Get-CaptureActionArguments -Body $Body
  $failures = @()

  if ($ServerConfig['ResolvedBackend'] -eq 'ffmpeg' -and $ServerConfig['ResolvedFfmpegPath']) {
    try {
      return Invoke-FfmpegCapture -BinaryPath $ServerConfig['ResolvedFfmpegPath'] -DisplayId $displayId -ImageFormat $ServerConfig['DefaultCaptureFormat'] -JpegQuality $ServerConfig['DefaultCaptureJpegQuality'] -MaxWidth $ServerConfig['DefaultCaptureMaxWidth']
    } catch {
      $failures += "ffmpeg: $($_.Exception.Message)"
      if ($ServerConfig['CaptureBackend'] -ne 'auto') {
        throw $_.Exception.Message
      }
    }
  }

  try {
    $result = Invoke-BridgeAction -Action 'capture' -Arguments $captureArguments
    if ($result -is [pscustomobject]) {
      $result | Add-Member -NotePropertyName captureBackend -NotePropertyValue 'powershell' -Force
    }
    return $result
  } catch {
    $failures += "powershell: $($_.Exception.Message)"
  }

  if ($ServerConfig['CaptureBackend'] -eq 'auto' -and $ServerConfig['ResolvedFfmpegPath'] -and $ServerConfig['ResolvedBackend'] -ne 'ffmpeg') {
    try {
      return Invoke-FfmpegCapture -BinaryPath $ServerConfig['ResolvedFfmpegPath'] -DisplayId $displayId -ImageFormat $ServerConfig['DefaultCaptureFormat'] -JpegQuality $ServerConfig['DefaultCaptureJpegQuality'] -MaxWidth $ServerConfig['DefaultCaptureMaxWidth']
    } catch {
      $failures += "ffmpeg: $($_.Exception.Message)"
    }
  }

  $summary = ($failures | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) -join ' | '
  if ([string]::IsNullOrWhiteSpace($summary)) {
    $summary = 'Desktop capture failed.'
  }

  throw "Desktop capture blocked in the current Windows session. $summary"
}

function Write-HttpJsonResponse([System.IO.Stream]$Stream, [int]$StatusCode, $Body) {
  if (-not $Stream -or -not $Stream.CanWrite) {
    return
  }

  try {
    $json = $Body | ConvertTo-Json -Compress -Depth 8
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $statusText = switch ($StatusCode) {
      200 { 'OK' }
      404 { 'Not Found' }
      500 { 'Internal Server Error' }
      default { 'OK' }
    }

    $header = "HTTP/1.1 $StatusCode $statusText`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bodyBytes.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
    $Stream.Write($headerBytes, 0, $headerBytes.Length)
    $Stream.Write($bodyBytes, 0, $bodyBytes.Length)
  } catch [System.IO.IOException], [System.ObjectDisposedException], [System.Net.Sockets.SocketException] {
    return
  }
}

function Read-HttpRequest([System.IO.Stream]$Stream) {
  $reader = New-Object System.IO.StreamReader($Stream, [System.Text.Encoding]::UTF8, $false, 1024, $true)
  $requestLine = $reader.ReadLine()
  if ([string]::IsNullOrWhiteSpace($requestLine)) {
    return $null
  }

  $parts = $requestLine.Split(' ')
  $headers = @{}

  while ($true) {
    $line = $reader.ReadLine()
    if ($null -eq $line -or $line -eq '') {
      break
    }

    $separatorIndex = $line.IndexOf(':')
    if ($separatorIndex -lt 0) {
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1).Trim()
    $headers[$name] = $value
  }

  $contentLength = 0
  if ($headers.ContainsKey('Content-Length')) {
    [void][int]::TryParse($headers['Content-Length'], [ref]$contentLength)
  }

  $bodyText = ''
  if ($contentLength -gt 0) {
    $buffer = New-Object char[] $contentLength
    $read = 0
    while ($read -lt $contentLength) {
      $chunk = $reader.Read($buffer, $read, $contentLength - $read)
      if ($chunk -le 0) {
        break
      }

      $read += $chunk
    }

    $bodyText = New-Object string($buffer, 0, $read)
  }

  return @{
    Method = $parts[0]
    Path = $parts[1].TrimStart('/')
    Body = $bodyText
  }
}

function Get-LocalInputLockState($SharedState) {
  [System.Threading.Monitor]::Enter($SharedState.StateLock)
  try {
    return [bool]$SharedState.LocalInputLocked
  } finally {
    [System.Threading.Monitor]::Exit($SharedState.StateLock)
  }
}

function Set-LocalInputLock([bool]$Enabled, $SharedState) {
  [System.Threading.Monitor]::Enter($SharedState.StateLock)
  try {
    if ([bool]$SharedState.LocalInputLocked -eq $Enabled) {
      return @{
        ok = $true
        locked = [bool]$SharedState.LocalInputLocked
      }
    }

    $result = [EasyliBridgeInputControl]::BlockInput($Enabled)
    if (-not $result) {
      $win32Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      throw "BlockInput($Enabled) failed with Win32 error $win32Error."
    }

    $SharedState.LocalInputLocked = $Enabled
    return @{
      ok = $true
      locked = [bool]$SharedState.LocalInputLocked
    }
  } finally {
    [System.Threading.Monitor]::Exit($SharedState.StateLock)
  }
}

$stream = $Client.GetStream()

try {
  $request = Read-HttpRequest -Stream $stream
  if (-not $request) {
    return
  }

  $path = $request.Path.ToLowerInvariant()
  $body = if ([string]::IsNullOrWhiteSpace($request.Body)) { @{} } else { $request.Body | ConvertFrom-Json }

  switch ($path) {
    'health' {
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body @{
        ok = $true
        backend = $ServerConfig['ResolvedBackend']
        ffmpegAvailable = [bool]$ServerConfig['ResolvedFfmpegPath']
        localInputLocked = Get-LocalInputLockState -SharedState $SharedState
      }
    }

    'screen-bounds' {
      $result = Invoke-BridgeAction -Action 'screen-bounds' -Arguments (Get-DisplayActionArguments -Body $body)
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'displays' {
      $result = Invoke-BridgeAction -Action 'displays' -Arguments (Get-DisplayActionArguments -Body $body)
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'capture' {
      $result = Invoke-CaptureWithFallback -Body $body
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'consent' {
      $arguments = @()
      if ($body.title) {
        $arguments += @('-Title', [string]$body.title)
      }
      if ($body.message) {
        $arguments += @('-Message', [string]$body.message)
      }
      if ($body.timeoutSeconds) {
        $arguments += @('-TimeoutSeconds', [string]([int]$body.timeoutSeconds))
      }

      $result = Invoke-BridgeAction -Action 'consent' -Arguments $arguments
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'pointer-move' {
      $arguments = @('-X', [string]$body.x, '-Y', [string]$body.y) + (Get-DisplayActionArguments -Body $body)
      $result = Invoke-BridgeAction -Action 'pointer-move' -Arguments $arguments
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'pointer-down' {
      $arguments = @(
        '-X', [string]$body.x,
        '-Y', [string]$body.y,
        '-Button', [string]([int]$body.button)
      )
      $arguments += Get-DisplayActionArguments -Body $body
      $result = Invoke-BridgeAction -Action 'pointer-down' -Arguments $arguments
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'key-press' {
      $arguments = @()
      if ($body.key) {
        $arguments += @('-Key', [string]$body.key)
      }
      if ($body.code) {
        $arguments += @('-Code', [string]$body.code)
      }
      if ($body.ctrlKey) {
        $arguments += '-Ctrl'
      }
      if ($body.altKey) {
        $arguments += '-Alt'
      }
      if ($body.shiftKey) {
        $arguments += '-Shift'
      }
      if ($body.metaKey) {
        $arguments += '-Meta'
      }

      $result = Invoke-BridgeAction -Action 'key-press' -Arguments $arguments
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    'input-lock' {
      $enabled = $false
      if ($null -ne $body -and $body.PSObject.Properties.Name -contains 'enabled') {
        if ($body.enabled -is [bool]) {
          $enabled = [bool]$body.enabled
        } elseif ($body.enabled -is [string]) {
          $enabled = @('1', 'true', 'yes', 'on') -contains $body.enabled.Trim().ToLowerInvariant()
        } else {
          $enabled = [bool]$body.enabled
        }
      }

      $result = Set-LocalInputLock -Enabled:$enabled -SharedState $SharedState
      Write-HttpJsonResponse -Stream $stream -StatusCode 200 -Body $result
    }

    default {
      Write-HttpJsonResponse -Stream $stream -StatusCode 404 -Body @{
        ok = $false
        message = "Unknown bridge route '$path'."
      }
    }
  }
} catch {
  Write-HttpJsonResponse -Stream $stream -StatusCode 500 -Body @{
    ok = $false
    message = $_.Exception.Message
  }
} finally {
  $stream.Dispose()
  $Client.Close()
}
'@
$runspacePool = [RunspaceFactory]::CreateRunspacePool(1, $maxConcurrentBridgeRequests)
$runspacePool.ApartmentState = 'MTA'
$runspacePool.Open()
$activeWorkers = New-Object System.Collections.ArrayList

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

Write-BridgeLog "listening on http://127.0.0.1:$Port/ backend=$resolvedBackend"
if ($resolvedFfmpegPath) {
  Write-BridgeLog "ffmpeg path=$resolvedFfmpegPath"
}
Write-BridgeLog "capture format=$DefaultCaptureFormat jpegQuality=$DefaultCaptureJpegQuality maxWidth=$DefaultCaptureMaxWidth"
Write-BridgeLog "worker pool=$maxConcurrentBridgeRequests"

function Start-BridgeWorker([System.Net.Sockets.TcpClient]$Client) {
  $worker = [PowerShell]::Create()
  $worker.RunspacePool = $runspacePool
  $null = $worker.AddScript($clientHandlerScript).AddArgument($Client).AddArgument($serverConfig).AddArgument($sharedState)

  try {
    $async = $worker.BeginInvoke()
    [void]$activeWorkers.Add([pscustomobject]@{
      PowerShell = $worker
      Async = $async
    })
  } catch {
    $worker.Dispose()
    try {
      $Client.Close()
    } catch {
    }
    throw
  }
}

function Cleanup-BridgeWorkers([switch]$WaitAll) {
  $completed = @()

  foreach ($entry in @($activeWorkers)) {
    if (-not $WaitAll -and -not $entry.Async.IsCompleted) {
      continue
    }

    try {
      $entry.PowerShell.EndInvoke($entry.Async) | Out-Null
    } catch {
      Write-BridgeLog "worker error: $($_.Exception.Message)"
    } finally {
      $entry.PowerShell.Dispose()
      $completed += $entry
    }
  }

  foreach ($entry in $completed) {
    [void]$activeWorkers.Remove($entry)
  }
}

try {
  while ($listener.Server.IsBound) {
    $client = $listener.AcceptTcpClient()
    $client.NoDelay = $true
    Start-BridgeWorker -Client $client
    Cleanup-BridgeWorkers
  }
} finally {
  Cleanup-BridgeWorkers -WaitAll

  if ([bool]$sharedState.LocalInputLocked) {
    try {
      [EasyliBridgeInputControl]::BlockInput($false) | Out-Null
      $sharedState.LocalInputLocked = $false
    } catch {
    }
  }

  $runspacePool.Close()
  $runspacePool.Dispose()
  $listener.Stop()
}
