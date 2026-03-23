/* eslint-disable no-console */
const { io } = require('socket.io-client');

const API_URL = process.env.SIM_API_URL || 'http://localhost:3001/api/v1';
const SIM_EMAIL = process.env.SIM_EMAIL || 'owner@acme.local';
const SIM_PASSWORD = process.env.SIM_PASSWORD || 'ChangeMe@123';
const SIM_CLIENT_NAME = process.env.SIM_CLIENT_NAME || 'Acme Simulated Client';
const HEARTBEAT_INTERVAL_MS = Number(process.env.SIM_HEARTBEAT_INTERVAL_MS || '10000');
const METRIC_INTERVAL_MS = Number(process.env.SIM_METRIC_INTERVAL_MS || '5000');
const COMMAND_POLL_INTERVAL_MS = Number(process.env.SIM_COMMAND_POLL_INTERVAL_MS || '4000');
const SCRIPT_SUCCESS_RATE = Number(process.env.SIM_SCRIPT_SUCCESS_RATE || '0.82');
const REMOTE_PROVIDER = process.env.SIM_REMOTE_PROVIDER || 'easyli-agent';
const REMOTE_SESSION_POLL_INTERVAL_MS = Number(process.env.SIM_REMOTE_SESSION_POLL_INTERVAL_MS || '5000');
const REMOTE_RENDER_INTERVAL_MS = Number(process.env.SIM_REMOTE_RENDER_INTERVAL_MS || '1400');
const SIM_FORCE_CPU = process.env.SIM_FORCE_CPU ? Number(process.env.SIM_FORCE_CPU) : null;
const SIM_FORCE_RAM = process.env.SIM_FORCE_RAM ? Number(process.env.SIM_FORCE_RAM) : null;
const SIM_FORCE_DISK = process.env.SIM_FORCE_DISK ? Number(process.env.SIM_FORCE_DISK) : null;
const REMOTE_WS_URL =
  process.env.SIM_REMOTE_WS_URL || `${API_URL.replace(/\/api\/v1\/?$/, '')}/ws/remote-access`;

let accessToken = '';
let agentToken = '';
let deviceId = '';
let deviceLabel = '';
let deviceAddress = '';
let heartbeatTimer = null;
let metricsTimer = null;
let commandPollTimer = null;
let remoteSessionPollTimer = null;
let remoteFrameTimer = null;
let remoteSocket = null;
let remoteSessionId = '';
let remoteJoinedSessionId = '';
let remoteSessionRecord = null;
let remoteConsentStatus = 'pending';
let remoteConsentPromptVisible = false;
let remoteConsentTimer = null;
let remoteLastInputAt = null;
let remoteLastInputSummary = 'Awaiting operator input';
let latestServices = [];
let latestMetrics = {
  cpu: 0,
  ram: 0,
  disk: 0,
  degradedServices: 0
};
let remoteCursor = { x: 0.58, y: 0.42 };
let remoteActivityLog = [];
const runningExecutions = new Set();

function randomBetween(min, max) {
  return Number((Math.random() * (max - min) + min).toFixed(2));
}

function randomServiceStatus() {
  const chance = Math.random();
  if (chance < 0.85) return 'running';
  if (chance < 0.95) return 'degraded';
  return 'stopped';
}

function metricValue(forced, min, max) {
  if (Number.isFinite(forced)) {
    return Number(forced);
  }

  return randomBetween(min, max);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function rememberRemoteActivity(message) {
  const at = new Date().toISOString();
  remoteLastInputAt = at;
  remoteLastInputSummary = message;
  remoteActivityLog = [{ message, at }, ...remoteActivityLog].slice(0, 5);
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

async function api(path, options = {}, authenticated = true, allowReauth = true) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authenticated && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (response.status === 401 && authenticated && allowReauth) {
    console.warn(`[simulator] access token expired while calling ${path}; re-authenticating`);
    await authenticate();
    return api(path, options, authenticated, false);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${path} failed: ${response.status} ${text}`);
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
      body: JSON.stringify({ email: SIM_EMAIL, password: SIM_PASSWORD })
    },
    false
  );

  accessToken = result.tokens.accessToken;
  console.log(`[simulator] authenticated as ${SIM_EMAIL}`);
}

async function ensureClient() {
  const list = await api(`/clients?search=${encodeURIComponent(SIM_CLIENT_NAME)}&limit=1&page=1`);
  const existing = list.items?.find((item) => item.name === SIM_CLIENT_NAME);
  if (existing) {
    return existing;
  }

  return api('/clients', {
    method: 'POST',
    body: JSON.stringify({
      name: SIM_CLIENT_NAME,
      status: 'active',
      tags: ['simulator', 'auto'],
      notes: 'Created by local agent simulator'
    })
  });
}

async function ensureDevice(clientId) {
  const hostname = process.env.SIM_DEVICE_HOSTNAME || `sim-device-${Date.now()}`;
  const ipAddress = process.env.SIM_DEVICE_IP || `10.99.0.${Math.floor(Math.random() * 200) + 10}`;
  const os = process.env.SIM_DEVICE_OS || 'Ubuntu 22.04';

  const existingList = await api(`/devices?search=${encodeURIComponent(hostname)}&limit=1&page=1`);
  if (existingList.items?.length > 0) {
    return existingList.items[0];
  }

  return api('/devices', {
    method: 'POST',
    body: JSON.stringify({
      clientId,
      hostname,
      ipAddress,
      os,
      tags: ['simulator', 'agent'],
      notes: 'Registered by local simulator',
      inventory: {
        cpuModel: 'Simulated CPU',
        cpuCores: 8,
        ramGb: 16,
        diskGb: 512,
        serialNumber: `SIM-${Date.now()}`,
        services: ['backup-agent', 'security-agent']
      }
    })
  });
}

async function registerAgent(deviceIdValue) {
  const registration = await api('/agents/register', {
    method: 'POST',
    body: JSON.stringify({
      deviceId: deviceIdValue,
      version: 'sim-2.0.0'
    })
  });

  return registration.token;
}

async function sendHeartbeat(status = 'online') {
  latestServices = [
    { name: 'backup-agent', status: randomServiceStatus() },
    { name: 'security-agent', status: randomServiceStatus() },
    { name: 'monitor-agent', status: randomServiceStatus() }
  ];

  await api(
    '/agents/heartbeat',
    {
      method: 'POST',
      body: JSON.stringify({
        agentToken,
        status,
        services: latestServices
      })
    },
    false
  );

  console.log(`[simulator] heartbeat sent status=${status}`);
}

async function sendMetrics() {
  latestMetrics = {
    cpu: metricValue(SIM_FORCE_CPU, 15, 88),
    ram: metricValue(SIM_FORCE_RAM, 20, 92),
    disk: metricValue(SIM_FORCE_DISK, 35, 85),
    degradedServices: Math.floor(randomBetween(0, 3.99))
  };

  await api(
    '/monitoring/ingest',
    {
      method: 'POST',
      body: JSON.stringify({
        agentToken,
        metrics: [
          { type: 'cpu', value: latestMetrics.cpu, unit: '%' },
          { type: 'ram', value: latestMetrics.ram, unit: '%' },
          { type: 'disk', value: latestMetrics.disk, unit: '%' },
          { type: 'service', value: latestMetrics.degradedServices, unit: 'degraded-services' }
        ]
      })
    },
    false
  );

  console.log('[simulator] metrics ingested');
}

async function pullCommands() {
  const response = await api(
    '/script-executions/commands/pull',
    {
      method: 'POST',
      body: JSON.stringify({ agentToken })
    },
    false
  );

  return response.commands || [];
}

function shouldFailCommand(command) {
  if (typeof command?.body === 'string' && command.body.toLowerCase().includes('fail')) {
    return true;
  }

  const random = Math.random();
  return random > SCRIPT_SUCCESS_RATE;
}

async function reportScriptResult(executionId, status, logs, result) {
  await api(
    '/script-executions/report',
    {
      method: 'POST',
      body: JSON.stringify({
        agentToken,
        executionId,
        status,
        logs,
        result
      })
    },
    false
  );
}

async function processCommand(command) {
  const executionId = command.executionId;
  if (!executionId || runningExecutions.has(executionId)) {
    return;
  }

  runningExecutions.add(executionId);
  console.log(`[simulator] command received execution=${executionId} script=${command.scriptName}`);

  const durationMs = Math.floor(Math.random() * 2400) + 600;
  await new Promise((resolve) => setTimeout(resolve, durationMs));

  const failed = shouldFailCommand(command);
  const status = failed ? 'failed' : 'success';
  const logs = [
    `[agent] executing ${command.scriptName} on ${deviceId}`,
    `[agent] platform=${command.platform}`,
    `[agent] finished status=${status}`
  ];
  const result = {
    exitCode: failed ? 1 : 0,
    durationMs,
    output: failed ? 'simulated error while executing script' : 'simulated execution success',
    parameters: command.parameters || {}
  };

  try {
    await reportScriptResult(executionId, status, logs, result);
    console.log(`[simulator] result reported execution=${executionId} status=${status}`);
  } catch (error) {
    console.error('[simulator] failed to report script result', error.message);
  } finally {
    runningExecutions.delete(executionId);
  }
}

async function pollAndProcessCommands() {
  try {
    const commands = await pullCommands();
    if (commands.length === 0) {
      return;
    }

    for (const command of commands) {
      void processCommand(command);
    }
  } catch (error) {
    console.error('[simulator] command poll error', error.message);
  }
}

function buildRemoteFrameSvg() {
  const generatedAt = new Date();
  const timestamp = new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(generatedAt);
  const serviceCards = latestServices
    .map((service, index) => {
      const fill =
        service.status === 'running' ? '#10b981' : service.status === 'degraded' ? '#f59e0b' : '#ef4444';
      const y = 436 + index * 58;
      return `
        <rect x="744" y="${y}" width="216" height="42" rx="16" fill="rgba(15,23,42,0.62)" stroke="rgba(148,163,184,0.18)" />
        <circle cx="772" cy="${y + 21}" r="7" fill="${fill}" />
        <text x="792" y="${y + 16}" fill="#cbd5e1" font-size="13" font-family="Segoe UI, Arial">${escapeXml(service.name)}</text>
        <text x="792" y="${y + 31}" fill="#94a3b8" font-size="12" font-family="Segoe UI, Arial">${escapeXml(service.status)}</text>
      `;
    })
    .join('');
  const activityRows = remoteActivityLog
    .map((entry, index) => {
      const y = 492 + index * 32;
      return `
        <text x="76" y="${y}" fill="#e2e8f0" font-size="13" font-family="Segoe UI, Arial">${escapeXml(entry.message)}</text>
        <text x="76" y="${y + 16}" fill="#64748b" font-size="11" font-family="Segoe UI, Arial">${escapeXml(entry.at)}</text>
      `;
    })
    .join('');
  const consentPrompt = remoteConsentPromptVisible
    ? `
      <g>
        <rect x="168" y="178" width="434" height="158" rx="26" fill="rgba(2,6,23,0.94)" stroke="rgba(103,232,249,0.45)" />
        <text x="198" y="220" fill="#67e8f9" font-size="14" font-family="Segoe UI, Arial">Consent required</text>
        <text x="198" y="255" fill="#f8fafc" font-size="26" font-family="Segoe UI, Arial" font-weight="700">Remote control request</text>
        <text x="198" y="286" fill="#cbd5e1" font-size="15" font-family="Segoe UI, Arial">Easyli is asking permission to unlock mouse and keyboard control.</text>
        <text x="198" y="309" fill="#94a3b8" font-size="13" font-family="Segoe UI, Arial">Demo flow: consent will auto-approve in a moment.</text>
        <rect x="198" y="328" width="126" height="36" rx="18" fill="rgba(16,185,129,0.18)" stroke="rgba(52,211,153,0.35)" />
        <text x="235" y="351" fill="#dcfce7" font-size="13" font-family="Segoe UI, Arial" font-weight="700">Allow control</text>
        <rect x="338" y="328" width="110" height="36" rx="18" fill="rgba(239,68,68,0.12)" stroke="rgba(248,113,113,0.28)" />
        <text x="376" y="351" fill="#fee2e2" font-size="13" font-family="Segoe UI, Arial" font-weight="700">Deny</text>
      </g>
    `
    : '';

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">
      <defs>
        <linearGradient id="bgA" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#08132b" />
          <stop offset="58%" stop-color="#0f172a" />
          <stop offset="100%" stop-color="#10233e" />
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#bgA)" />
      <rect x="34" y="30" width="1212" height="660" rx="32" fill="rgba(8,15,28,0.38)" stroke="rgba(125,211,252,0.14)" />
      <rect x="58" y="54" width="1164" height="54" rx="20" fill="rgba(15,23,42,0.68)" stroke="rgba(148,163,184,0.16)" />
      <circle cx="96" cy="81" r="8" fill="#ef4444" />
      <circle cx="124" cy="81" r="8" fill="#f59e0b" />
      <circle cx="152" cy="81" r="8" fill="#10b981" />
      <text x="188" y="87" fill="#e2e8f0" font-size="18" font-family="Segoe UI, Arial" font-weight="700">Easyli Agent Live Bridge</text>
      <text x="1020" y="87" fill="#94a3b8" font-size="13" font-family="Segoe UI, Arial">${escapeXml(timestamp)}</text>

      <rect x="74" y="136" width="620" height="286" rx="28" fill="rgba(15,23,42,0.72)" stroke="rgba(125,211,252,0.16)" />
      <text x="102" y="180" fill="#94a3b8" font-size="14" font-family="Segoe UI, Arial">Assisted device</text>
      <text x="102" y="214" fill="#f8fafc" font-size="34" font-family="Segoe UI, Arial" font-weight="700">${escapeXml(deviceLabel || 'Windows workstation')}</text>
      <text x="102" y="246" fill="#cbd5e1" font-size="16" font-family="Segoe UI, Arial">${escapeXml(deviceAddress || '10.99.0.10')}</text>
      <text x="102" y="278" fill="#67e8f9" font-size="16" font-family="Segoe UI, Arial">Provider: ${escapeXml(REMOTE_PROVIDER)}</text>
      <text x="102" y="320" fill="#f8fafc" font-size="18" font-family="Segoe UI, Arial">Consent: ${escapeXml(remoteConsentStatus)}</text>
      <text x="102" y="352" fill="#f8fafc" font-size="18" font-family="Segoe UI, Arial">Last input: ${escapeXml(remoteLastInputSummary)}</text>
      ${consentPrompt}

      <rect x="730" y="136" width="468" height="286" rx="28" fill="rgba(15,23,42,0.68)" stroke="rgba(16,185,129,0.18)" />
      <text x="758" y="180" fill="#94a3b8" font-size="14" font-family="Segoe UI, Arial">Telemetry</text>
      <text x="758" y="218" fill="#f8fafc" font-size="22" font-family="Segoe UI, Arial" font-weight="700">CPU ${latestMetrics.cpu}%</text>
      <rect x="758" y="230" width="370" height="14" rx="7" fill="rgba(30,41,59,0.84)" />
      <rect x="758" y="230" width="${Math.max(32, latestMetrics.cpu * 3.7)}" height="14" rx="7" fill="#38bdf8" />
      <text x="758" y="280" fill="#f8fafc" font-size="22" font-family="Segoe UI, Arial" font-weight="700">RAM ${latestMetrics.ram}%</text>
      <rect x="758" y="292" width="370" height="14" rx="7" fill="rgba(30,41,59,0.84)" />
      <rect x="758" y="292" width="${Math.max(32, latestMetrics.ram * 3.7)}" height="14" rx="7" fill="#22c55e" />
      <text x="758" y="342" fill="#f8fafc" font-size="22" font-family="Segoe UI, Arial" font-weight="700">Disk ${latestMetrics.disk}%</text>
      <rect x="758" y="354" width="370" height="14" rx="7" fill="rgba(30,41,59,0.84)" />
      <rect x="758" y="354" width="${Math.max(32, latestMetrics.disk * 3.7)}" height="14" rx="7" fill="#f59e0b" />
      <text x="758" y="398" fill="#94a3b8" font-size="13" font-family="Segoe UI, Arial">Degraded services: ${latestMetrics.degradedServices}</text>

      <rect x="74" y="446" width="620" height="216" rx="28" fill="rgba(15,23,42,0.7)" stroke="rgba(148,163,184,0.16)" />
      <text x="102" y="484" fill="#94a3b8" font-size="14" font-family="Segoe UI, Arial">Operator activity</text>
      ${activityRows || '<text x="76" y="524" fill="#64748b" font-size="13" font-family="Segoe UI, Arial">No operator actions received yet.</text>'}

      <rect x="730" y="446" width="468" height="216" rx="28" fill="rgba(15,23,42,0.7)" stroke="rgba(148,163,184,0.16)" />
      <text x="758" y="484" fill="#94a3b8" font-size="14" font-family="Segoe UI, Arial">Services</text>
      ${serviceCards}

      <circle cx="${Math.round(74 + remoteCursor.x * 620)}" cy="${Math.round(136 + remoteCursor.y * 286)}" r="12" fill="rgba(248,250,252,0.92)" />
      <circle cx="${Math.round(74 + remoteCursor.x * 620)}" cy="${Math.round(136 + remoteCursor.y * 286)}" r="4" fill="#0f172a" />
    </svg>
  `.trim();
}

function emitRemoteNotice(level, message) {
  if (!remoteSocket || !remoteSessionId || !remoteSocket.connected) {
    return;
  }

  remoteSocket.emit('agent.notice', {
    sessionId: remoteSessionId,
    level,
    message
  });
}

function emitRemoteTelemetry(overrides = {}) {
  if (!remoteSocket || !remoteSessionId || !remoteSocket.connected) {
    return;
  }

  remoteSocket.emit('agent.telemetry', {
    sessionId: remoteSessionId,
    connectionState: currentRemoteState(),
    consentStatus: remoteConsentStatus,
    fps: Math.max(1, Math.round(1000 / REMOTE_RENDER_INTERVAL_MS)),
    latencyMs: Math.round(randomBetween(24, 68)),
    quality: 92,
    streamActive: Boolean(remoteJoinedSessionId),
    frameWidth: 1280,
    frameHeight: 720,
    lastInputAt: remoteLastInputAt,
    lastInputSummary: remoteLastInputSummary,
    capabilities: ['pointer', 'keyboard', 'clipboard'],
    ...overrides
  });
}

function emitRemoteFrame() {
  if (!remoteSocket || !remoteJoinedSessionId || !remoteSocket.connected) {
    return;
  }

  const generatedAt = new Date().toISOString();
  remoteSocket.emit('agent.frame', {
    sessionId: remoteJoinedSessionId,
    mimeType: 'image/svg+xml',
    payload: buildRemoteFrameSvg(),
    width: 1280,
    height: 720,
    generatedAt
  });
  emitRemoteTelemetry({ lastFrameAt: generatedAt });
}

function stopRemoteRenderer() {
  if (remoteFrameTimer) {
    clearInterval(remoteFrameTimer);
    remoteFrameTimer = null;
  }
}

function startRemoteRenderer() {
  stopRemoteRenderer();
  remoteFrameTimer = setInterval(() => {
    emitRemoteFrame();
  }, REMOTE_RENDER_INTERVAL_MS);
}

function handleRemoteControl(event = {}) {
  const type = typeof event.type === 'string' ? event.type : '';
  const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};

  if (!type) {
    return;
  }

  switch (type) {
    case 'pointer.move':
      if (Number.isFinite(payload.x)) {
        remoteCursor.x = Math.max(0.02, Math.min(0.98, Number(payload.x)));
      }
      if (Number.isFinite(payload.y)) {
        remoteCursor.y = Math.max(0.02, Math.min(0.98, Number(payload.y)));
      }
      remoteLastInputSummary = `Pointer moved to ${Math.round(remoteCursor.x * 100)}% x ${Math.round(
        remoteCursor.y * 100
      )}%`;
      remoteLastInputAt = new Date().toISOString();
      break;
    case 'pointer.down':
      rememberRemoteActivity(`Pointer click at ${Math.round(remoteCursor.x * 100)}% x ${Math.round(remoteCursor.y * 100)}%`);
      break;
    case 'key.down':
      rememberRemoteActivity(`Key pressed: ${String(payload.key || payload.code || 'unknown')}`);
      break;
    case 'viewer.snapshot.request':
      rememberRemoteActivity('Operator requested an instant snapshot');
      break;
    case 'session.consent.request':
      if (remoteConsentTimer) {
        clearTimeout(remoteConsentTimer);
        remoteConsentTimer = null;
      }

      rememberRemoteActivity('Consent requested from the assisted workstation');
      remoteConsentStatus = 'pending';
      remoteConsentPromptVisible = true;
      emitRemoteNotice('info', 'Consent prompt displayed on the assisted device.');
      remoteConsentTimer = setTimeout(() => {
        remoteConsentTimer = null;
        remoteConsentPromptVisible = false;
        remoteConsentStatus = 'granted';
        rememberRemoteActivity('Consent granted on the assisted workstation');
        emitRemoteNotice('info', 'User consent granted on the assisted device.');
        emitRemoteFrame();
      }, 1200);
      break;
    default:
      rememberRemoteActivity(`Control event received: ${type}`);
      break;
  }

  emitRemoteFrame();
}

function ensureRemoteSocket() {
  if (remoteSocket) {
    return remoteSocket;
  }

  remoteSocket = io(REMOTE_WS_URL, {
    transports: ['websocket'],
    auth: {
      agentToken
    }
  });

  remoteSocket.on('connect', () => {
    console.log('[simulator] remote bridge socket connected');
    if (remoteSessionRecord) {
      remoteSocket.emit('agent.join', {
        sessionId: remoteSessionRecord._id,
        agentToken
      });
    }
  });

  remoteSocket.on('disconnect', (reason) => {
    console.log(`[simulator] remote bridge socket disconnected reason=${reason}`);
    remoteJoinedSessionId = '';
    stopRemoteRenderer();
  });

  remoteSocket.on('remote.joined', (event) => {
    if (event?.role !== 'agent' || !remoteSessionRecord) {
      return;
    }

    remoteJoinedSessionId = remoteSessionRecord._id;
    console.log(`[simulator] remote session joined ${remoteJoinedSessionId}`);
    emitRemoteNotice('info', 'Windows agent bridge is now live inside Easyli.');
    startRemoteRenderer();
    emitRemoteFrame();
  });

  remoteSocket.on('remote.control', handleRemoteControl);

  remoteSocket.on('remote.error', (event) => {
    console.error(`[simulator] remote bridge error ${event?.message || 'unknown error'}`);
  });

  return remoteSocket;
}

function resetRemoteSessionState() {
  remoteSessionId = '';
  remoteJoinedSessionId = '';
  remoteSessionRecord = null;
  remoteConsentStatus = 'pending';
  remoteConsentPromptVisible = false;
  remoteLastInputAt = null;
  remoteLastInputSummary = 'Awaiting operator input';
  remoteActivityLog = [];
  remoteCursor = { x: 0.58, y: 0.42 };

  if (remoteConsentTimer) {
    clearTimeout(remoteConsentTimer);
    remoteConsentTimer = null;
  }

  stopRemoteRenderer();
}

function attachRemoteSession(session) {
  const nextConsentStatus = session?.metadata?.consentRequired === false ? 'granted' : 'pending';

  if (remoteSessionId === session._id && remoteSessionRecord?.status === session.status) {
    remoteSessionRecord = session;
    return;
  }

  remoteSessionRecord = session;
  remoteSessionId = session._id;
  remoteJoinedSessionId = '';
  remoteConsentStatus = nextConsentStatus;
  remoteLastInputSummary = 'Awaiting operator input';
  remoteActivityLog = [];

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
    (session) =>
      session.provider === REMOTE_PROVIDER && session.status !== 'ended' && session.status !== 'failed'
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
        emitRemoteNotice('warn', 'Remote session no longer available for this device.');
        resetRemoteSessionState();
      }
      return;
    }

    attachRemoteSession(nextSession);
  } catch (error) {
    console.error(`[simulator] remote session sync error ${error.message}`);
  }
}

async function shutdown() {
  console.log('[simulator] stopping...');

  try {
    if (agentToken) {
      await sendHeartbeat('offline');
    }
  } catch (error) {
    console.error('[simulator] failed to send offline heartbeat', error.message);
  }

  if (heartbeatTimer) clearInterval(heartbeatTimer);
  if (metricsTimer) clearInterval(metricsTimer);
  if (commandPollTimer) clearInterval(commandPollTimer);
  if (remoteSessionPollTimer) clearInterval(remoteSessionPollTimer);

  stopRemoteRenderer();

  if (remoteSocket) {
    remoteSocket.disconnect();
    remoteSocket = null;
  }

  process.exit(0);
}

async function start() {
  await authenticate();

  const client = await ensureClient();
  const device = await ensureDevice(client._id);
  deviceId = device._id;
  deviceLabel = device.hostname;
  deviceAddress = device.ipAddress;
  agentToken = await registerAgent(deviceId);

  console.log(`[simulator] device=${device.hostname} (${deviceId}) agent registered token=${agentToken}`);

  await sendHeartbeat('online');
  await sendMetrics();
  await syncRemoteSessions();

  heartbeatTimer = setInterval(() => {
    void sendHeartbeat('online').catch((error) => {
      console.error('[simulator] heartbeat error', error.message);
    });
  }, HEARTBEAT_INTERVAL_MS);

  metricsTimer = setInterval(() => {
    void sendMetrics()
      .then(() => {
        emitRemoteFrame();
      })
      .catch((error) => {
        console.error('[simulator] metrics error', error.message);
      });
  }, METRIC_INTERVAL_MS);

  commandPollTimer = setInterval(() => {
    void pollAndProcessCommands();
  }, COMMAND_POLL_INTERVAL_MS);

  remoteSessionPollTimer = setInterval(() => {
    void syncRemoteSessions();
  }, REMOTE_SESSION_POLL_INTERVAL_MS);

  await pollAndProcessCommands();

  console.log('[simulator] running. Press Ctrl+C to stop and mark agent offline.');
}

process.on('SIGINT', () => {
  void shutdown();
});

process.on('SIGTERM', () => {
  void shutdown();
});

void start().catch((error) => {
  console.error('[simulator] failed to start', error);
  process.exit(1);
});
