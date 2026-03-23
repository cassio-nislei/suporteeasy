/* eslint-disable no-console */
const os = require('os');
const { io } = require('socket.io-client');

function readBooleanEnv(name) {
  const rawValue = process.env[name];
  if (typeof rawValue !== 'string') {
    return null;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return null;
}

const API_URL = process.env.EASYLI_API_URL || 'http://localhost:3001/api/v1';
const WS_URL = process.env.EASYLI_WS_URL || `${API_URL.replace(/\/api\/v1\/?$/, '')}/ws/remote-access`;
const EASYLI_EMAIL = process.env.EASYLI_EMAIL || 'owner@acme.local';
const EASYLI_PASSWORD = process.env.EASYLI_PASSWORD || 'ChangeMe@123';
const CLIENT_NAME = process.env.EASYLI_CLIENT_NAME || `${os.hostname()} Managed Endpoint`;
const DEVICE_HOSTNAME = process.env.EASYLI_DEVICE_HOSTNAME || os.hostname();
const DEVICE_OS = process.env.EASYLI_DEVICE_OS || `Windows ${os.release()}`;
const DEVICE_IP = process.env.EASYLI_DEVICE_IP || detectPrimaryIPv4() || '127.0.0.1';
const AGENT_VERSION = process.env.EASYLI_AGENT_VERSION || 'windows-agent-0.1.0';
const REMOTE_PROVIDER = 'easyli-agent';
const HEARTBEAT_INTERVAL_MS = Number(process.env.EASYLI_HEARTBEAT_INTERVAL_MS || '10000');
const METRIC_INTERVAL_MS = Number(process.env.EASYLI_METRIC_INTERVAL_MS || '15000');
const REMOTE_SESSION_POLL_INTERVAL_MS = Number(process.env.EASYLI_REMOTE_SESSION_POLL_INTERVAL_MS || '5000');
const CAPTURE_INTERVAL_MS = Math.max(120, Number(process.env.EASYLI_CAPTURE_INTERVAL_MS || '250') || 250);
const CAPTURE_TIMEOUT_MS = Number(process.env.EASYLI_CAPTURE_TIMEOUT_MS || '15000');
const INPUT_FEEDBACK_FRAME_DEBOUNCE_MS = Math.max(
  40,
  Number(process.env.EASYLI_INPUT_FEEDBACK_FRAME_DEBOUNCE_MS || '80') || 80
);
const INPUT_TIMEOUT_MS = Number(process.env.EASYLI_INPUT_TIMEOUT_MS || '15000');
const DISPLAY_SWITCH_TIMEOUT_MS = Number(process.env.EASYLI_DISPLAY_SWITCH_TIMEOUT_MS || '20000');
const CAPTURE_PAUSE_AFTER_INPUT_MS = Math.max(
  INPUT_FEEDBACK_FRAME_DEBOUNCE_MS,
  Number(process.env.EASYLI_CAPTURE_PAUSE_AFTER_INPUT_MS || '600') || 600
);
const CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS = Math.max(
  CAPTURE_PAUSE_AFTER_INPUT_MS,
  Number(process.env.EASYLI_CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS || '1200') || 1200
);
const BRIDGE_DISCOVERY_TIMEOUT_MS = Number(process.env.EASYLI_BRIDGE_DISCOVERY_TIMEOUT_MS || '15000');
const BRIDGE_BOOTSTRAP_RETRIES = Number(process.env.EASYLI_BRIDGE_BOOTSTRAP_RETRIES || '3');
const CONSENT_TIMEOUT_SECONDS = Number(process.env.EASYLI_CONSENT_TIMEOUT_SECONDS || '45');
const LOCAL_BRIDGE_URL = process.env.EASYLI_LOCAL_BRIDGE_URL || 'http://127.0.0.1:37609';
const LEGACY_INPUT_CONTROL_FLAG = readBooleanEnv('EASYLI_ENABLE_LOCAL_INPUT_CONTROL');
const INPUT_CONTROL_DISABLED_BY_POLICY = readBooleanEnv('EASYLI_DISABLE_LOCAL_INPUT_CONTROL') === true;
const INPUT_CONTROL_SUPPORTED = INPUT_CONTROL_DISABLED_BY_POLICY ? false : LEGACY_INPUT_CONTROL_FLAG ?? true;
const INTERACTION_MODES = ['view-only', 'shared-control', 'remote-only'];
const INPUT_CONTROL_DISABLED_NOTICE =
  'Local input control is disabled by agent policy. This workstation can stream the desktop, but Easyli cannot unlock pointer or keyboard control.';

let accessToken = '';
let agentToken = '';
let deviceId = '';
let deviceLabel = '';
let deviceAddress = '';
let heartbeatTimer = null;
let metricsTimer = null;
let remoteSessionPollTimer = null;
let remoteCaptureTimer = null;
let remoteSocket = null;
let remoteSessionId = '';
let remoteJoinedSessionId = '';
let remoteSessionRecord = null;
let remoteConsentStatus = 'pending';
let remoteInteractionMode = 'view-only';
let localInputLocked = false;
let remoteLastInputAt = null;
let remoteLastInputSummary = 'Awaiting operator input';
let latestMetrics = {
  cpu: 0,
  ram: 0,
  disk: 0
};
let pendingPointerMove = null;
let pointerMoveTimer = null;
let feedbackFrameTimer = null;
let captureInFlight = false;
let consentRequestInFlight = false;
let resolvedBridgeBackend = 'unknown';
let availableDisplays = [];
let selectedDisplayId = '';
let lastCaptureErrorNotice = '';
let lastCaptureErrorAt = 0;
let lastPointerErrorNotice = '';
let lastPointerErrorAt = 0;
let lastCaptureLatencyMs = 0;
let capturePausedUntil = 0;
let bridgePriorityOperations = 0;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectPrimaryIPv4() {
  const interfaces = os.networkInterfaces();
  for (const addresses of Object.values(interfaces)) {
    for (const address of addresses || []) {
      if (address && address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }

  return null;
}

function cpuSnapshot() {
  const totals = os.cpus().reduce(
    (accumulator, cpu) => {
      const times = cpu.times;
      accumulator.idle += times.idle;
      accumulator.total += times.user + times.nice + times.sys + times.idle + times.irq;
      return accumulator;
    },
    { idle: 0, total: 0 }
  );

  return totals;
}

async function sampleCpuUsage() {
  const first = cpuSnapshot();
  await delay(250);
  const second = cpuSnapshot();

  const totalDelta = second.total - first.total;
  const idleDelta = second.idle - first.idle;
  if (totalDelta <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Number((((totalDelta - idleDelta) / totalDelta) * 100).toFixed(2))));
}

function currentRemoteState() {
  if (!remoteSessionRecord) {
    return 'waiting';
  }

  if (remoteSessionRecord.status === 'active') {
    return 'active';
  }

  if (remoteSessionRecord.status === 'ended') {
    return 'ended';
  }

  return 'ready';
}

function normalizeInteractionMode(value, fallback = 'view-only') {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  return INTERACTION_MODES.includes(normalized) ? normalized : fallback;
}

function currentInteractionMode() {
  return normalizeInteractionMode(remoteInteractionMode, 'view-only');
}

function rememberRemoteActivity(message) {
  remoteLastInputAt = new Date().toISOString();
  remoteLastInputSummary = message;
}

async function api(pathname, options = {}, authenticated = true, allowReauth = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers
  });

  if (response.status === 401 && authenticated && allowReauth) {
    console.warn(`[windows-agent] access token expired while calling ${pathname}; re-authenticating`);
    await authenticate();
    return api(pathname, options, authenticated, false);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${pathname} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function authenticate() {
  const result = await api(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({
        email: EASYLI_EMAIL,
        password: EASYLI_PASSWORD
      })
    },
    false
  );

  accessToken = result.tokens.accessToken;
  console.log(`[windows-agent] authenticated as ${EASYLI_EMAIL}`);
}

async function ensureClient() {
  const list = await api(`/clients?search=${encodeURIComponent(CLIENT_NAME)}&limit=10&page=1`);
  const existing = list.items?.find((item) => item.name === CLIENT_NAME);
  if (existing) {
    return existing;
  }

  return api('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: CLIENT_NAME,
      status: 'active',
      tags: ['windows-agent', 'remote-access'],
      notes: 'Auto-provisioned by the Easyli Windows agent'
    })
  });
}

async function ensureDevice(clientId) {
  const ramGb = Number((os.totalmem() / 1024 / 1024 / 1024).toFixed(0));
  const cpuModel = os.cpus()[0]?.model || 'Unknown CPU';
  const cpuCores = os.cpus().length;

  const existingList = await api(`/devices?search=${encodeURIComponent(DEVICE_HOSTNAME)}&limit=25&page=1`);
  const existing = existingList.items?.find((item) => item.hostname === DEVICE_HOSTNAME);
  if (existing) {
    return existing;
  }

  return api('/devices', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      hostname: DEVICE_HOSTNAME,
      ipAddress: DEVICE_IP,
      os: DEVICE_OS,
      tags: ['windows-agent', 'remote-access'],
      notes: 'Provisioned by the Easyli Windows agent',
      inventory: {
        cpuModel,
        cpuCores,
        ramGb,
        diskGb: 0,
        serialNumber: os.hostname(),
        services: ['easyli-remote-bridge', 'easyli-input-control']
      }
    })
  });
}

async function registerAgent(deviceIdValue) {
  const registration = await api('/agents/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: deviceIdValue,
      version: AGENT_VERSION
    })
  });

  return registration.token;
}

async function sendHeartbeat(status = 'online') {
  await api(
    '/agents/heartbeat',
    {
      method: 'POST',
      body: JSON.stringify({
        agentToken,
        status,
        services: [
          { name: 'easyli-remote-bridge', status: 'running' },
          { name: 'easyli-input-control', status: INPUT_CONTROL_SUPPORTED ? 'running' : 'disabled' }
        ]
      })
    },
    false
  );

  console.log(`[windows-agent] heartbeat sent status=${status}`);
}

async function sendMetrics() {
  latestMetrics = {
    cpu: await sampleCpuUsage(),
    ram: Number((((os.totalmem() - os.freemem()) / os.totalmem()) * 100).toFixed(2)),
    disk: latestMetrics.disk || 0
  };

  await api(
    '/monitoring/ingest',
    {
      method: 'POST',
      body: JSON.stringify({
        agentToken,
        metrics: [
          { type: 'cpu', value: latestMetrics.cpu, unit: '%' },
          { type: 'ram', value: latestMetrics.ram, unit: '%' }
        ]
      })
    },
    false
  );

  console.log('[windows-agent] metrics ingested');
}

async function localBridgeRequest(pathname, options = {}, timeoutMs = INPUT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${LOCAL_BRIDGE_URL}${pathname}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      signal: controller.signal
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.message || `Bridge ${pathname} failed with status ${response.status}`);
    }

    return payload;
  } catch (error) {
    if (error && typeof error === 'object' && error.name === 'AbortError') {
      throw new Error(`Bridge ${pathname} timed out after ${timeoutMs}ms`);
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Requisição à ponte local com retry automático e backoff exponencial
 * @param {string} pathname - Caminho do endpoint
 * @param {object} options - Opções do fetch
 * @param {number} timeoutMs - Timeout para cada tentativa
 * @param {number} maxRetries - Número máximo de tentativas (padrão: 2)
 * @returns {Promise} Resultado da requisição
 */
async function localBridgeRequestWithRetry(pathname, options = {}, timeoutMs = INPUT_TIMEOUT_MS, maxRetries = 2) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await localBridgeRequest(pathname, options, timeoutMs);
    } catch (error) {
      if (attempt < maxRetries) {
        // Backoff exponencial: 500ms * 2^(tentativa-1) = 500ms, 1000ms
        const delayMs = Math.pow(2, attempt - 1) * 500;
        log({ level: 'info', message: `Bridge retry ${attempt}/${maxRetries} para ${pathname} em ${delayMs}ms` });
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        throw error;
      }
    }
  }
}

async function ensureLocalBridge() {
  const health = await localBridgeRequest('/health', { method: 'GET' }, 5000);
  resolvedBridgeBackend = health?.backend || 'unknown';
}

function describeError(error) {
  if (!error) {
    return 'unknown error';
  }

  if (typeof error.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }

  return String(error);
}

function pauseCapture(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return;
  }

  capturePausedUntil = Math.max(capturePausedUntil, Date.now() + durationMs);
}

async function runPriorityBridgeOperation(durationMs, operation) {
  bridgePriorityOperations += 1;
  pauseCapture(durationMs);

  try {
    return await operation();
  } finally {
    bridgePriorityOperations = Math.max(0, bridgePriorityOperations - 1);
  }
}

function normalizeDisplay(display, fallbackIndex) {
  if (!display || typeof display !== 'object') {
    return null;
  }

  const numericIndex = Number(display.index);
  const safeIndex = Number.isFinite(numericIndex) && numericIndex > 0 ? numericIndex : fallbackIndex + 1;
  const id = typeof display.id === 'string' && display.id.trim() ? display.id.trim() : `display-${safeIndex}`;
  const label =
    typeof display.label === 'string' && display.label.trim()
      ? display.label.trim()
      : `Monitor ${safeIndex}`;

  return {
    id,
    deviceName: typeof display.deviceName === 'string' ? display.deviceName : id,
    label,
    index: safeIndex,
    isPrimary: Boolean(display.isPrimary),
    x: Number(display.x) || 0,
    y: Number(display.y) || 0,
    width: Number(display.width) || 0,
    height: Number(display.height) || 0
  };
}

async function refreshDisplays(preferredDisplayId = selectedDisplayId, timeoutMs = BRIDGE_DISCOVERY_TIMEOUT_MS) {
  const response = await runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS, () =>
    localBridgeRequest('/displays', { method: 'POST', body: '{}' }, timeoutMs)
  );
  const nextDisplays = Array.isArray(response?.displays)
    ? response.displays.map((display, index) => normalizeDisplay(display, index)).filter(Boolean)
    : [];

  availableDisplays = nextDisplays;

  if (availableDisplays.length === 0) {
    selectedDisplayId = '';
    return;
  }

  const preferred =
    (typeof preferredDisplayId === 'string' && preferredDisplayId) ||
    (typeof response?.selectedDisplayId === 'string' && response.selectedDisplayId) ||
    '';

  const selected =
    availableDisplays.find((display) => display.id === preferred) ||
    availableDisplays.find((display) => display.isPrimary) ||
    availableDisplays[0];

  selectedDisplayId = selected.id;
}

async function refreshDisplaysWithRetry(preferredDisplayId = selectedDisplayId, attempts = BRIDGE_BOOTSTRAP_RETRIES) {
  let lastError = null;

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt += 1) {
    try {
      await refreshDisplays(preferredDisplayId, BRIDGE_DISCOVERY_TIMEOUT_MS);
      return true;
    } catch (error) {
      lastError = error;
      console.warn(
        `[windows-agent] display inventory attempt ${attempt}/${Math.max(1, attempts)} failed: ${describeError(error)}`
      );

      if (attempt < Math.max(1, attempts)) {
        await delay(1000 * attempt);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  return false;
}

async function captureDesktopFrame() {
  return localBridgeRequestWithRetry(
    '/capture',
    {
      method: 'POST',
      body: JSON.stringify({
        displayId: selectedDisplayId || undefined
      })
    },
    CAPTURE_TIMEOUT_MS,
    2  // retry 2 vezes: total 3 tentativas
  );
}

async function showConsentPrompt() {
  return runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS, () =>
    localBridgeRequestWithRetry(
      '/consent',
      {
        method: 'POST',
        body: JSON.stringify({
          title: 'Easyli Remote Access Request',
          message:
            'A technician is requesting permission to view and control this workstation through Easyli. Allow remote access?',
          timeoutSeconds: CONSENT_TIMEOUT_SECONDS
        })
      },
      Math.max(INPUT_TIMEOUT_MS, CONSENT_TIMEOUT_SECONDS * 1000 + 5000),
      2  // retry 2 vezes
    )
  );
}

async function movePointer(x, y) {
  return runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_INPUT_MS, () =>
    localBridgeRequestWithRetry(
      '/pointer-move',
      {
        method: 'POST',
        body: JSON.stringify({
          x,
          y,
          displayId: selectedDisplayId || undefined
        })
      },
      INPUT_TIMEOUT_MS,
      2  // retry 2 vezes
    )
  );
}

async function clickPointer(x, y, button) {
  return runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_INPUT_MS, () =>
    localBridgeRequestWithRetry(
      '/pointer-down',
      {
        method: 'POST',
        body: JSON.stringify({
          x,
          y,
          button: Number(button) || 0,
          displayId: selectedDisplayId || undefined
        })
      },
      INPUT_TIMEOUT_MS,
      2  // retry 2 vezes
    )
  );
}

async function sendKeyPress(payload = {}) {
  return runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_INPUT_MS, () =>
    localBridgeRequestWithRetry(
      '/key-press',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      INPUT_TIMEOUT_MS,
      2  // retry 2 vezes
    )
  );
}

async function setLocalInputLock(enabled) {
  const response = await runPriorityBridgeOperation(CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS, () =>
    localBridgeRequestWithRetry(
      '/input-lock',
      {
        method: 'POST',
        body: JSON.stringify({
          enabled: Boolean(enabled)
        })
      },
      INPUT_TIMEOUT_MS,
      2  // retry 2 vezes
    )
  );

  localInputLocked = Boolean(response?.locked);
  return localInputLocked;
}

function shouldLockLocalInput() {
  const consentRequired = remoteSessionRecord?.metadata?.consentRequired !== false;
  return Boolean(
    INPUT_CONTROL_SUPPORTED &&
    currentInteractionMode() === 'remote-only' &&
    remoteJoinedSessionId &&
    (!consentRequired || remoteConsentStatus === 'granted')
  );
}

async function syncLocalInputLock(reason = 'interaction mode update') {
  const desiredLockState = shouldLockLocalInput();

  if (desiredLockState === localInputLocked) {
    return localInputLocked;
  }

  try {
    const locked = await setLocalInputLock(desiredLockState);
    const modeLabel = currentInteractionMode();

    if (locked) {
      rememberRemoteActivity(`Local workstation locked for remote-only control (${reason})`);
      emitRemoteNotice('warn', 'Local keyboard and mouse are locked on the assisted workstation.');
    } else if (modeLabel === 'remote-only') {
      emitRemoteNotice(
        'warn',
        'Remote-only mode is selected, but the local workstation remained unlocked. Check the Windows bridge privileges.'
      );
    } else {
      rememberRemoteActivity(`Local workstation unlocked (${reason})`);
      emitRemoteNotice('info', 'Local keyboard and mouse were unlocked on the assisted workstation.');
    }
  } catch (error) {
    localInputLocked = false;
    emitRemoteNotice('error', `Local input lock update failed: ${describeError(error)}`);
  } finally {
    emitRemoteTelemetry();
  }

  return localInputLocked;
}

async function releaseLocalInputLock(reason = 'session released') {
  if (!localInputLocked) {
    return false;
  }

  try {
    await setLocalInputLock(false);
    rememberRemoteActivity(`Local workstation unlocked (${reason})`);
    emitRemoteNotice('info', 'Local keyboard and mouse were unlocked on the assisted workstation.');
  } catch (error) {
    emitRemoteNotice('error', `Local input unlock failed: ${describeError(error)}`);
  } finally {
    emitRemoteTelemetry();
  }

  return localInputLocked;
}

function emitRemoteNotice(level, message) {
  if (!remoteSocket || !remoteJoinedSessionId || !remoteSocket.connected) {
    return;
  }

  remoteSocket.emit('agent.notice', {
    sessionId: remoteJoinedSessionId,
    level,
    message
  });
}

function shouldEmitRepeatedNotice(kind, message, cooldownMs = 12000) {
  const now = Date.now();

  if (kind === 'capture') {
    if (lastCaptureErrorNotice === message && now - lastCaptureErrorAt < cooldownMs) {
      return false;
    }

    lastCaptureErrorNotice = message;
    lastCaptureErrorAt = now;
    return true;
  }

  if (kind === 'pointer') {
    if (lastPointerErrorNotice === message && now - lastPointerErrorAt < cooldownMs) {
      return false;
    }

    lastPointerErrorNotice = message;
    lastPointerErrorAt = now;
    return true;
  }

  return true;
}

function emitRemoteTelemetry(overrides = {}) {
  if (!remoteSocket || !remoteJoinedSessionId || !remoteSocket.connected) {
    return;
  }

  const capabilities = ['real-desktop'];
  if (INPUT_CONTROL_SUPPORTED) {
    capabilities.push('pointer', 'keyboard', 'clipboard');
  }

  if (currentInteractionMode() === 'view-only') {
    capabilities.push('viewer-only');
  }

  if (localInputLocked) {
    capabilities.push('local-input-locked');
  }

  if (availableDisplays.length > 1) {
    capabilities.push('multi-display');
  }

  remoteSocket.emit('agent.telemetry', {
    sessionId: remoteJoinedSessionId,
    connectionState: currentRemoteState(),
    consentStatus: remoteConsentStatus,
    interactionMode: currentInteractionMode(),
    inputControlSupported: INPUT_CONTROL_SUPPORTED,
    localInputLocked,
    fps: Math.max(1, Math.round(1000 / Math.max(CAPTURE_INTERVAL_MS, lastCaptureLatencyMs || CAPTURE_INTERVAL_MS))),
    latencyMs: lastCaptureLatencyMs || CAPTURE_INTERVAL_MS,
    quality: 68,
    streamActive: Boolean(remoteJoinedSessionId),
    lastInputAt: remoteLastInputAt,
    lastInputSummary: remoteLastInputSummary,
    selectedDisplayId,
    displays: availableDisplays,
    capabilities,
    ...overrides
  });
}

async function emitRemoteFrame(options = {}) {
  const force = options && options.force === true;

  if (!remoteSocket || !remoteJoinedSessionId || !remoteSocket.connected || captureInFlight) {
    return;
  }

  if (!force && (bridgePriorityOperations > 0 || Date.now() < capturePausedUntil)) {
    return;
  }

  captureInFlight = true;
  const captureStartedAt = Date.now();

  try {
    const frame = await captureDesktopFrame();
    const generatedAt = new Date().toISOString();
    lastCaptureLatencyMs = Math.max(1, Date.now() - captureStartedAt);

    remoteSocket.emit('agent.frame', {
      sessionId: remoteJoinedSessionId,
      mimeType: frame.mimeType,
      payload: frame.payload,
      width: frame.width,
      height: frame.height,
      displayId: frame.displayId || selectedDisplayId,
      generatedAt
    });

    emitRemoteTelemetry({
      lastFrameAt: generatedAt,
      frameWidth: frame.width,
      frameHeight: frame.height,
      selectedDisplayId: frame.displayId || selectedDisplayId
    });
  } catch (error) {
    const message = `Desktop capture failed: ${error.message}`;
    if (shouldEmitRepeatedNotice('capture', message)) {
      emitRemoteNotice('error', message);
    }
  } finally {
    captureInFlight = false;
  }
}

function scheduleFeedbackFrame(delayMs = INPUT_FEEDBACK_FRAME_DEBOUNCE_MS) {
  if (!remoteSocket || !remoteJoinedSessionId || !remoteSocket.connected) {
    return;
  }

  if (feedbackFrameTimer) {
    return;
  }

  feedbackFrameTimer = setTimeout(async () => {
    feedbackFrameTimer = null;
    await emitRemoteFrame({ force: true });
  }, delayMs);
}

function stopCaptureLoop() {
  if (remoteCaptureTimer) {
    clearInterval(remoteCaptureTimer);
    remoteCaptureTimer = null;
  }

  if (feedbackFrameTimer) {
    clearTimeout(feedbackFrameTimer);
    feedbackFrameTimer = null;
  }
}

function startCaptureLoop() {
  stopCaptureLoop();
  remoteCaptureTimer = setInterval(() => {
    void emitRemoteFrame();
  }, CAPTURE_INTERVAL_MS);
}

function schedulePointerMove(x, y) {
  pendingPointerMove = { x, y };

  if (pointerMoveTimer) {
    return;
  }

  pointerMoveTimer = setTimeout(async () => {
    const nextMove = pendingPointerMove;
    pendingPointerMove = null;
    pointerMoveTimer = null;

    if (!nextMove) {
      return;
    }

    try {
      await movePointer(nextMove.x, nextMove.y);
      rememberRemoteActivity(`Pointer moved to ${Math.round(nextMove.x * 100)}% x ${Math.round(nextMove.y * 100)}%`);
      emitRemoteTelemetry();
      scheduleFeedbackFrame(120);
    } catch (error) {
      const message = `Pointer move failed: ${error.message}`;
      if (shouldEmitRepeatedNotice('pointer', message, 8000)) {
        emitRemoteNotice('error', message);
      }
    }
  }, 90);
}

function resetRemoteSessionState() {
  remoteSessionId = '';
  remoteJoinedSessionId = '';
  remoteSessionRecord = null;
  remoteConsentStatus = 'pending';
  remoteInteractionMode = 'view-only';
  localInputLocked = false;
  remoteLastInputAt = null;
  remoteLastInputSummary = 'Awaiting operator input';
  captureInFlight = false;
  consentRequestInFlight = false;
  pendingPointerMove = null;

  if (pointerMoveTimer) {
    clearTimeout(pointerMoveTimer);
    pointerMoveTimer = null;
  }

  stopCaptureLoop();
}

function attachRemoteSession(session) {
  const consentRequired = session?.metadata?.consentRequired !== false;
  const nextInteractionMode = normalizeInteractionMode(session?.metadata?.interactionMode, 'view-only');

  if (remoteSessionId === session._id) {
    remoteSessionRecord = session;
    remoteInteractionMode = nextInteractionMode;
    void syncLocalInputLock('session metadata refreshed');
    emitRemoteTelemetry();
    return;
  }

  if (remoteSessionId && remoteSessionId !== session._id) {
    void releaseLocalInputLock('switching remote session');
  }

  remoteSessionRecord = session;
  remoteSessionId = session._id;
  remoteJoinedSessionId = '';
  remoteConsentStatus = consentRequired ? 'pending' : 'granted';
  remoteInteractionMode = nextInteractionMode;
  localInputLocked = false;
  remoteLastInputAt = null;
  remoteLastInputSummary = 'Awaiting operator input';

  const socket = ensureRemoteSocket();
  if (socket.connected) {
    socket.emit('agent.join', {
      sessionId: session._id,
      agentToken
    });
  }
}

async function listRemoteSessionsForDevice() {
  const response = await api(`/remote-access/sessions?deviceId=${encodeURIComponent(deviceId)}&page=1&limit=25`);
  return (response.items || []).filter(
    (session) => session.provider === REMOTE_PROVIDER && session.status !== 'ended' && session.status !== 'failed'
  );
}

async function syncRemoteSessions() {
  try {
    const sessions = await listRemoteSessionsForDevice();
    const nextSession =
      sessions.find((session) => session.status === 'active') ??
      sessions.find((session) => session.status === 'requested') ??
      null;

    if (!nextSession) {
      if (remoteSessionId) {
        emitRemoteNotice('warn', 'Remote session no longer available for this Windows agent.');
        await releaseLocalInputLock('remote session released');
        resetRemoteSessionState();
      }
      return;
    }

    attachRemoteSession(nextSession);
  } catch (error) {
    console.error(`[windows-agent] remote session sync error ${error.message}`);
  }
}

async function handleConsentRequest() {
  if (consentRequestInFlight) {
    return;
  }

  consentRequestInFlight = true;
  remoteConsentStatus = 'pending';
  rememberRemoteActivity('Consent requested from the assisted workstation');
  emitRemoteNotice('info', 'Consent prompt displayed on the assisted device.');
  emitRemoteTelemetry();

  try {
    const result = await showConsentPrompt();
    remoteConsentStatus = result?.granted ? 'granted' : 'denied';

    if (result?.granted) {
      rememberRemoteActivity('Consent granted on the assisted workstation');
      emitRemoteNotice('info', 'User consent granted on the assisted device.');
    } else if (result?.timedOut) {
      rememberRemoteActivity('Consent request timed out on the assisted workstation');
      emitRemoteNotice('warn', 'Consent request timed out on the assisted device.');
    } else {
      rememberRemoteActivity('Consent denied on the assisted workstation');
      emitRemoteNotice('warn', 'User denied the remote access request on the assisted device.');
    }
  } catch (error) {
    remoteConsentStatus = 'denied';
    emitRemoteNotice('error', `Consent dialog failed: ${error.message}`);
  } finally {
    consentRequestInFlight = false;
    await syncLocalInputLock('consent workflow completed');
    emitRemoteTelemetry();
    await emitRemoteFrame({ force: true });
  }
}

async function switchRemoteDisplay(nextDisplayId) {
  if (typeof nextDisplayId !== 'string' || !nextDisplayId.trim()) {
    return;
  }

  pauseCapture(CAPTURE_PAUSE_AFTER_DISPLAY_SWITCH_MS);

  try {
    await refreshDisplaysWithRetry(nextDisplayId.trim(), 3);
  } catch (error) {
    emitRemoteNotice('error', `Display switch failed: ${describeError(error)}`);
    emitRemoteTelemetry();
    return;
  }

  const nextDisplay = availableDisplays.find((display) => display.id === selectedDisplayId);

  if (!nextDisplay) {
    emitRemoteNotice('error', `Monitor ${nextDisplayId} is not available on the assisted workstation.`);
    emitRemoteTelemetry();
    return;
  }

  rememberRemoteActivity(`Viewer switched to ${nextDisplay.label}`);
  emitRemoteNotice('info', `Streaming switched to ${nextDisplay.label}.`);
  emitRemoteTelemetry({
    frameWidth: nextDisplay.width,
    frameHeight: nextDisplay.height
  });
  await emitRemoteFrame({ force: true });
}

function canApplyControl() {
  const consentRequired = remoteSessionRecord?.metadata?.consentRequired !== false;
  return (
    INPUT_CONTROL_SUPPORTED &&
    currentInteractionMode() !== 'view-only' &&
    (!consentRequired || remoteConsentStatus === 'granted')
  );
}

function ensureRemoteSocket() {
  if (remoteSocket) {
    return remoteSocket;
  }

  remoteSocket = io(WS_URL, {
    transports: ['websocket'],
    auth: {
      agentToken
    }
  });

  remoteSocket.on('connect', () => {
    console.log('[windows-agent] remote bridge socket connected');
    if (remoteSessionRecord) {
      remoteSocket.emit('agent.join', {
        sessionId: remoteSessionRecord._id,
        agentToken
      });
    }
  });

  remoteSocket.on('disconnect', (reason) => {
    console.log(`[windows-agent] remote bridge socket disconnected reason=${reason}`);
    remoteJoinedSessionId = '';
    void syncLocalInputLock('remote socket disconnected');
    stopCaptureLoop();
  });

  remoteSocket.on('remote.joined', async (event) => {
    if (event?.role !== 'agent' || !remoteSessionRecord) {
      return;
    }

    remoteJoinedSessionId = remoteSessionRecord._id;
    console.log(`[windows-agent] remote session joined ${remoteJoinedSessionId}`);
    try {
      await refreshDisplaysWithRetry(selectedDisplayId, 2);
    } catch (error) {
      emitRemoteNotice('warn', `Display inventory refresh failed: ${describeError(error)}`);
    }

    if (!INPUT_CONTROL_SUPPORTED) {
      rememberRemoteActivity('Local input control disabled by agent policy');
      emitRemoteNotice('warn', INPUT_CONTROL_DISABLED_NOTICE);
    }

    emitRemoteNotice('info', 'Real Windows agent bridge connected.');
    await syncLocalInputLock('remote session joined');
    emitRemoteTelemetry();
    startCaptureLoop();
    void emitRemoteFrame();
  });

  remoteSocket.on('remote.control', async (event = {}) => {
    const type = typeof event.type === 'string' ? event.type : '';
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

    if (!type) {
      return;
    }

    try {
      switch (type) {
        case 'viewer.snapshot.request':
          rememberRemoteActivity('Operator requested an instant snapshot');
          await emitRemoteFrame();
          return;

        case 'session.consent.request':
          await handleConsentRequest();
          return;

        case 'session.interaction-mode.set':
          remoteInteractionMode = normalizeInteractionMode(payload.interactionMode, currentInteractionMode());
          rememberRemoteActivity(`Interaction mode set to ${remoteInteractionMode}`);
          emitRemoteNotice('info', `Interaction mode updated to ${remoteInteractionMode}.`);
          await syncLocalInputLock('operator interaction mode update');
          emitRemoteTelemetry();
          return;

        case 'viewer.select-display':
          await switchRemoteDisplay(String(payload.displayId || ''));
          return;

        case 'pointer.move':
          if (!INPUT_CONTROL_SUPPORTED) {
            if (shouldEmitRepeatedNotice('pointer', INPUT_CONTROL_DISABLED_NOTICE, 10000)) {
              emitRemoteNotice('warn', INPUT_CONTROL_DISABLED_NOTICE);
            }
            return;
          }

          if (!canApplyControl()) {
            return;
          }

          if (Number.isFinite(payload.x) && Number.isFinite(payload.y)) {
            schedulePointerMove(Number(payload.x), Number(payload.y));
          }
          return;

        case 'pointer.down':
          if (!INPUT_CONTROL_SUPPORTED) {
            if (shouldEmitRepeatedNotice('pointer', INPUT_CONTROL_DISABLED_NOTICE, 10000)) {
              emitRemoteNotice('warn', INPUT_CONTROL_DISABLED_NOTICE);
            }
            return;
          }

          if (!canApplyControl()) {
            return;
          }

          try {
            await clickPointer(Number(payload.x) || 0, Number(payload.y) || 0, Number(payload.button) || 0);
            rememberRemoteActivity(
              `Pointer click at ${Math.round((Number(payload.x) || 0) * 100)}% x ${Math.round((Number(payload.y) || 0) * 100)}%`
            );
            emitRemoteTelemetry();
            scheduleFeedbackFrame();
          } catch (error) {
            emitRemoteNotice('error', `Pointer click failed: ${error.message}`);
          }
          return;

        case 'key.down':
          if (!INPUT_CONTROL_SUPPORTED) {
            if (shouldEmitRepeatedNotice('pointer', INPUT_CONTROL_DISABLED_NOTICE, 10000)) {
              emitRemoteNotice('warn', INPUT_CONTROL_DISABLED_NOTICE);
            }
            return;
          }

          if (!canApplyControl()) {
            return;
          }

          try {
            await sendKeyPress(payload);
            rememberRemoteActivity(`Key pressed: ${String(payload.key || payload.code || 'unknown')}`);
            emitRemoteTelemetry();
            scheduleFeedbackFrame();
          } catch (error) {
            emitRemoteNotice('error', `Key input failed: ${error.message}`);
          }
          return;

        default:
          rememberRemoteActivity(`Control event received: ${type}`);
          emitRemoteTelemetry();
      }
    } catch (error) {
      emitRemoteNotice('error', `Control handler failed for ${type}: ${describeError(error)}`);
      emitRemoteTelemetry();
    }
  });

  remoteSocket.on('remote.error', (event) => {
    console.error(`[windows-agent] remote bridge error ${event?.message || 'unknown error'}`);
  });

  return remoteSocket;
}

async function shutdown() {
  console.log('[windows-agent] stopping...');

  try {
    await releaseLocalInputLock('agent shutdown');
  } catch (error) {
    console.error('[windows-agent] failed to unlock local input during shutdown', describeError(error));
  }

  try {
    if (agentToken) {
      await sendHeartbeat('offline');
    }
  } catch (error) {
    console.error('[windows-agent] failed to send offline heartbeat', error.message);
  }

  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
  }
  if (metricsTimer) {
    clearInterval(metricsTimer);
  }
  if (remoteSessionPollTimer) {
    clearInterval(remoteSessionPollTimer);
  }
  if (pointerMoveTimer) {
    clearTimeout(pointerMoveTimer);
  }

  stopCaptureLoop();

  if (remoteSocket) {
    remoteSocket.disconnect();
    remoteSocket = null;
  }

  process.exit(0);
}

async function start() {
  await ensureLocalBridge();
  try {
    await refreshDisplaysWithRetry();
  } catch (error) {
    console.warn(`[windows-agent] continuing without initial display inventory: ${describeError(error)}`);
  }
  await authenticate();

  const client = await ensureClient();
  const device = await ensureDevice(client._id);
  deviceId = device._id;
  deviceLabel = device.hostname;
  deviceAddress = device.ipAddress;
  agentToken = await registerAgent(deviceId);

  console.log(`[windows-agent] device=${deviceLabel} (${deviceId}) agent registered token=${agentToken}`);
  console.log(`[windows-agent] local bridge=${LOCAL_BRIDGE_URL}`);
  console.log(`[windows-agent] capture backend=${resolvedBridgeBackend}`);
  if (INPUT_CONTROL_SUPPORTED) {
    console.log('[windows-agent] local input control supported; session starts in view-only mode until the web console unlocks it');
  } else {
    console.warn(`[windows-agent] local input control=DISABLED (${INPUT_CONTROL_DISABLED_NOTICE})`);
  }
  if (availableDisplays.length > 0) {
    console.log(
      `[windows-agent] displays=${availableDisplays.map((display) => `${display.label}:${display.width}x${display.height}`).join(', ')}`
    );
  }

  await sendHeartbeat('online');
  await sendMetrics();
  await syncRemoteSessions();

  heartbeatTimer = setInterval(() => {
    void sendHeartbeat('online').catch((error) => {
      console.error('[windows-agent] heartbeat error', error.message);
    });
  }, HEARTBEAT_INTERVAL_MS);

  metricsTimer = setInterval(() => {
    void sendMetrics().catch((error) => {
      console.error('[windows-agent] metrics error', error.message);
    });
  }, METRIC_INTERVAL_MS);

  remoteSessionPollTimer = setInterval(() => {
    void syncRemoteSessions();
  }, REMOTE_SESSION_POLL_INTERVAL_MS);

  console.log(`[windows-agent] running on ${deviceLabel} (${deviceAddress})`);
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

process.on('unhandledRejection', (error) => {
  const message = describeError(error);
  console.error('[windows-agent] unhandled rejection', message);
  emitRemoteNotice('error', `Unhandled agent rejection: ${message}`);
});

void start().catch((error) => {
  console.error('[windows-agent] failed to start', error);
  process.exit(1);
});
