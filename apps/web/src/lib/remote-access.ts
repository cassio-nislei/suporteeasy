import type {
  RemoteAccessProvider,
  RemoteInteractionMode,
  RemoteSessionMetadata,
  RemoteSessionRecord
} from '@/lib/api/operations';

export interface RemoteProviderDefinition {
  value: RemoteAccessProvider;
  label: string;
  summary: string;
  connectionCodeLabel: string;
  passcodeLabel: string;
  launchUrlLabel: string;
  launchHint: string;
  defaultReason: string;
  steps: string[];
}

export const REMOTE_PROVIDER_OPTIONS: RemoteProviderDefinition[] = [
  {
    value: 'easyli-agent',
    label: 'Easyli Windows Agent',
    summary: 'Use the Easyli agent to stream a live embedded viewer inside the browser with operational telemetry.',
    connectionCodeLabel: 'Bridge code',
    passcodeLabel: 'Session secret',
    launchUrlLabel: 'Embedded viewer channel',
    launchHint: 'No external URL is required. The viewer appears directly inside the Easyli session console.',
    defaultReason: 'Assist a workstation through the Easyli Windows agent',
    steps: [
      'Keep the Easyli Windows agent online on the assisted device.',
      'Create the session and open the dedicated Easyli console.',
      'Use the embedded viewer, consent flow and in-app controls to complete the remote work.'
    ]
  },
  {
    value: 'rustdesk',
    label: 'RustDesk',
    summary: 'Use an external RustDesk client while Easyli orchestrates the session lifecycle.',
    connectionCodeLabel: 'RustDesk ID',
    passcodeLabel: 'Remote password',
    launchUrlLabel: 'Deep link or helper URL',
    launchHint: 'Optional. Paste a custom deep link if your deployment exposes one.',
    defaultReason: 'Assist a workstation through RustDesk',
    steps: [
      'Open RustDesk on the technician workstation and on the assisted device.',
      'Share the remote ID and password from this Easyli session console.',
      'Start and end the session in Easyli to preserve the audit trail.'
    ]
  },
  {
    value: 'anydesk',
    label: 'AnyDesk',
    summary: 'Track AnyDesk sessions from Easyli without building a native streaming stack yet.',
    connectionCodeLabel: 'AnyDesk address',
    passcodeLabel: 'Unattended password',
    launchUrlLabel: 'Helper URL',
    launchHint: 'Optional. Use this when your AnyDesk rollout exposes a launch URL.',
    defaultReason: 'Assist a workstation through AnyDesk',
    steps: [
      'Open AnyDesk on both sides of the session.',
      'Use the address and password from Easyli to connect.',
      'End the session in Easyli when the remote work finishes.'
    ]
  },
  {
    value: 'teamviewer',
    label: 'TeamViewer',
    summary: 'Keep TeamViewer as the remote engine and Easyli as the operational console.',
    connectionCodeLabel: 'Partner ID',
    passcodeLabel: 'Session password',
    launchUrlLabel: 'Launch URL',
    launchHint: 'Optional. Paste a custom TeamViewer launch URL if available.',
    defaultReason: 'Assist a workstation through TeamViewer',
    steps: [
      'Launch TeamViewer on the target device and on the technician workstation.',
      'Use the partner ID and password stored in this session record.',
      'Keep Easyli open to track the status and operational context.'
    ]
  },
  {
    value: 'browser-link',
    label: 'Secure Browser Link',
    summary: 'Use a vendor portal or browser-based remote console while Easyli manages the workflow.',
    connectionCodeLabel: 'Session code',
    passcodeLabel: 'Access code',
    launchUrlLabel: 'Browser URL',
    launchHint: 'Recommended. Paste the remote portal URL that the technician should open.',
    defaultReason: 'Assist a workstation through a browser-based remote portal',
    steps: [
      'Open the browser session URL from Easyli.',
      'Validate user consent before taking remote control.',
      'Close the Easyli session once the vendor portal session is complete.'
    ]
  },
  {
    value: 'builtin-sim',
    label: 'Easyli Remote Bridge',
    summary: 'Demo provider used to validate the remote-session workflow before wiring a real engine.',
    connectionCodeLabel: 'Bridge code',
    passcodeLabel: 'Bridge secret',
    launchUrlLabel: 'Simulated launch URL',
    launchHint: 'Auto-generated for demo flows. Replace it later with a real provider.',
    defaultReason: 'Run a guided remote support demo',
    steps: [
      'Open the simulated launch URL from the session console.',
      'Use the generated bridge code and passcode to walk through the support flow.',
      'This mode is for demos until a real remote engine is connected.'
    ]
  }
];

export function getRemoteProviderDefinition(provider: string | null | undefined): RemoteProviderDefinition {
  return (
    REMOTE_PROVIDER_OPTIONS.find((option) => option.value === provider) ??
    REMOTE_PROVIDER_OPTIONS.find((option) => option.value === 'builtin-sim') ??
    REMOTE_PROVIDER_OPTIONS[0]
  );
}

export function getRemoteSessionMetadata(session: Pick<RemoteSessionRecord, 'metadata'>): RemoteSessionMetadata {
  return session.metadata ?? {};
}

export function getRemoteMetadataText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function getRemoteMetadataFlag(value: unknown, fallback = false): boolean {
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

export function getRemoteInteractionMode(
  value: unknown,
  fallback: RemoteInteractionMode = 'view-only'
): RemoteInteractionMode {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'view-only' || normalized === 'shared-control' || normalized === 'remote-only') {
      return normalized as RemoteInteractionMode;
    }
  }

  return fallback;
}

export function getRemoteInteractionModeLabel(mode: RemoteInteractionMode): string {
  switch (mode) {
    case 'shared-control':
      return 'Shared control';
    case 'remote-only':
      return 'Remote only';
    case 'view-only':
    default:
      return 'View only';
  }
}

export function getRemoteInstructions(session: RemoteSessionRecord): string[] {
  const metadata = getRemoteSessionMetadata(session);
  const fromMetadata = Array.isArray(metadata.instructions)
    ? metadata.instructions.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return fromMetadata.length > 0 ? fromMetadata : getRemoteProviderDefinition(session.provider).steps;
}

export function getRemoteSessionDeviceLabel(session: RemoteSessionRecord): string {
  if (session.deviceId && typeof session.deviceId === 'object') {
    return session.deviceId.hostname;
  }

  return session.deviceId;
}

export function getRemoteSessionDeviceIp(session: RemoteSessionRecord): string | null {
  if (session.deviceId && typeof session.deviceId === 'object') {
    return session.deviceId.ipAddress;
  }

  return null;
}

export function getRemoteSessionRequester(session: RemoteSessionRecord): string {
  if (session.requestedBy && typeof session.requestedBy === 'object') {
    return session.requestedBy.email;
  }

  return 'Unknown requester';
}

export function formatRemoteDateTime(value: string | null | undefined): string {
  if (!value) {
    return 'Not available';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not available';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function getRemoteStatusClasses(status: RemoteSessionRecord['status']): string {
  switch (status) {
    case 'active':
      return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'failed':
      return 'border-rose-400/40 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    case 'ended':
      return 'border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300';
    case 'requested':
    default:
      return 'border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  }
}

export function buildRemoteCopyBundle(session: RemoteSessionRecord): string {
  const metadata = getRemoteSessionMetadata(session);
  const provider = getRemoteProviderDefinition(session.provider);
  const connectionCode = getRemoteMetadataText(metadata.connectionCode);
  const passcode = getRemoteMetadataText(metadata.passcode);
  const launchUrl = getRemoteMetadataText(metadata.launchUrl);
  const reason = getRemoteMetadataText(metadata.reason);
  const operatorNote = getRemoteMetadataText(metadata.operatorNote);

  return [
    `Provider: ${provider.label}`,
    `Device: ${getRemoteSessionDeviceLabel(session)}`,
    getRemoteSessionDeviceIp(session) ? `IP: ${getRemoteSessionDeviceIp(session)}` : null,
    connectionCode ? `${provider.connectionCodeLabel}: ${connectionCode}` : null,
    passcode ? `${provider.passcodeLabel}: ${passcode}` : null,
    reason ? `Reason: ${reason}` : null,
    operatorNote ? `Operator note: ${operatorNote}` : null,
    launchUrl ? `Launch URL: ${launchUrl}` : null
  ]
    .filter((entry): entry is string => Boolean(entry))
    .join('\n');
}
