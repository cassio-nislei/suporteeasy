export const remoteAccessProviders = [
  'easyli-agent',
  'builtin-sim',
  'rustdesk',
  'anydesk',
  'teamviewer',
  'browser-link'
] as const;

export type RemoteAccessProvider = (typeof remoteAccessProviders)[number];
export const remoteInteractionModes = ['view-only', 'shared-control', 'remote-only'] as const;
export type RemoteInteractionMode = (typeof remoteInteractionModes)[number];

type ProviderMode = 'embedded-agent' | 'simulated' | 'external-app' | 'browser-link';

export function normalizeRemoteInteractionMode(
  value: unknown,
  fallback: RemoteInteractionMode = 'view-only'
): RemoteInteractionMode {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if ((remoteInteractionModes as readonly string[]).includes(normalized)) {
      return normalized as RemoteInteractionMode;
    }
  }

  return fallback;
}

function randomToken(length: number, alphabet: string): string {
  let output = '';

  for (let index = 0; index < length; index++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length);
    output += alphabet[randomIndex];
  }

  return output;
}

function readString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readBoolean(metadata: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = metadata[key];

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }

  return fallback;
}

function readStringArray(metadata: Record<string, unknown>, key: string): string[] | null {
  const value = metadata[key];

  if (!Array.isArray(value)) {
    return null;
  }

  const entries = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);

  return entries.length > 0 ? entries : null;
}

function providerLabel(provider: RemoteAccessProvider): string {
  switch (provider) {
    case 'easyli-agent':
      return 'Easyli Windows Agent';
    case 'rustdesk':
      return 'RustDesk';
    case 'anydesk':
      return 'AnyDesk';
    case 'teamviewer':
      return 'TeamViewer';
    case 'browser-link':
      return 'Secure Browser Link';
    case 'builtin-sim':
    default:
      return 'Easyli Remote Bridge';
  }
}

function providerMode(provider: RemoteAccessProvider): ProviderMode {
  switch (provider) {
    case 'easyli-agent':
      return 'embedded-agent';
    case 'builtin-sim':
      return 'simulated';
    case 'browser-link':
      return 'browser-link';
    case 'rustdesk':
    case 'anydesk':
    case 'teamviewer':
    default:
      return 'external-app';
  }
}

function providerCodePrefix(provider: RemoteAccessProvider): string {
  switch (provider) {
    case 'easyli-agent':
      return 'AGNT';
    case 'rustdesk':
      return 'RUST';
    case 'anydesk':
      return 'ADSK';
    case 'teamviewer':
      return 'TVWR';
    case 'browser-link':
      return 'WEB';
    case 'builtin-sim':
    default:
      return 'EASY';
  }
}

function generateConnectionCode(provider: RemoteAccessProvider): string {
  return `${providerCodePrefix(provider)}-${randomToken(4, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789')}-${randomToken(
    4,
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  )}`;
}

function generatePasscode(): string {
  return randomToken(6, 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789');
}

function defaultInstructions(provider: RemoteAccessProvider): string[] {
  switch (provider) {
    case 'easyli-agent':
      return [
        'Keep the Easyli Windows agent online on the assisted device.',
        'Open this session console in the browser to receive the embedded live viewer.',
        'Use the in-app controls to request consent, send keyboard or pointer input, and end the session.'
      ];
    case 'rustdesk':
      return [
        'Open RustDesk on the technician workstation and on the assisted device.',
        'Use the connection code below and confirm the remote password on the target host.',
        'Return to Easyli to track, start and end the support session audit trail.'
      ];
    case 'anydesk':
      return [
        'Open AnyDesk on both sides of the session.',
        'Share the remote address and optional unattended password with the technician.',
        'When the work is done, close the external client and end the session in Easyli.'
      ];
    case 'teamviewer':
      return [
        'Launch TeamViewer on the target device and on the technician workstation.',
        'Use the partner ID and passcode shown in this session console.',
        'Keep Easyli open to preserve the operational log and session status.'
      ];
    case 'browser-link':
      return [
        'Open the provider browser link from this session console.',
        'Validate user consent before taking control of the remote workstation.',
        'Use Easyli to close the session once the remote work is complete.'
      ];
    case 'builtin-sim':
    default:
      return [
        'Use the simulated launch link to walk through the session flow.',
        'Change the session status in Easyli to represent the live support lifecycle.',
        'This provider is intended for demos until a real remote engine is connected.'
      ];
  }
}

function defaultLaunchLabel(provider: RemoteAccessProvider): string {
  switch (provider) {
    case 'easyli-agent':
      return 'Open embedded viewer';
    case 'rustdesk':
    case 'anydesk':
    case 'teamviewer':
      return 'Open provider';
    case 'browser-link':
      return 'Open browser session';
    case 'builtin-sim':
    default:
      return 'Open simulated console';
  }
}

function defaultLaunchUrl(
  provider: RemoteAccessProvider,
  connectionCode: string,
  metadata: Record<string, unknown>
): string | null {
  const providedUrl = readString(metadata, 'launchUrl');
  if (providedUrl) {
    return providedUrl;
  }

  if (provider === 'builtin-sim') {
    return `https://remote.local/session/${connectionCode.toLowerCase()}`;
  }

  return null;
}

export function buildRemoteSessionMetadata(
  provider: RemoteAccessProvider,
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  const connectionCode =
    readString(metadata, 'connectionCode') ??
    readString(metadata, 'sessionCode') ??
    readString(metadata, 'remoteAddress') ??
    generateConnectionCode(provider);
  const passcode =
    readString(metadata, 'passcode') ?? readString(metadata, 'accessPassword') ?? generatePasscode();
  const consentRequired = readBoolean(metadata, 'consentRequired', true);
  const instructions = readStringArray(metadata, 'instructions') ?? defaultInstructions(provider);
  const launchUrl = defaultLaunchUrl(provider, connectionCode, metadata);
  const providerModeValue = providerMode(provider);
  const interactionMode = normalizeRemoteInteractionMode(metadata.interactionMode, 'view-only');

  return {
    ...metadata,
    reason: readString(metadata, 'reason') ?? 'On-demand support session',
    operatorNote: readString(metadata, 'operatorNote') ?? readString(metadata, 'notes'),
    connectionCode,
    passcode,
    consentRequired,
    providerLabel: providerLabel(provider),
    providerMode: providerModeValue,
    viewerEmbedded: providerModeValue === 'embedded-agent',
    requiresExternalApp: providerModeValue === 'external-app',
    requiresAgent: providerModeValue === 'embedded-agent',
    interactionMode,
    signalNamespace: providerModeValue === 'embedded-agent' ? '/ws/remote-access' : null,
    supportsKeyboard: providerModeValue === 'embedded-agent',
    supportsPointer: providerModeValue === 'embedded-agent',
    supportsClipboard: providerModeValue === 'embedded-agent',
    supportsFileTransfer: false,
    launchLabel: launchUrl ? defaultLaunchLabel(provider) : null,
    launchUrl,
    instructions
  };
}
