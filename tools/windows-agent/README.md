# Easyli Windows Agent

This is a real Windows desktop agent for Easyli remote access.

What it does:

- registers a real Windows endpoint in the tenant
- sends heartbeat and basic CPU/RAM metrics
- joins `easyli-agent` remote sessions over WebSocket
- captures the live Windows desktop and streams it to the Easyli viewer
- shows a real consent prompt on the assisted workstation
- applies pointer clicks and keyboard input locally on Windows

Safety note:

- This agent captures and controls the local Windows desktop session.
- Do not run it inside the same workstation where you are actively using VS Code, browser tabs, or admin consoles unless you explicitly want that machine to be remotely controlled.
- The agent now starts every session in `view-only`. Use the interaction buttons inside the Easyli web console to switch to `shared-control` or `remote-only`.
- `remote-only` asks the local Windows bridge to lock the assisted workstation keyboard and mouse until the session mode changes, the session ends, or the agent stops.

Current scope:

- runs as an interactive user process
- captures the current desktop session
- supports the virtual screen across monitors
- includes an installer package that runs hidden in the interactive logon session through Task Scheduler
- does not yet implement file transfer, clipboard sync, audio or unattended elevation
- can use `ffmpeg/gdigrab` as an optional capture backend when available

## Run

```powershell
$env:EASYLI_API_URL='http://localhost:3001/api/v1'
$env:EASYLI_EMAIL='owner@acme.local'
$env:EASYLI_PASSWORD='ChangeMe@123'
npm run agent:windows
```

Hard-disable local mouse/keyboard injection on machines where Easyli must never take control:

```powershell
$env:EASYLI_DISABLE_LOCAL_INPUT_CONTROL='true'
npm run agent:windows
```

## Useful environment variables

- `EASYLI_API_URL`
- `EASYLI_WS_URL`
- `EASYLI_EMAIL`
- `EASYLI_PASSWORD`
- `EASYLI_CLIENT_NAME`
- `EASYLI_DEVICE_HOSTNAME`
- `EASYLI_DEVICE_IP`
- `EASYLI_DEVICE_OS`
- `EASYLI_CAPTURE_INTERVAL_MS`
- `EASYLI_INPUT_FEEDBACK_FRAME_DEBOUNCE_MS`
- `EASYLI_CAPTURE_BACKEND` (`auto`, `powershell`, `ffmpeg`)
- `EASYLI_CAPTURE_FORMAT` (`jpeg` by default, use `png` only if you prefer fidelity over latency)
- `EASYLI_CAPTURE_JPEG_QUALITY` (`68` by default)
- `EASYLI_CAPTURE_MAX_WIDTH` (`1280` by default)
- `EASYLI_FFMPEG_PATH`
- `EASYLI_HEARTBEAT_INTERVAL_MS`
- `EASYLI_METRIC_INTERVAL_MS`
- `EASYLI_REMOTE_SESSION_POLL_INTERVAL_MS`
- `EASYLI_CONSENT_TIMEOUT_SECONDS`
- `EASYLI_DISABLE_LOCAL_INPUT_CONTROL` (`false` by default, set to `true` to force the agent to remain view-only)
- `EASYLI_ENABLE_LOCAL_INPUT_CONTROL` (legacy compatibility flag; no longer required for normal operation)

## Test flow

1. Start API and web.
2. Run `npm run agent:windows` on the assisted Windows machine.
3. Sign in to Easyli as a tenant user with remote-access permissions.
4. Open `/remote-access`.
5. Create a session using `Easyli Windows Agent`.
6. Open the session console.
7. Keep the session in `View only`, then click `Request consent`.
8. Approve the consent dialog on the assisted workstation.
9. Switch the session to `Shared` or `Remote only` from the web console.
10. Use the embedded viewer for pointer and keyboard control.

## Capture backend note

By default the agent tries `ffmpeg` first when it is available on the machine and falls back to the bundled PowerShell capture helper.

The remote viewer now uses lower-latency defaults:

- capture interval: `250ms`
- feedback frame after click/key input: `80ms`
- image format: `jpeg`
- jpeg quality: `68`
- max width: `1280`

If your Windows environment blocks the PowerShell capture helper, install `ffmpeg` and run:

```powershell
$env:EASYLI_CAPTURE_BACKEND='ffmpeg'
npm run agent:windows
```

## Installation package

The packaged installer is designed for real endpoint deployment:

- copies a self-contained payload with `node.exe`, agent scripts and production dependencies
- writes `config\agent-config.json`
- adds the install folder to Microsoft Defender exclusions
- registers a hidden Scheduled Task that runs on user logon
- keeps the agent alive via `run-agent-supervisor.ps1`

Why it uses Task Scheduler instead of a classic Windows Service:

- remote desktop capture and local input control need an interactive Windows session
- a service would run in Session 0 and would not control the active desktop reliably

Build the package from the repo:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\tools\windows-agent\build-package.ps1
```

Generated artifacts:

- folder: `dist\windows-agent-package`
- zip: `dist\windows-agent-package.zip`

Install on a Windows endpoint as administrator:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\install-agent.ps1 `
  -ApiUrl 'http://your-api-host:3001/api/v1' `
  -Email 'agent-user@tenant.local' `
  -Password 'ChangeMe@123'
```

Useful installer options:

- `-RunAsUser 'DOMAIN\User'`
- `-InstallRoot 'C:\Program Files\Easyli Windows Agent'`
- `-DisableLocalInputControl`
- `-CaptureBackend ffmpeg`
- `-SkipDefenderExclusion` only if Defender exclusions are managed elsewhere

Uninstall:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\uninstall-agent.ps1
```
