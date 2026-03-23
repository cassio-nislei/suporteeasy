'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
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
import { RemoteAccessPhase1Page } from '@/components/app/remote-access-phase1';
import { useToast } from '@/providers/toast-provider';

export default function RemoteAccessPage() {
  return <RemoteAccessPhase1Page />;
}

function LegacyRemoteAccessPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { push } = useToast();
  const [deviceId, setDeviceId] = useState('');
  const [provider, setProvider] = useState<(typeof REMOTE_PROVIDER_OPTIONS)[number]['value']>('rustdesk');
  const [reason, setReason] = useState(getRemoteProviderDefinition('rustdesk').defaultReason);
  const [connectionCode, setConnectionCode] = useState('');
  const [passcode, setPasscode] = useState('');
  const [launchUrl, setLaunchUrl] = useState('');
  const [operatorNote, setOperatorNote] = useState('');
  const [consentRequired, setConsentRequired] = useState(true);

  const providerDefinition = getRemoteProviderDefinition(provider);

  const devicesQuery = useQuery({
    queryKey: ['remote-devices'],
    queryFn: () => listDevices({ page: 1, limit: 100 })
  });
  const sessionsQuery = useQuery({
    queryKey: ['remote-sessions'],
    queryFn: () => listRemoteSessions({ page: 1, limit: 50 })
  });

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
      router.push(`/remote-access/${session._id}`);
    },
    onError: (error) => {
      push({ title: 'Session creation failed', description: (error as Error).message, variant: 'error' });
    }
  });

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
      <div>
        <h1 className="text-2xl font-semibold">Remote Access</h1>
        <p className="text-sm text-muted-foreground">Remote session workspace.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Session</CardTitle>
          <CardDescription>Create a remote session request for a device.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <select
            className="h-10 min-w-80 rounded-md border px-3 text-sm"
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
          >
            <option value="">Select device</option>
            {(devicesQuery.data?.items ?? []).map((device) => (
              <option key={device._id} value={device._id}>
                {device.hostname} ({device.ipAddress})
              </option>
            ))}
          </select>
          <Button type="button" disabled={!deviceId || createMutation.isPending} onClick={() => createMutation.mutate()}>
            {createMutation.isPending ? 'Requesting...' : 'Request'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Start/end sessions and inspect metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(sessionsQuery.data?.items ?? []).map((session) => (
            <div key={session._id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {session.deviceId && typeof session.deviceId === 'object'
                      ? session.deviceId.hostname
                      : session.deviceId}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {session.status} - {session.provider}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button type="button" variant="outline" size="sm" onClick={() => transition(session._id, 'start')}>
                    Start
                  </Button>
                  <Button type="button" size="sm" onClick={() => transition(session._id, 'end')}>
                    End
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!sessionsQuery.isLoading && (sessionsQuery.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No remote sessions yet.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
