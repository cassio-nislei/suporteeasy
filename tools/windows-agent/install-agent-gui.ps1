[CmdletBinding()]
param()

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Função para validar URL
function Test-ValidUrl {
  param([string]$Url)
  try {
    [System.Uri]::new($Url) | Out-Null
    return $true
  } catch {
    return $false
  }
}

# Função para validar email
function Test-ValidEmail {
  param([string]$Email)
  return $Email -match '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
}

# Criar form principal
$form = New-Object System.Windows.Forms.Form
$form.Text = "Easyli Windows Agent Installation"
$form.Size = New-Object System.Drawing.Size(600, 700)
$form.StartPosition = "CenterScreen"
$form.BackColor = [System.Drawing.Color]::White
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false
$form.MinimizeBox = $false

# Painel de título
$titlePanel = New-Object System.Windows.Forms.Panel
$titlePanel.BackColor = [System.Drawing.Color]::FromArgb(0, 120, 215)
$titlePanel.Dock = "Top"
$titlePanel.Height = 80

$titleLabel = New-Object System.Windows.Forms.Label
$titleLabel.Text = "Easyli Windows Agent"
$titleLabel.Font = New-Object System.Drawing.Font("Arial", 18, [System.Drawing.FontStyle]::Bold)
$titleLabel.ForeColor = [System.Drawing.Color]::White
$titleLabel.Dock = "Fill"
$titleLabel.TextAlign = "MiddleCenter"
$titlePanel.Controls.Add($titleLabel)
$form.Controls.Add($titlePanel)

# Painel de conteúdo com scroll
$scrollPanel = New-Object System.Windows.Forms.Panel
$scrollPanel.Dock = "Fill"
$scrollPanel.AutoScroll = $true
$scrollPanel.Padding = "20, 20, 20, 100"

# ========== CAMPOS DE ENTRADA ==========

$yOffset = 10

# API URL
$labelApiUrl = New-Object System.Windows.Forms.Label
$labelApiUrl.Text = "API URL *"
$labelApiUrl.Location = New-Object System.Drawing.Point(10, $yOffset)
$labelApiUrl.Size = New-Object System.Drawing.Size(300, 20)
$labelApiUrl.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($labelApiUrl)

$textApiUrl = New-Object System.Windows.Forms.TextBox
$textApiUrl.Text = "http://localhost:3001/api/v1"
$textApiUrl.Location = New-Object System.Drawing.Point(10, ($yOffset + 25))
$textApiUrl.Size = New-Object System.Drawing.Size(400, 25)
$textApiUrl.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($textApiUrl)

$yOffset += 60

# Email
$labelEmail = New-Object System.Windows.Forms.Label
$labelEmail.Text = "Email *"
$labelEmail.Location = New-Object System.Drawing.Point(10, $yOffset)
$labelEmail.Size = New-Object System.Drawing.Size(300, 20)
$labelEmail.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($labelEmail)

$textEmail = New-Object System.Windows.Forms.TextBox
$textEmail.Text = "admin@easyli.local"
$textEmail.Location = New-Object System.Drawing.Point(10, ($yOffset + 25))
$textEmail.Size = New-Object System.Drawing.Size(400, 25)
$textEmail.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($textEmail)

$yOffset += 60

# Senha
$labelPassword = New-Object System.Windows.Forms.Label
$labelPassword.Text = "Password *"
$labelPassword.Location = New-Object System.Drawing.Point(10, $yOffset)
$labelPassword.Size = New-Object System.Drawing.Size(300, 20)
$labelPassword.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($labelPassword)

$textPassword = New-Object System.Windows.Forms.TextBox
$textPassword.Text = "ChangeMe@123"
$textPassword.UseSystemPasswordChar = $true
$textPassword.Location = New-Object System.Drawing.Point(10, ($yOffset + 25))
$textPassword.Size = New-Object System.Drawing.Size(400, 25)
$textPassword.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($textPassword)

$yOffset += 60

# Caminho de instalação
$labelInstallPath = New-Object System.Windows.Forms.Label
$labelInstallPath.Text = "Installation Path"
$labelInstallPath.Location = New-Object System.Drawing.Point(10, $yOffset)
$labelInstallPath.Size = New-Object System.Drawing.Size(300, 20)
$labelInstallPath.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($labelInstallPath)

$textInstallPath = New-Object System.Windows.Forms.TextBox
$textInstallPath.Text = "$env:ProgramFiles\Easyli Windows Agent"
$textInstallPath.Location = New-Object System.Drawing.Point(10, ($yOffset + 25))
$textInstallPath.Size = New-Object System.Drawing.Size(400, 25)
$textInstallPath.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($textInstallPath)

$yOffset += 60

# Porta Bridge
$labelBridgePort = New-Object System.Windows.Forms.Label
$labelBridgePort.Text = "Bridge Port"
$labelBridgePort.Location = New-Object System.Drawing.Point(10, $yOffset)
$labelBridgePort.Size = New-Object System.Drawing.Size(300, 20)
$labelBridgePort.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($labelBridgePort)

$textBridgePort = New-Object System.Windows.Forms.NumericUpDown
$textBridgePort.Value = 37609
$textBridgePort.Minimum = 1024
$textBridgePort.Maximum = 65535
$textBridgePort.Location = New-Object System.Drawing.Point(10, ($yOffset + 25))
$textBridgePort.Size = New-Object System.Drawing.Size(100, 25)
$textBridgePort.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($textBridgePort)

$yOffset += 60

# Checkboxes
$checkEnableInput = New-Object System.Windows.Forms.CheckBox
$checkEnableInput.Text = "Enable Local Input Control (mouse/keyboard)"
$checkEnableInput.Checked = $true
$checkEnableInput.Location = New-Object System.Drawing.Point(10, $yOffset)
$checkEnableInput.Size = New-Object System.Drawing.Size(400, 25)
$checkEnableInput.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($checkEnableInput)

$yOffset += 40

$checkDefenderExclusion = New-Object System.Windows.Forms.CheckBox
$checkDefenderExclusion.Text = "Add Windows Defender Exclusion"
$checkDefenderExclusion.Checked = $true
$checkDefenderExclusion.Location = New-Object System.Drawing.Point(10, $yOffset)
$checkDefenderExclusion.Size = New-Object System.Drawing.Size(400, 25)
$checkDefenderExclusion.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($checkDefenderExclusion)

$yOffset += 40

$checkFirewall = New-Object System.Windows.Forms.CheckBox
$checkFirewall.Text = "Configure Windows Firewall Rules"
$checkFirewall.Checked = $true
$checkFirewall.Location = New-Object System.Drawing.Point(10, $yOffset)
$checkFirewall.Size = New-Object System.Drawing.Size(400, 25)
$checkFirewall.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($checkFirewall)

$yOffset += 40

$checkAutoStart = New-Object System.Windows.Forms.CheckBox
$checkAutoStart.Text = "Automatically Start After Installation"
$checkAutoStart.Checked = $true
$checkAutoStart.Location = New-Object System.Drawing.Point(10, $yOffset)
$checkAutoStart.Size = New-Object System.Drawing.Size(400, 25)
$checkAutoStart.Font = New-Object System.Drawing.Font("Arial", 10)
$scrollPanel.Controls.Add($checkAutoStart)

$form.Controls.Add($scrollPanel)

# ========== BOTÕES ==========

$panelButtons = New-Object System.Windows.Forms.Panel
$panelButtons.Dock = "Bottom"
$panelButtons.Height = 50
$panelButtons.BackColor = [System.Drawing.Color]::LightGray

$buttonInstall = New-Object System.Windows.Forms.Button
$buttonInstall.Text = "Install"
$buttonInstall.Location = New-Object System.Drawing.Point(400, 10)
$buttonInstall.Size = New-Object System.Drawing.Size(100, 30)
$buttonInstall.BackColor = [System.Drawing.Color]::Green
$buttonInstall.ForeColor = [System.Drawing.Color]::White
$buttonInstall.Font = New-Object System.Drawing.Font("Arial", 10, [System.Drawing.FontStyle]::Bold)
$panelButtons.Controls.Add($buttonInstall)

$buttonCancel = New-Object System.Windows.Forms.Button
$buttonCancel.Text = "Cancel"
$buttonCancel.Location = New-Object System.Drawing.Point(510, 10)
$buttonCancel.Size = New-Object System.Drawing.Size(70, 30)
$panelButtons.Controls.Add($buttonCancel)

$form.Controls.Add($panelButtons)

# ========== EVENTOS ==========

$buttonCancel.Add_Click({
  $form.Close()
})

$buttonInstall.Add_Click({
  # Validação
  if ([string]::IsNullOrWhiteSpace($textApiUrl.Text)) {
    [System.Windows.Forms.MessageBox]::Show("API URL is required", "Validation Error", "OK", "Error")
    return
  }

  if (-not (Test-ValidUrl $textApiUrl.Text)) {
    [System.Windows.Forms.MessageBox]::Show("Invalid API URL format", "Validation Error", "OK", "Error")
    return
  }

  if ([string]::IsNullOrWhiteSpace($textEmail.Text)) {
    [System.Windows.Forms.MessageBox]::Show("Email is required", "Validation Error", "OK", "Error")
    return
  }

  if (-not (Test-ValidEmail $textEmail.Text)) {
    [System.Windows.Forms.MessageBox]::Show("Invalid email format", "Validation Error", "OK", "Error")
    return
  }

  if ([string]::IsNullOrWhiteSpace($textPassword.Text)) {
    [System.Windows.Forms.MessageBox]::Show("Password is required", "Validation Error", "OK", "Error")
    return
  }

  # Verifique se é Admin
  $isAdmin = ([Security.Principal.WindowsIdentity]::GetCurrent().Groups | Where-Object { $_.Value -eq 'S-1-5-32-544' }) -ne $null
  if (-not $isAdmin) {
    [System.Windows.Forms.MessageBox]::Show("Administrator privileges are required to install the agent", "Permission Denied", "OK", "Error")
    return
  }

  # Fechar form
  $form.Close()

  # Executar instalação
  $installScriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'install-agent-advanced.ps1'

  $params = @{
    ApiUrl = $textApiUrl.Text
    Email = $textEmail.Text
    Password = $textPassword.Text
    InstallRoot = $textInstallPath.Text
    BridgePort = [int]$textBridgePort.Value
    DisableLocalInputControl = -not $checkEnableInput.Checked
    SkipDefenderExclusion = -not $checkDefenderExclusion.Checked
    SkipFirewallConfig = -not $checkFirewall.Checked
    SkipStart = -not $checkAutoStart.Checked
  }

  & $installScriptPath @params
})

# Exibir form
$form.ShowDialog() | Out-Null
