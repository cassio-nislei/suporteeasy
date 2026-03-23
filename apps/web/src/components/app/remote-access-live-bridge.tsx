'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  type RemoteInteractionMode,
  type RemoteSessionRecord,
  updateRemoteSessionInteractionMode
} from '@/lib/api/operations';
import { getAccessToken } from '@/lib/auth/storage';
import {
  formatRemoteDateTime,
  getRemoteInteractionMode,
  getRemoteInteractionModeLabel,
  getRemoteMetadataFlag,
  getRemoteMetadataText
} from '@/lib/remote-access';
import { useToast } from '@/providers/toast-provider';

interface RemotePresenceEvent {
  sessionId: string;
  tenantId: string;
  operatorCount: number;
  agentConnected: boolean;
  agent: null | {
    agentId: string;
    deviceId: string;
    version: string;
    joinedAt: string;
  };
}

interface RemoteTelemetryEvent {
  sessionId: string;
  connectionState: 'waiting' | 'ready' | 'active' | 'ended';
  consentStatus?: 'pending' | 'granted' | 'denied';
  interactionMode?: RemoteInteractionMode;
  inputControlSupported?: boolean;
  localInputLocked?: boolean;
  fps?: number;
  latencyMs?: number;
  quality?: number;
  lastFrameAt?: string;
  lastInputAt?: string;
  lastInputSummary?: string;
  streamActive?: boolean;
  frameWidth?: number;
  frameHeight?: number;
  selectedDisplayId?: string;
  displays?: RemoteDisplayDescriptor[];
  capabilities?: string[];
}

interface RemoteDisplayDescriptor {
  id: string;
  deviceName?: string;
  label: string;
  index?: number;
  isPrimary: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RemoteNoticeEvent {
  sessionId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  at: string;
}

interface RemoteFrameEvent {
  mimeType?: 'image/svg+xml' | 'image/png' | 'image/jpeg';
  payload?: string;
  displayId?: string;
}

export function RemoteAccessLiveBridge({ session }: { session: RemoteSessionRecord }) {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const lastPointerSentAtRef = useRef(0);
  const [connected, setConnected] = useState(false);
  const [presence, setPresence] = useState<RemotePresenceEvent | null>(null);
  const [telemetry, setTelemetry] = useState<RemoteTelemetryEvent | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [notices, setNotices] = useState<RemoteNoticeEvent[]>([]);
  const [consentRequestPending, setConsentRequestPending] = useState(false);
  const [lastConsentNotice, setLastConsentNotice] = useState<string | null>(null);
  const [interactionModeOverride, setInteractionModeOverride] = useState<RemoteInteractionMode | null>(null);

  const requiresConsent = getRemoteMetadataFlag(session.metadata?.consentRequired, true);
  const consentStatus = telemetry?.consentStatus ?? (requiresConsent ? 'pending' : 'granted');
  const connectionState = telemetry?.connectionState ?? 'waiting';
  const signalNamespace = getRemoteMetadataText(session.metadata?.signalNamespace) ?? '/ws/remote-access';
  const agentConnected = Boolean(presence?.agentConnected);
  const persistedInteractionMode = getRemoteInteractionMode(session.metadata?.interactionMode, 'view-only');
  const interactionMode = getRemoteInteractionMode(
    interactionModeOverride ?? telemetry?.interactionMode,
    persistedInteractionMode
  );

  const capabilityList = useMemo(
    () =>
      Array.isArray(telemetry?.capabilities) && telemetry?.capabilities.length > 0
        ? telemetry.capabilities
        : ['pointer', 'keyboard', 'clipboard'],
    [telemetry?.capabilities]
  );
  const inputControlAvailable =
    telemetry?.inputControlSupported ?? (capabilityList.includes('pointer') && capabilityList.includes('keyboard'));
  const localInputLocked = Boolean(telemetry?.localInputLocked);
  const controlsUnlocked =
    interactionMode !== 'view-only' && inputControlAvailable && (!requiresConsent || consentStatus === 'granted');
  const displays = useMemo(
    () => (Array.isArray(telemetry?.displays) ? telemetry.displays.filter((display) => Boolean(display?.id)) : []),
    [telemetry?.displays]
  );
  const selectedDisplay = useMemo(() => {
    const selected = displays.find((display) => display.id === telemetry?.selectedDisplayId);
    return selected ?? displays.find((display) => display.isPrimary) ?? displays[0] ?? null;
  }, [displays, telemetry?.selectedDisplayId]);
  const interactionModeMutation = useMutation({
    mutationFn: async (nextMode: RemoteInteractionMode) => {
      const updatedSession = await updateRemoteSessionInteractionMode(session._id, nextMode);
      sendControl('session.interaction-mode.set', { interactionMode: nextMode });
      return updatedSession;
    },
    onSuccess: async (_, nextMode) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['remote-session', session._id] }),
        queryClient.invalidateQueries({ queryKey: ['remote-sessions'] })
      ]);
      push({
        title: 'Interaction mode updated',
        description:
          nextMode === 'remote-only'
            ? 'The agent will block local keyboard and mouse when control is unlocked for this session.'
            : nextMode === 'shared-control'
              ? 'Remote control stays enabled while the assisted user can still use the workstation locally.'
              : 'The session is back in view-only mode.'
      });
    },
    onError: (error) => {
      setInteractionModeOverride(null);
      push({
        title: 'Interaction mode update failed',
        description: (error as Error).message,
        variant: 'error'
      });
    }
  });

  const consentSummary = useMemo(() => {
    if (!inputControlAvailable) {
      return {
        title: 'Input support disabled',
        description:
          'This agent policy disabled pointer and keyboard injection. The web session can still stream the desktop, but control cannot be enabled from Easyli.',
        panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      };
    }

    if (interactionMode === 'view-only') {
      return {
        title: 'View-only mode',
        description:
          'The live stream is active, but remote pointer and keyboard are locked until you switch the session to shared control or remote-only mode.',
        panelClass: 'border-slate-300/30 bg-slate-500/10 text-slate-900 dark:text-slate-100'
      };
    }

    if (interactionMode === 'remote-only' && localInputLocked) {
      return {
        title: 'Remote-only mode active',
        description:
          'Remote control is active and the assisted workstation local mouse and keyboard are currently locked by the Windows bridge.',
        panelClass: 'border-rose-400/30 bg-rose-500/10 text-rose-950 dark:text-rose-100'
      };
    }

    if (interactionMode === 'remote-only' && consentStatus === 'granted' && !localInputLocked) {
      return {
        title: 'Remote-only mode degraded',
        description:
          'Remote control is active, but the Windows bridge did not lock the assisted workstation local keyboard and mouse. Check the bridge notices before relying on this mode.',
        panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      };
    }

    if (interactionMode === 'remote-only' && requiresConsent && consentStatus !== 'granted') {
      return {
        title: 'Remote-only mode pending consent',
        description:
          'Remote-only was selected, but local input remains unlocked until the assisted user grants consent for this session.',
        panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      };
    }

    if (!requiresConsent) {
      return {
        title: 'Consent not required',
        description:
          interactionMode === 'shared-control'
            ? 'Pointer and keyboard control are available for both the technician and the assisted user.'
            : 'Remote control is active without an additional consent step for this session.',
        panelClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
      };
    }

    if (!agentConnected) {
      return {
        title: 'Agent connection required',
        description: 'The consent prompt can only be displayed after the Easyli Windows agent connects to this session.',
        panelClass: 'border-amber-400/30 bg-amber-500/10 text-amber-950 dark:text-amber-100'
      };
    }

    if (consentStatus === 'granted') {
      return {
        title: 'Consent granted',
        description: lastConsentNotice ?? 'The assisted user approved remote control. Pointer and keyboard are unlocked.',
        panelClass: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
      };
    }

    if (consentStatus === 'denied') {
      return {
        title: 'Consent denied',
        description:
          lastConsentNotice ?? 'The assisted user denied the request. You can ask for consent again when appropriate.',
        panelClass: 'border-rose-400/30 bg-rose-500/10 text-rose-950 dark:text-rose-100'
      };
    }

    if (consentRequestPending) {
      return {
        title: 'Consent request sent',
        description:
          lastConsentNotice ??
          'The assisted workstation is displaying a confirmation prompt. Waiting for the user response.',
        panelClass: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-950 dark:text-cyan-100'
      };
    }

    return {
      title: 'Consent request required',
      description: 'Click "Request consent" to display the approval prompt on the assisted workstation.',
      panelClass: 'border-slate-300/30 bg-slate-500/10 text-slate-900 dark:text-slate-100'
    };
  }, [
    agentConnected,
    consentRequestPending,
    consentStatus,
    inputControlAvailable,
    interactionMode,
    lastConsentNotice,
    localInputLocked,
    requiresConsent
  ]);

  const requestConsentDisabled =
    !requiresConsent ||
    !inputControlAvailable ||
    !agentConnected ||
    connectionState === 'ended' ||
    consentStatus === 'granted' ||
    consentRequestPending;

  useEffect(() => {
    setConsentRequestPending(false);
    setLastConsentNotice(null);
    setInteractionModeOverride(null);
  }, [session._id]);

  useEffect(() => {
    if (consentStatus === 'granted' || consentStatus === 'denied' || !requiresConsent) {
      setConsentRequestPending(false);
    }
  }, [consentStatus, requiresConsent]);

  useEffect(() => {
    if (
      interactionModeOverride &&
      !interactionModeMutation.isPending &&
      (telemetry?.interactionMode === interactionModeOverride || persistedInteractionMode === interactionModeOverride)
    ) {
      setInteractionModeOverride(null);
    }
  }, [
    interactionModeMutation.isPending,
    interactionModeOverride,
    persistedInteractionMode,
    telemetry?.interactionMode
  ]);

  useEffect(() => {
    const accessToken = getAccessToken();
    if (!accessToken) {
      push({ title: 'No access token found', description: 'Sign in again before opening the remote viewer.', variant: 'error' });
      return;
    }

    const wsBaseUrl =
      process.env.NEXT_PUBLIC_WS_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');
    const socket = io(`${wsBaseUrl}${signalNamespace}`, {
      transports: ['websocket'],
      auth: {
        token: accessToken
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('operator.join', {
        sessionId: session._id,
        tenantId: session.tenantId,
        token: accessToken
      });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('remote.presence', (event: RemotePresenceEvent) => {
      setPresence(event);
    });

    socket.on('remote.telemetry', (event: RemoteTelemetryEvent) => {
      setTelemetry(event);
    });

    socket.on('remote.frame', (event: RemoteFrameEvent) => {
      const nextFrameUrl = buildFrameUrl(event);
      if (!nextFrameUrl) {
        return;
      }

      setFrameUrl(nextFrameUrl);
    });

    socket.on('remote.notice', (event: RemoteNoticeEvent) => {
      const normalizedMessage = event?.message?.trim().toLowerCase() ?? '';

      if (normalizedMessage.includes('consent prompt displayed') || normalizedMessage.includes('consent requested')) {
        setConsentRequestPending(true);
        setLastConsentNotice(event.message);
      }

      if (normalizedMessage.includes('consent granted') || normalizedMessage.includes('consent denied')) {
        setConsentRequestPending(false);
        setLastConsentNotice(event.message);
      }

      setNotices((current) => [event, ...current].slice(0, 6));
    });

    socket.on('remote.error', (event: { message?: string }) => {
      push({
        title: 'Remote bridge error',
        description: event?.message ?? 'Unknown remote bridge error.',
        variant: 'error'
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [push, session._id, session.tenantId, signalNamespace]);

  function emit(event: string, payload: Record<string, unknown>) {
    socketRef.current?.emit(event, payload);
  }

  function sendControl(type: string, payload: Record<string, unknown> = {}) {
    emit('operator.control', {
      sessionId: session._id,
      type,
      payload
    });
  }

  function requestSnapshot() {
    if (!agentConnected) {
      push({
        title: 'Agent offline',
        description: 'Wait for the Easyli Windows agent to connect before requesting a snapshot.',
        variant: 'error'
      });
      return;
    }

    emit('operator.request-snapshot', { sessionId: session._id });
  }

  function requestConsent() {
    if (!requiresConsent) {
      push({
        title: 'Consent not required',
        description: 'This session already allows pointer and keyboard control without explicit approval.'
      });
      return;
    }

    if (!inputControlAvailable) {
      push({
        title: 'Viewer-only mode',
        description:
          'This agent does not accept pointer or keyboard injection. Restart it with EASYLI_ENABLE_LOCAL_INPUT_CONTROL=true only on the assisted workstation.',
        variant: 'error'
      });
      return;
    }

    if (!agentConnected) {
      push({
        title: 'Agent offline',
        description: 'The consent prompt cannot be displayed until the Easyli Windows agent is online for this session.',
        variant: 'error'
      });
      return;
    }

    if (consentStatus === 'granted') {
      push({
        title: 'Consent already granted',
        description: 'Pointer and keyboard control are already unlocked for this session.',
        variant: 'success'
      });
      return;
    }

    setConsentRequestPending(true);
    setLastConsentNotice('Consent request sent to the assisted workstation.');
    emit('operator.request-consent', { sessionId: session._id });
    push({
      title: 'Consent requested',
      description: 'The assisted workstation should now display the approval prompt.'
    });
  }

  function updateInteractionMode(nextMode: RemoteInteractionMode) {
    if (interactionModeMutation.isPending || nextMode === interactionMode) {
      return;
    }

    if (!inputControlAvailable && nextMode !== 'view-only') {
      push({
        title: 'Input support unavailable',
        description: 'This agent policy disabled pointer and keyboard injection, so the session cannot leave view-only mode.',
        variant: 'error'
      });
      return;
    }

    setInteractionModeOverride(nextMode);
    interactionModeMutation.mutate(nextMode);
  }

  function selectDisplay(displayId: string) {
    if (!displayId || displayId === selectedDisplay?.id) {
      return;
    }

    sendControl('viewer.select-display', { displayId });
    push({
      title: 'Monitor switch requested',
      description: 'The assisted workstation is switching the live stream to the selected monitor.'
    });
  }

  function relativePointerPosition(event: PointerEvent<HTMLDivElement>) {
    const rect = viewerRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }

    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!controlsUnlocked) {
      return;
    }

    const now = Date.now();
    if (now - lastPointerSentAtRef.current < 120) {
      return;
    }

    const coordinates = relativePointerPosition(event);
    if (!coordinates) {
      return;
    }

    lastPointerSentAtRef.current = now;
    sendControl('pointer.move', coordinates);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    viewerRef.current?.focus();
    if (!controlsUnlocked) {
      return;
    }

    const coordinates = relativePointerPosition(event);
    if (!coordinates) {
      return;
    }

    sendControl('pointer.down', {
      ...coordinates,
      button: event.button
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!controlsUnlocked) {
      return;
    }

    event.preventDefault();
    sendControl('key.down', {
      key: event.key,
      code: event.code,
      altKey: event.altKey,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey,
      metaKey: event.metaKey
    });
  }

  function buildFrameUrl(event: RemoteFrameEvent): string | null {
    if (typeof event?.payload !== 'string' || event.payload.length === 0) {
      return null;
    }

    if (event.mimeType === 'image/png' || event.mimeType === 'image/jpeg') {
      return `data:${event.mimeType};base64,${event.payload}`;
    }

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(event.payload)}`;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Embedded Live Viewer</CardTitle>
          <CardDescription>
            Browser-native remote bridge driven by the Easyli Windows agent over WebSocket signaling.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Socket: {connected ? 'connected' : 'disconnected'}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Agent: {presence?.agentConnected ? 'online' : 'waiting'}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Mode: {getRemoteInteractionModeLabel(interactionMode)}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Consent: {requiresConsent ? consentStatus : 'not required'}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Local input: {localInputLocked ? 'locked' : 'unlocked'}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Operators: {presence?.operatorCount ?? 0}
            </span>
            <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
              Display: {selectedDisplay?.label ?? 'waiting'}
            </span>
          </div>

          <div className={`rounded-[1.4rem] border px-4 py-3 text-sm ${consentSummary.panelClass}`}>
            <p className="text-[11px] uppercase tracking-[0.24em] opacity-70">Interaction policy</p>
            <p className="mt-2 font-semibold">{consentSummary.title}</p>
            <p className="mt-1 text-sm opacity-90">{consentSummary.description}</p>
          </div>

          <div
            ref={viewerRef}
            tabIndex={0}
            onKeyDown={handleKeyDown}
            onPointerMove={handlePointerMove}
            onPointerDown={handlePointerDown}
            className="group relative overflow-hidden rounded-[1.8rem] border border-cyan-300/20 bg-slate-950 shadow-[0_40px_110px_-56px_rgba(8,47,73,0.9)] outline-none"
          >
            <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950/75 px-4 py-3 text-xs text-slate-200 backdrop-blur">
              <span>State: {connectionState}</span>
              <span>
                {telemetry?.streamActive
                  ? `Live stream active${selectedDisplay ? ` · ${selectedDisplay.label}` : ''}`
                  : 'Waiting for bridge stream'}
              </span>
            </div>

            {frameUrl ? (
              <img src={frameUrl} alt="Embedded remote viewer" className="block aspect-[16/9] w-full object-cover" />
            ) : (
              <div className="flex aspect-[16/9] w-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_48%),linear-gradient(180deg,#020617,#0f172a)] px-8 text-center text-sm text-slate-300">
                Waiting for the Easyli Windows agent to publish the first live frame.
              </div>
            )}

            {!controlsUnlocked ? (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 px-6 text-center text-sm text-slate-100 backdrop-blur-sm">
                {!inputControlAvailable
                  ? 'This agent policy disabled pointer and keyboard injection. Desktop streaming stays active, but Easyli cannot unlock control for this workstation.'
                  : interactionMode === 'view-only'
                    ? 'The session is currently in view-only mode. Use the interaction buttons below to unlock shared control or remote-only control.'
                  : !agentConnected
                  ? 'The Easyli Windows agent must be online before a consent prompt can be displayed.'
                  : consentRequestPending
                    ? 'Consent request sent. Waiting for the assisted user to approve pointer and keyboard control.'
                    : interactionMode === 'remote-only'
                      ? 'Remote-only mode was selected. Local input will be locked as soon as consent is granted and the control channel is active.'
                    : 'User consent is required before pointer and keyboard control is unlocked. Click "Request consent" to display the prompt.'}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="grid min-w-[220px] gap-2 text-sm">
              <span className="font-medium">Monitor</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={selectedDisplay?.id ?? ''}
                onChange={(event) => selectDisplay(event.target.value)}
                disabled={!agentConnected || displays.length === 0}
              >
                {displays.length === 0 ? <option value="">Waiting for monitor inventory</option> : null}
                {displays.map((display) => (
                  <option key={display.id} value={display.id}>
                    {display.label} ({display.width}x{display.height})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-2 text-sm">
              <span className="font-medium">Interaction mode</span>
              <div className="flex flex-wrap gap-2">
                {(['view-only', 'shared-control', 'remote-only'] as RemoteInteractionMode[]).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={interactionMode === mode ? 'default' : 'outline'}
                    onClick={() => updateInteractionMode(mode)}
                    disabled={interactionModeMutation.isPending}
                  >
                    {mode === 'view-only'
                      ? 'View only'
                      : mode === 'shared-control'
                        ? 'Shared'
                        : 'Remote only'}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                <code>Shared</code> keeps local and remote input active. <code>Remote only</code> asks the Windows
                bridge to lock local keyboard and mouse while control stays unlocked.
              </p>
            </div>
            <Button type="button" variant="outline" onClick={requestSnapshot}>
              Request snapshot
            </Button>
            <Button type="button" variant="outline" onClick={requestConsent} disabled={requestConsentDisabled}>
              {!inputControlAvailable
                ? 'Input disabled'
                : consentStatus === 'granted'
                ? 'Consent granted'
                : consentRequestPending
                  ? 'Waiting for consent'
                  : 'Request consent'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bridge Telemetry</CardTitle>
            <CardDescription>Live operational details from the Windows agent.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Agent version</p>
              <p className="mt-1 font-medium">{presence?.agent?.version ?? 'Waiting for agent'}</p>
              <p className="text-muted-foreground">Joined {formatRemoteDateTime(presence?.agent?.joinedAt ?? null)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">FPS</p>
                <p className="mt-1 text-lg font-semibold">{telemetry?.fps ?? '--'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Latency</p>
                <p className="mt-1 text-lg font-semibold">{telemetry?.latencyMs ?? '--'} ms</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Quality</p>
                <p className="mt-1 text-lg font-semibold">{telemetry?.quality ?? '--'}%</p>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Interaction</p>
                <p className="mt-1 text-lg font-semibold">{getRemoteInteractionModeLabel(interactionMode)}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Input support</p>
                <p className="mt-1 text-lg font-semibold">{inputControlAvailable ? 'enabled' : 'disabled'}</p>
              </div>
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Local workstation</p>
                <p className="mt-1 text-lg font-semibold">{localInputLocked ? 'locked' : 'unlocked'}</p>
              </div>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Last input</p>
              <p className="mt-1">{telemetry?.lastInputSummary ?? 'No operator input received yet.'}</p>
              <p className="text-muted-foreground">{formatRemoteDateTime(telemetry?.lastInputAt ?? null)}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Capabilities</p>
              <p className="mt-1">{capabilityList.join(', ')}</p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/70 p-3">
              <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Monitors</p>
              <p className="mt-1">
                {displays.length === 0
                  ? 'Waiting for the Windows agent to publish monitor inventory.'
                  : displays
                      .map((display) =>
                        display.id === selectedDisplay?.id
                          ? `${display.label} (${display.width}x${display.height}) selected`
                          : `${display.label} (${display.width}x${display.height})`
                      )
                      .join(' · ')}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Live Event Feed</CardTitle>
            <CardDescription>Bridge-level notices emitted by the agent and the remote session gateway.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {notices.length === 0 ? (
              <p className="text-muted-foreground">No bridge notices yet.</p>
            ) : (
              notices.map((notice) => (
                <div key={`${notice.at}-${notice.message}`} className="rounded-xl border border-border/70 bg-background/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{notice.message}</p>
                    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{notice.level}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{formatRemoteDateTime(notice.at)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
