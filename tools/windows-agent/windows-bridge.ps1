[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('capture', 'consent', 'pointer-move', 'pointer-down', 'key-press', 'screen-bounds', 'displays')]
  [string]$Action,
  [double]$X,
  [double]$Y,
  [int]$Button = 0,
  [string]$Key,
  [string]$Code,
  [string]$DisplayId,
  [switch]$Ctrl,
  [switch]$Alt,
  [switch]$Shift,
  [switch]$Meta,
  [string]$Title = 'Easyli Remote Access',
  [string]$Message = 'Allow Easyli to view and control this workstation?',
  [int]$TimeoutSeconds = 45,
  [ValidateSet('png', 'jpeg')]
  [string]$ImageFormat = 'jpeg',
  [int]$JpegQuality = 68,
  [int]$MaxWidth = 1280
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class EasyliNativeInput
{
    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetDC(IntPtr hwnd);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int ReleaseDC(IntPtr hwnd, IntPtr hdc);

    [DllImport("user32.dll")]
    public static extern void mouse_event(uint flags, uint dx, uint dy, uint data, IntPtr extraInfo);

    [DllImport("user32.dll")]
    public static extern void keybd_event(byte virtualKey, byte scanCode, uint flags, UIntPtr extraInfo);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteDC(IntPtr hdc);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr CreateCompatibleBitmap(IntPtr hdc, int width, int height);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern IntPtr SelectObject(IntPtr hdc, IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool DeleteObject(IntPtr hObject);

    [DllImport("gdi32.dll", SetLastError = true)]
    public static extern bool BitBlt(
        IntPtr hdcDest,
        int xDest,
        int yDest,
        int width,
        int height,
        IntPtr hdcSrc,
        int xSrc,
        int ySrc,
        int rasterOp
    );
}
"@

function Write-Json([hashtable]$Value) {
  $Value | ConvertTo-Json -Compress -Depth 6 | Write-Output
}

function Get-VirtualScreenBounds {
  return [System.Windows.Forms.SystemInformation]::VirtualScreen
}

function Get-DisplayDescriptors {
  $index = 0
  $descriptors = @()

  foreach ($screen in [System.Windows.Forms.Screen]::AllScreens) {
    $index += 1
    $bounds = $screen.Bounds
    $descriptors += @{
      id = if ([string]::IsNullOrWhiteSpace($screen.DeviceName)) { "display-$index" } else { [string]$screen.DeviceName }
      deviceName = [string]$screen.DeviceName
      label = if ($screen.Primary) { "Monitor $index (Primary)" } else { "Monitor $index" }
      index = $index
      isPrimary = [bool]$screen.Primary
      x = [int]$bounds.X
      y = [int]$bounds.Y
      width = [int]$bounds.Width
      height = [int]$bounds.Height
    }
  }

  return @($descriptors)
}

function Get-SelectedDisplay([string]$RequestedDisplayId) {
  $displays = Get-DisplayDescriptors
  if ($displays.Count -eq 0) {
    throw 'No Windows displays were detected in the current desktop session.'
  }

  if (-not [string]::IsNullOrWhiteSpace($RequestedDisplayId)) {
    $match = $displays | Where-Object { $_.id -eq $RequestedDisplayId } | Select-Object -First 1
    if ($match) {
      return $match
    }
  }

  $primary = $displays | Where-Object { $_.isPrimary } | Select-Object -First 1
  if ($primary) {
    return $primary
  }

  return $displays[0]
}

function Get-DisplayBounds([string]$RequestedDisplayId) {
  $display = Get-SelectedDisplay -RequestedDisplayId $RequestedDisplayId
  return @{
    Display = $display
    X = [int]$display.x
    Y = [int]$display.y
    Width = [int]$display.width
    Height = [int]$display.height
  }
}

function ConvertTo-AbsolutePoint([double]$NormalizedX, [double]$NormalizedY, [string]$RequestedDisplayId) {
  $displaySelection = Get-DisplayBounds -RequestedDisplayId $RequestedDisplayId
  $bounds = $displaySelection
  $targetX = $bounds.X + [Math]::Round(([Math]::Max(0, [Math]::Min(1, $NormalizedX))) * [Math]::Max(1, ($bounds.Width - 1)))
  $targetY = $bounds.Y + [Math]::Round(([Math]::Max(0, [Math]::Min(1, $NormalizedY))) * [Math]::Max(1, ($bounds.Height - 1)))

  return @{
    X = [int]$targetX
    Y = [int]$targetY
    Width = [int]$bounds.Width
    Height = [int]$bounds.Height
    Display = $displaySelection.Display
  }
}

function Escape-SendKeysLiteral([string]$Value) {
  $builder = New-Object System.Text.StringBuilder

  foreach ($character in $Value.ToCharArray()) {
    switch ($character) {
      '+' { [void]$builder.Append('{+}') }
      '^' { [void]$builder.Append('{^}') }
      '%' { [void]$builder.Append('{%}') }
      '~' { [void]$builder.Append('{~}') }
      '(' { [void]$builder.Append('{(}') }
      ')' { [void]$builder.Append('{)}') }
      '{' { [void]$builder.Append('{{}') }
      '}' { [void]$builder.Append('{}}') }
      '[' { [void]$builder.Append('{[}') }
      ']' { [void]$builder.Append('{]}') }
      default { [void]$builder.Append([string]$character) }
    }
  }

  return $builder.ToString()
}

function Get-VirtualKey([string]$PressedKey, [string]$PressedCode) {
  $map = @{
    'Enter' = [int][System.Windows.Forms.Keys]::Enter
    'Tab' = [int][System.Windows.Forms.Keys]::Tab
    'Backspace' = [int][System.Windows.Forms.Keys]::Back
    'Escape' = [int][System.Windows.Forms.Keys]::Escape
    'ArrowLeft' = [int][System.Windows.Forms.Keys]::Left
    'ArrowRight' = [int][System.Windows.Forms.Keys]::Right
    'ArrowUp' = [int][System.Windows.Forms.Keys]::Up
    'ArrowDown' = [int][System.Windows.Forms.Keys]::Down
    'Delete' = [int][System.Windows.Forms.Keys]::Delete
    'Home' = [int][System.Windows.Forms.Keys]::Home
    'End' = [int][System.Windows.Forms.Keys]::End
    'PageUp' = [int][System.Windows.Forms.Keys]::PageUp
    'PageDown' = [int][System.Windows.Forms.Keys]::PageDown
    'Space' = [int][System.Windows.Forms.Keys]::Space
    'Insert' = [int][System.Windows.Forms.Keys]::Insert
    'KeyA' = [int][System.Windows.Forms.Keys]::A
    'KeyB' = [int][System.Windows.Forms.Keys]::B
    'KeyC' = [int][System.Windows.Forms.Keys]::C
    'KeyD' = [int][System.Windows.Forms.Keys]::D
    'KeyE' = [int][System.Windows.Forms.Keys]::E
    'KeyF' = [int][System.Windows.Forms.Keys]::F
    'KeyG' = [int][System.Windows.Forms.Keys]::G
    'KeyH' = [int][System.Windows.Forms.Keys]::H
    'KeyI' = [int][System.Windows.Forms.Keys]::I
    'KeyJ' = [int][System.Windows.Forms.Keys]::J
    'KeyK' = [int][System.Windows.Forms.Keys]::K
    'KeyL' = [int][System.Windows.Forms.Keys]::L
    'KeyM' = [int][System.Windows.Forms.Keys]::M
    'KeyN' = [int][System.Windows.Forms.Keys]::N
    'KeyO' = [int][System.Windows.Forms.Keys]::O
    'KeyP' = [int][System.Windows.Forms.Keys]::P
    'KeyQ' = [int][System.Windows.Forms.Keys]::Q
    'KeyR' = [int][System.Windows.Forms.Keys]::R
    'KeyS' = [int][System.Windows.Forms.Keys]::S
    'KeyT' = [int][System.Windows.Forms.Keys]::T
    'KeyU' = [int][System.Windows.Forms.Keys]::U
    'KeyV' = [int][System.Windows.Forms.Keys]::V
    'KeyW' = [int][System.Windows.Forms.Keys]::W
    'KeyX' = [int][System.Windows.Forms.Keys]::X
    'KeyY' = [int][System.Windows.Forms.Keys]::Y
    'KeyZ' = [int][System.Windows.Forms.Keys]::Z
    'Digit0' = [int][System.Windows.Forms.Keys]::D0
    'Digit1' = [int][System.Windows.Forms.Keys]::D1
    'Digit2' = [int][System.Windows.Forms.Keys]::D2
    'Digit3' = [int][System.Windows.Forms.Keys]::D3
    'Digit4' = [int][System.Windows.Forms.Keys]::D4
    'Digit5' = [int][System.Windows.Forms.Keys]::D5
    'Digit6' = [int][System.Windows.Forms.Keys]::D6
    'Digit7' = [int][System.Windows.Forms.Keys]::D7
    'Digit8' = [int][System.Windows.Forms.Keys]::D8
    'Digit9' = [int][System.Windows.Forms.Keys]::D9
    'F1' = [int][System.Windows.Forms.Keys]::F1
    'F2' = [int][System.Windows.Forms.Keys]::F2
    'F3' = [int][System.Windows.Forms.Keys]::F3
    'F4' = [int][System.Windows.Forms.Keys]::F4
    'F5' = [int][System.Windows.Forms.Keys]::F5
    'F6' = [int][System.Windows.Forms.Keys]::F6
    'F7' = [int][System.Windows.Forms.Keys]::F7
    'F8' = [int][System.Windows.Forms.Keys]::F8
    'F9' = [int][System.Windows.Forms.Keys]::F9
    'F10' = [int][System.Windows.Forms.Keys]::F10
    'F11' = [int][System.Windows.Forms.Keys]::F11
    'F12' = [int][System.Windows.Forms.Keys]::F12
  }

  if ($PressedCode -and $map.ContainsKey($PressedCode)) {
    return $map[$PressedCode]
  }

  if ($PressedKey -and $map.ContainsKey($PressedKey)) {
    return $map[$PressedKey]
  }

  return $null
}

function Send-VirtualKey([int]$VirtualKey, [bool]$UseCtrl, [bool]$UseAlt, [bool]$UseShift, [bool]$UseMeta) {
  $keyUpFlag = 0x0002
  $modifiers = @()

  if ($UseCtrl) {
    $modifiers += [int][System.Windows.Forms.Keys]::ControlKey
  }
  if ($UseAlt) {
    $modifiers += [int][System.Windows.Forms.Keys]::Menu
  }
  if ($UseShift) {
    $modifiers += [int][System.Windows.Forms.Keys]::ShiftKey
  }
  if ($UseMeta) {
    $modifiers += [int][System.Windows.Forms.Keys]::LWin
  }

  foreach ($modifier in $modifiers) {
    [EasyliNativeInput]::keybd_event([byte]$modifier, 0, 0, [UIntPtr]::Zero)
  }

  [EasyliNativeInput]::keybd_event([byte]$VirtualKey, 0, 0, [UIntPtr]::Zero)
  [EasyliNativeInput]::keybd_event([byte]$VirtualKey, 0, $keyUpFlag, [UIntPtr]::Zero)

  foreach ($modifier in ($modifiers | Select-Object -Reverse)) {
    [EasyliNativeInput]::keybd_event([byte]$modifier, 0, $keyUpFlag, [UIntPtr]::Zero)
  }
}

function Show-ConsentDialog([string]$DialogTitle, [string]$DialogMessage, [int]$DialogTimeoutSeconds) {
  $popupFlags = 4 + 32 + 4096 + 65536
  $popupBody = "$DialogMessage`r`n`r`nThis request expires in $DialogTimeoutSeconds seconds."
  $popup = New-Object -ComObject WScript.Shell
  $result = $popup.Popup($popupBody, $DialogTimeoutSeconds, $DialogTitle, $popupFlags)

  return @{
    Granted = $result -eq 6
    TimedOut = $result -eq -1
  }
}

function Get-CaptureDimensions([int]$SourceWidth, [int]$SourceHeight, [int]$RequestedMaxWidth) {
  if ($RequestedMaxWidth -le 0 -or $SourceWidth -le $RequestedMaxWidth) {
    return @{
      Width = $SourceWidth
      Height = $SourceHeight
    }
  }

  $targetWidth = $RequestedMaxWidth
  $targetHeight = [Math]::Max(1, [int][Math]::Round(($SourceHeight * $targetWidth) / [Math]::Max(1, $SourceWidth)))
  return @{
    Width = $targetWidth
    Height = $targetHeight
  }
}

function Get-JpegEncoder() {
  return [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq 'image/jpeg' } |
    Select-Object -First 1
}

function Write-CapturedImage([System.Drawing.Image]$Bitmap, [System.IO.Stream]$Stream, [string]$RequestedImageFormat, [int]$RequestedJpegQuality, [int]$RequestedMaxWidth) {
  $dimensions = Get-CaptureDimensions -SourceWidth $Bitmap.Width -SourceHeight $Bitmap.Height -RequestedMaxWidth $RequestedMaxWidth
  $outputBitmap = $Bitmap
  $graphics = $null
  $disposeOutputBitmap = $false

  try {
    if ($dimensions.Width -ne $Bitmap.Width -or $dimensions.Height -ne $Bitmap.Height) {
      $outputBitmap = New-Object System.Drawing.Bitmap($dimensions.Width, $dimensions.Height)
      $disposeOutputBitmap = $true
      $graphics = [System.Drawing.Graphics]::FromImage($outputBitmap)
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBilinear
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
      $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighSpeed
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighSpeed
      $graphics.DrawImage($Bitmap, 0, 0, $dimensions.Width, $dimensions.Height)
    }

    if ($RequestedImageFormat -eq 'jpeg') {
      $jpegEncoder = Get-JpegEncoder
      if (-not $jpegEncoder) {
        throw 'JPEG encoder is not available in the current Windows session.'
      }

      $quality = [Math]::Max(35, [Math]::Min(95, $RequestedJpegQuality))
      $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters 1
      $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
        [System.Drawing.Imaging.Encoder]::Quality,
        [long]$quality
      )

      try {
        $outputBitmap.Save($Stream, $jpegEncoder, $encoderParams)
      } finally {
        $encoderParams.Dispose()
      }

      return @{
        MimeType = 'image/jpeg'
        Width = $dimensions.Width
        Height = $dimensions.Height
      }
    }

    $outputBitmap.Save($Stream, [System.Drawing.Imaging.ImageFormat]::Png)
    return @{
      MimeType = 'image/png'
      Width = $dimensions.Width
      Height = $dimensions.Height
    }
  } finally {
    if ($graphics) {
      $graphics.Dispose()
    }

    if ($disposeOutputBitmap -and $outputBitmap) {
      $outputBitmap.Dispose()
    }
  }
}

switch ($Action) {
  'displays' {
    $selected = Get-SelectedDisplay -RequestedDisplayId $DisplayId
    Write-Json @{
      ok = $true
      selectedDisplayId = $selected.id
      displays = @(Get-DisplayDescriptors)
    }
  }

  'screen-bounds' {
    $displaySelection = Get-DisplayBounds -RequestedDisplayId $DisplayId
    $display = $displaySelection.Display
    Write-Json @{
      ok = $true
      displayId = [string]$display.id
      displayLabel = [string]$display.label
      x = [int]$displaySelection.X
      y = [int]$displaySelection.Y
      width = [int]$displaySelection.Width
      height = [int]$displaySelection.Height
    }
  }

  'capture' {
    $displaySelection = Get-DisplayBounds -RequestedDisplayId $DisplayId
    $display = $displaySelection.Display
    $desktopDc = [EasyliNativeInput]::GetDC([IntPtr]::Zero)
    if ($desktopDc -eq [IntPtr]::Zero) {
      throw 'Unable to access the desktop device context.'
    }

    $memoryDc = [EasyliNativeInput]::CreateCompatibleDC($desktopDc)
    if ($memoryDc -eq [IntPtr]::Zero) {
      [void][EasyliNativeInput]::ReleaseDC([IntPtr]::Zero, $desktopDc)
      throw 'Unable to create a compatible memory device context.'
    }

    $bitmapHandle = [EasyliNativeInput]::CreateCompatibleBitmap($desktopDc, $displaySelection.Width, $displaySelection.Height)
    if ($bitmapHandle -eq [IntPtr]::Zero) {
      [void][EasyliNativeInput]::DeleteDC($memoryDc)
      [void][EasyliNativeInput]::ReleaseDC([IntPtr]::Zero, $desktopDc)
      throw 'Unable to create a compatible bitmap for screen capture.'
    }

    $previousObject = [EasyliNativeInput]::SelectObject($memoryDc, $bitmapHandle)

    try {
      $copyResult = [EasyliNativeInput]::BitBlt(
        $memoryDc,
        0,
        0,
        $displaySelection.Width,
        $displaySelection.Height,
        $desktopDc,
        $displaySelection.X,
        $displaySelection.Y,
        0x00CC0020
      )

      if (-not $copyResult) {
        $win32Error = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "BitBlt screen capture failed with Win32 error $win32Error. Run the agent inside a logged-in desktop session or use the ffmpeg capture backend."
      }

      $bitmap = [System.Drawing.Image]::FromHbitmap($bitmapHandle)
      $stream = New-Object System.IO.MemoryStream

      try {
        $captureImage = Write-CapturedImage -Bitmap $bitmap -Stream $stream -RequestedImageFormat $ImageFormat -RequestedJpegQuality $JpegQuality -RequestedMaxWidth $MaxWidth
        Write-Json @{
          ok = $true
          mimeType = [string]$captureImage.MimeType
          payload = [Convert]::ToBase64String($stream.ToArray())
          displayId = [string]$display.id
          displayLabel = [string]$display.label
          width = [int]$captureImage.Width
          height = [int]$captureImage.Height
        }
      } finally {
        $bitmap.Dispose()
        $stream.Dispose()
      }
    } finally {
      [void][EasyliNativeInput]::SelectObject($memoryDc, $previousObject)
      [void][EasyliNativeInput]::DeleteObject($bitmapHandle)
      [void][EasyliNativeInput]::DeleteDC($memoryDc)
      [void][EasyliNativeInput]::ReleaseDC([IntPtr]::Zero, $desktopDc)
    }
  }

  'consent' {
    $result = Show-ConsentDialog -DialogTitle $Title -DialogMessage $Message -DialogTimeoutSeconds $TimeoutSeconds
    Write-Json @{
      ok = $true
      granted = [bool]$result.Granted
      timedOut = [bool]$result.TimedOut
    }
  }

  'pointer-move' {
    $point = ConvertTo-AbsolutePoint -NormalizedX $X -NormalizedY $Y -RequestedDisplayId $DisplayId
    [EasyliNativeInput]::SetCursorPos($point.X, $point.Y) | Out-Null

    Write-Json @{
      ok = $true
      x = $point.X
      y = $point.Y
      displayId = [string]$point.Display.id
    }
  }

  'pointer-down' {
    $point = ConvertTo-AbsolutePoint -NormalizedX $X -NormalizedY $Y -RequestedDisplayId $DisplayId
    [EasyliNativeInput]::SetCursorPos($point.X, $point.Y) | Out-Null

    switch ($Button) {
      2 {
        [EasyliNativeInput]::mouse_event(0x0008, 0, 0, 0, [IntPtr]::Zero)
        [EasyliNativeInput]::mouse_event(0x0010, 0, 0, 0, [IntPtr]::Zero)
      }
      1 {
        [EasyliNativeInput]::mouse_event(0x0020, 0, 0, 0, [IntPtr]::Zero)
        [EasyliNativeInput]::mouse_event(0x0040, 0, 0, 0, [IntPtr]::Zero)
      }
      default {
        [EasyliNativeInput]::mouse_event(0x0002, 0, 0, 0, [IntPtr]::Zero)
        [EasyliNativeInput]::mouse_event(0x0004, 0, 0, 0, [IntPtr]::Zero)
      }
    }

    Write-Json @{
      ok = $true
      x = $point.X
      y = $point.Y
      button = $Button
      displayId = [string]$point.Display.id
    }
  }

  'key-press' {
    $virtualKey = Get-VirtualKey -PressedKey $Key -PressedCode $Code

    if (($Key -and $Key.Length -eq 1) -and -not ($Ctrl.IsPresent -or $Alt.IsPresent -or $Meta.IsPresent)) {
      [System.Windows.Forms.SendKeys]::SendWait((Escape-SendKeysLiteral -Value $Key))
      Write-Json @{
        ok = $true
        mode = 'sendkeys'
      }
      break
    }

    if (-not $virtualKey) {
      throw "Unsupported key combination: key='$Key' code='$Code'"
    }

    Send-VirtualKey -VirtualKey $virtualKey -UseCtrl:$Ctrl.IsPresent -UseAlt:$Alt.IsPresent -UseShift:$Shift.IsPresent -UseMeta:$Meta.IsPresent

    Write-Json @{
      ok = $true
      mode = 'virtual-key'
      virtualKey = $virtualKey
    }
  }
}
