# Easyli Windows Agent - Quick Installation Guide

## 📋 Prerequisites

- Windows 10 / Windows Server 2016 or later
- Administrator privileges
- .NET Framework 4.5+ (or higher)
- Node.js installed (for building from source)
- Active internet connection

## 🚀 Quick Start (Recommended)

### Option A: Interactive GUI Installer (Easiest)

1. **Right-click `install.bat`** and select "Run as administrator"
2. **Fill in the configuration form:**
   - API URL (e.g., `http://localhost:3001/api/v1`)
   - Email address for authentication
   - Password
   - Installation path (default: `C:\Program Files\Easyli Windows Agent`)
   - Bridge port (default: 37609)

3. **Click "Install"** and wait for completion

✓ The agent will be installed and automatically started
✓ Windows Firewall rules will be configured
✓ A scheduled task will be created for automatic startup

### Option B: Command-Line Installation

```powershell
# Run PowerShell as Administrator
cd tools\windows-agent

$params = @{
  ApiUrl = 'http://localhost:3001/api/v1'
  Email = 'admin@easyli.local'
  Password = 'ChangeMe@123'
}

.\install-agent-advanced.ps1 @params
```

### Option C: Build MSI for Enterprise Deployment

```powershell
# On development machine with WiX Toolset
cd tools\windows-agent
.\build-msi.ps1 -OutputPath './dist'

# Distribute EasyliWindowsAgent.msi to target machines
msiexec /i EasyliWindowsAgent.msi
```

## ✅ What Gets Configured

- **Scheduled Task**: Runs at every user login (highest privilege)
- **Windows Firewall**: Inbound rules automatically added
- **Microsoft Defender**: Installation directory excluded from scanning
- **Auto-startup**: No manual action needed after reboot

## 📁 Installation Files

After installation at `C:\Program Files\Easyli Windows Agent\`:

```
Easyli Windows Agent/
├── agent/              # Agent scripts (index.js, launch-agent.ps1)
├── bin/                # Node.js runtime
├── config/             # Configuration files
│   └── agent-config.json
├── logs/               # Agent logs
├── run/                # Runtime files
├── control/            # Control files
└── install-manifest.json
```

## 🔧 Configuration

Edit `C:\Program Files\Easyli Windows Agent\config\agent-config.json` to modify:
- API credentials
- Capture settings
- Backend preferences
- Port settings

## 🛑 Uninstallation

### GUI/PowerShell Installation:
```powershell
# Run as Administrator
C:\Program Files\Easyli Windows Agent\uninstall-agent.ps1
```

### MSI Installation:
```batch
msiexec /x EasyliWindowsAgent.msi
```

Or use: **Control Panel** → **Programs** → **Uninstall a program**

## 🔐 Security & Firewall

- **Firewall rules created:**
  - Inbound rules for agent application
  - Local bridge port (37609) for loopback communication

- **Defender exclusion:**
  - Agent installation directory is excluded from scanning

- **Run Level:**
  - Agent runs with Administrator privileges (required for desktop capture)

- **Session Type:**
  - Runs in interactive user session (same as user desktop)

## 📊 Verification

To verify the agent is running:

```powershell
# Check scheduled task status
Get-ScheduledTask -TaskName "Easyli Windows Agent" | Select-Object State

# Check logs
Get-Content "C:\Program Files\Easyli Windows Agent\logs\*" -Tail 50
```

## 🆘 Troubleshooting

### Agent not starting?
- Verify Administrator privileges were used during installation
- Check logs in: `C:\Program Files\Easyli Windows Agent\logs\`
- Verify API URL is accessible

### Firewall issues?
- Check Windows Firewall: **Settings** → **Privacy & Security** → **Windows Security** → **Firewall**
- Rules should be present for "Easyli Windows Agent"

### Defender blocking?
- Verify exclusion exists: **Windows Security** → **Threat & virus protection** → **Manage settings**
- Agent directory should be in the exclusion list

## 📞 Support

For issues or questions:
1. Check agent logs: `C:\Program Files\Easyli Windows Agent\logs\`
2. Verify firewall and Defender configuration
3. Ensure API URL is reachable from the machine
4. Check network connectivity
