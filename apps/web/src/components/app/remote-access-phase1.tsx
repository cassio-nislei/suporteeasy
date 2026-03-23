'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  createRemoteSession,
  endRemoteSession,
  listDevices,
  listRemoteSessions,
  startRemoteSession
} from '@/lib/api/operations';
import { getMe } from '@/lib/auth/client';
import {
  REMOTE_PROVIDER_OPTIONS,
  formatRemoteDateTime,
  getRemoteMetadataFlag,
  getRemoteMetadataText,
  getRemoteProviderDefinition,
  getRemoteSessionDeviceIp,
  getRemoteSessionDeviceLabel,
  getRemoteSessionMetadata,
  getRemoteStatusClasses
} from '@/lib/remote-access';
import { useToast } from '@/providers/toast-provider';

export function RemoteAccessPhase1Page() {
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [deviceId, setDeviceId] = useState('');
  const [provider, setProvider] = useState<(typeof REMOTE_PROVIDER_OPTIONS)[number]['value']>('easyli-agent');
  const [reason, setReason] = useState(getRemoteProviderDefinition('easyli-agent').defaultReason);
  const [connectionCode, setConnectionCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [operatorNote, setOperatorNote] = useState('');
  const [consentRequired, setConsentRequired] = useState(true);

  const providerDefinition = getRemoteProviderDefinition(provider);
  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: getMe
  });
  const hasTenantContext = Boolean(meQuery.data?.tenantId);

  const devicesQuery = useQuery({
    queryKey: ['remote-devices'],
    queryFn: () => listDevices({ page: 1, limit: 100 }),
    enabled: hasTenantContext
  });
  const sessionsQuery = useQuery({
    queryKey: ['remote-sessions'],
    queryFn: () => listRemoteSessions({ page: 1, limit: 50 }),
    enabled: hasTenantContext
  });
  const devices = useMemo(() => devicesQuery.data?.items ?? [], [devicesQuery.data?.items]);

  useEffect(() => {
    if (!deviceId && devices.length > 0) {
      setDeviceId(devices[0]._id);
    }
  }, [deviceId, devices]);

  const createMutation = useMutation({
    mutationFn: () =>
      createRemoteSession({
        deviceId,
        provider,
        metadata: {
          reason,
          connectionCode,
          passcode,
          launchUrl,
          operatorNote,
          consentRequired
        }
      }),
    onSuccess: (session) => {
      void queryClient.invalidateQueries({ queryKey: ['remote-sessions'] });
      push({ title: 'Remote session created', variant: 'success' });
      if (typeof window !== 'undefined') {
        window.location.assign(`/remote-access/${session._id}`);
      }
    },
    onError: (error) => {
      push({ title: 'Session creation failed', description: (error as Error).message, variant: 'error' });
    }
  });
  const createDisabled =
    !hasTenantContext || devicesQuery.isLoading || devices.length === 0 || !deviceId || createMutation.isPending;

  async function transition(sessionId: string, action: 'start' | 'end') {
    try {
      if (action === 'start') {
        await startRemoteSession(sessionId);
      } else {
        await endRemoteSession(sessionId);
      }

      void queryClient.invalidateQueries({ queryKey: ['remote-sessions'] });
      push({ title: `Session ${action}ed`, variant: 'success' });
    } catch (error) {
      push({ title: 'Action failed', description: (error as Error).message, variant: 'error' });
    }
  }

  function handleProviderChange(nextProvider: (typeof REMOTE_PROVIDER_OPTIONS)[number]['value']) {
    const nextDefinition = getRemoteProviderDefinition(nextProvider);

    setProvider(nextProvider);
    setReason((current) =>
      current === '' || current === providerDefinition.defaultReason ? nextDefinition.defaultReason : current
    );
    setConnectionCode('');
    setPasscode('');
    setLaunchUrl('');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Remote Access</h1>
          <p className="text-sm text-muted-foreground">
            Phase 2 hybrid console with embedded Easyli agent viewer, plus external providers and full session audit
            trail.
          </p>
        </div>
        <Link href="/remote-access" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
          Session board
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>New Remote Session</CardTitle>
            <CardDescription>
              Create a session, choose the remote engine and keep the operational context inside Easyli.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="font-medium">Device</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={deviceId}
                onChange={(event) => setDeviceId(event.target.value)}
                disabled={!hasTenantContext || devicesQuery.isLoading || devices.length === 0}
              >
                <option value="">Select device</option>
                {devices.map((device) => (
                  <option key={device._id} value={device._id}>
                    {device.hostname} ({device.ipAddress})
                  </option>
                ))}
              </select>
              {!hasTenantContext && meQuery.isSuccess ? (
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  This account has no tenant context. Sign in with `owner@acme.local` or another tenant user.
                </span>
              ) : null}
              {hasTenantContext && devicesQuery.isLoading ? (
                <span className="text-xs text-muted-foreground">Loading tenant devices...</span>
              ) : null}
              {hasTenantContext && devicesQuery.isError ? (
                <span className="text-xs text-red-600">
                  {(devicesQuery.error as Error)?.message ?? 'Unable to load devices for this tenant.'}
                </span>
              ) : null}
              {hasTenantContext && !devicesQuery.isLoading && !devicesQuery.isError && devices.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No devices found for this tenant yet. Register or seed a device before opening a remote session.
                </span>
              ) : null}
              {hasTenantContext && devices.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {deviceId
                    ? 'A device is already selected. You can create the session directly.'
                    : 'The first available device will be selected automatically.'}
                </span>
              ) : null}
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">Provider</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={provider}
                onChange={(event) =>
                  handleProviderChange(event.target.value as (typeof REMOTE_PROVIDER_OPTIONS)[number]['value'])
                }
              >
                {REMOTE_PROVIDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium">Session reason</span>
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={providerDefinition.defaultReason}
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">{providerDefinition.connectionCodeLabel}</span>
              <Input
                value={connectionCode}
                onChange={(event) => setConnectionCode(event.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span className="font-medium">{providerDefinition.passcodeLabel}</span>
              <Input
                value={passcode}
                onChange={(event) => setPasscode(event.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </label>

            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium">{providerDefinition.launchUrlLabel}</span>
              <Input
                value={launchUrl}
                onChange={(event) => setLaunchUrl(event.target.value)}
                placeholder={providerDefinition.launchHint}
              />
              <span className="text-xs text-muted-foreground">{providerDefinition.launchHint}</span>
            </label>

            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="font-medium">Operator note</span>
              <textarea
                className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={operatorNote}
                onChange={(event) => setOperatorNote(event.target.value)}
                placeholder="Escalation notes, customer context, expected validation steps..."
              />
            </label>

            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                className="h-4 w-4 rounded border-input"
                type="checkbox"
                checked={consentRequired}
                onChange={(event) => setConsentRequired(event.target.checked)}
              />
              <span>Require user consent before remote control starts.</span>
            </label>

            <div className="flex items-center gap-2 md:col-span-2">
              <Button type="button" disabled={createDisabled} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? 'Creating...' : 'Create session'}
              </Button>
              <span className="text-xs text-muted-foreground">
                The dedicated session console opens right after creation and hosts the live viewer when the Easyli
                agent is selected.
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{providerDefinition.label}</CardTitle>
            <CardDescription>{providerDefinition.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-3xl border border-white/60 bg-[radial-gradient(circle_at_top,_rgba(15,118,110,0.2),_transparent_56%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.92))] p-5 text-slate-100 shadow-[0_32px_80px_-42px_rgba(15,23,42,0.75)]">
              <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/70">Provider profile</p>
              <p className="mt-3 max-w-sm text-lg font-semibold">{providerDefinition.label}</p>
              <p className="mt-2 max-w-md text-sm text-slate-300">{providerDefinition.summary}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
                  Embedded live viewer
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100">
                  Audit trail retained
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-slate-100">
                  External engine supported
                </span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium">Recommended steps</p>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                {providerDefinition.steps.map((step, index) => (
                  <li key={step} className="flex gap-3">
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[11px] font-semibold">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Board</CardTitle>
          <CardDescription>
            Open the dedicated console, inspect connection data and control the session lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(sessionsQuery.data?.items ?? []).map((session) => {
            const metadata = getRemoteSessionMetadata(session);
            const sessionProvider = getRemoteProviderDefinition(session.provider);
            const connectionValue = getRemoteMetadataText(metadata.connectionCode);
            const reasonValue = getRemoteMetadataText(metadata.reason);
            const launchValue = getRemoteMetadataText(metadata.launchUrl);

            return (
              <div key={session._id} className="rounded-[1.3rem] border border-border/70 bg-background/70 p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{getRemoteSessionDeviceLabel(session)}</p>
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getRemoteStatusClasses(session.status)}`}
                      >
                        {session.status}
                      </span>
                      <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
                        {sessionProvider.label}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {getRemoteSessionDeviceIp(session) ?? 'No IP stored'} - Created{' '}
                      {formatRemoteDateTime(session.createdAt)}
                    </p>
                    {reasonValue ? <p className="text-sm text-muted-foreground">{reasonValue}</p> : null}
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>
                        {connectionValue
                          ? `${sessionProvider.connectionCodeLabel}: ${connectionValue}`
                          : 'Connection code auto-managed'}
                      </span>
                      <span>Consent required: {getRemoteMetadataFlag(metadata.consentRequired, true) ? 'yes' : 'no'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <a
                      href={`/remote-access/${session._id}`}
                      className={buttonVariants({ variant: 'outline', size: 'sm' })}
                    >
                      Open console
                    </a>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => transition(session._id, 'start')}
                    >
                      Start
                    </Button>
                    <Button type="button" size="sm" onClick={() => transition(session._id, 'end')}>
                      End
                    </Button>
                    {launchValue ? (
                      <a
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        href={launchValue}
                        rel="noreferrer"
                        target="_blank"
                      >
                        Open provider
                      </a>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
          {!sessionsQuery.isLoading && (sessionsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No remote sessions yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
