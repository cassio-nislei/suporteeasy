'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RemoteAccessLiveBridge } from '@/components/app/remote-access-live-bridge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { endRemoteSession, getRemoteSession, startRemoteSession } from '@/lib/api/operations';
import {
  buildRemoteCopyBundle,
  formatRemoteDateTime,
  getRemoteInteractionModeLabel,
  getRemoteInstructions,
  getRemoteInteractionMode,
  getRemoteMetadataFlag,
  getRemoteMetadataText,
  getRemoteProviderDefinition,
  getRemoteSessionDeviceIp,
  getRemoteSessionDeviceLabel,
  getRemoteSessionMetadata,
  getRemoteSessionRequester,
  getRemoteStatusClasses
} from '@/lib/remote-access';
import { useToast } from '@/providers/toast-provider';

export default function RemoteSessionDetailPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const queryClient = useQueryClient();
  const { push } = useToast();

  const sessionQuery = useQuery({
    queryKey: ['remote-session', sessionId],
    queryFn: () => getRemoteSession(sessionId)
  });

  const transitionMutation = useMutation({
    mutationFn: async (action: 'start' | 'end') =>
      action === 'start' ? startRemoteSession(sessionId) : endRemoteSession(sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['remote-session', sessionId] });
      void queryClient.invalidateQueries({ queryKey: ['remote-sessions'] });
      push({ title: 'Session updated', variant: 'success' });
    },
    onError: (error) => {
      push({ title: 'Session update failed', description: (error as Error).message, variant: 'error' });
    }
  });

  async function copyValue(label: string, value: string | null) {
    if (!value) {
      push({ title: `${label} not available`, variant: 'error' });
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      push({ title: `${label} copied`, variant: 'success' });
    } catch (error) {
      push({ title: 'Clipboard failed', description: (error as Error).message, variant: 'error' });
    }
  }

  function openLaunchUrl(url: string | null) {
    if (!url) {
      push({ title: 'Launch URL not available', variant: 'error' });
      return;
    }

    window.open(url, '_blank', 'noopener,noreferrer');
  }

  if (sessionQuery.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading remote session...</p>;
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <p className="text-sm text-red-600">{(sessionQuery.error as Error)?.message ?? 'Remote session not found'}</p>
    );
  }

  const session = sessionQuery.data;
  const metadata = getRemoteSessionMetadata(session);
  const provider = getRemoteProviderDefinition(session.provider);
  const connectionCode = getRemoteMetadataText(metadata.connectionCode);
  const passcode = getRemoteMetadataText(metadata.passcode);
  const launchUrl = getRemoteMetadataText(metadata.launchUrl);
  const reason = getRemoteMetadataText(metadata.reason);
  const operatorNote = getRemoteMetadataText(metadata.operatorNote);
  const interactionMode = getRemoteInteractionMode(metadata.interactionMode, 'view-only');
  const instructions = getRemoteInstructions(session);
  const isEmbeddedBridge = session.provider === 'easyli-agent' || getRemoteMetadataFlag(metadata.viewerEmbedded, false);

  const connectionDetails = (
    <Card>
      <CardHeader>
        <CardTitle>Connection Details</CardTitle>
        <CardDescription>Everything the technician needs before opening the provider.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Device</p>
          <p className="mt-1 font-medium">{getRemoteSessionDeviceLabel(session)}</p>
          <p className="text-muted-foreground">{getRemoteSessionDeviceIp(session) ?? 'No IP stored'}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Reason</p>
          <p className="mt-1">{reason ?? 'Not provided'}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Consent policy</p>
          <p className="mt-1">
            {getRemoteMetadataFlag(metadata.consentRequired, true)
              ? 'User consent required'
              : 'No explicit consent gate'}
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Interaction mode</p>
          <p className="mt-1">{getRemoteInteractionModeLabel(interactionMode)}</p>
        </div>
        <div className="rounded-xl border border-border/70 bg-background/70 p-3">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">{provider.launchUrlLabel}</p>
          <p className="mt-1 break-all">{launchUrl ?? 'Not provided'}</p>
        </div>
        {operatorNote ? (
          <div className="rounded-xl border border-border/70 bg-background/70 p-3">
            <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Operator note</p>
            <p className="mt-1 whitespace-pre-wrap">{operatorNote}</p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );

  const auditTrail = (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
        <CardDescription>Session lifecycle timestamps tracked by the SaaS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
          <div>
            <p className="font-medium">Requested</p>
            <p className="text-muted-foreground">Session created and waiting for activation.</p>
          </div>
          <span className="text-right text-muted-foreground">{formatRemoteDateTime(session.createdAt)}</span>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
          <div>
            <p className="font-medium">Started</p>
            <p className="text-muted-foreground">Provider connection opened for technician work.</p>
          </div>
          <span className="text-right text-muted-foreground">{formatRemoteDateTime(session.startedAt)}</span>
        </div>
        <div className="flex items-start justify-between gap-3 rounded-xl border border-border/70 bg-background/70 p-3">
          <div>
            <p className="font-medium">Ended</p>
            <p className="text-muted-foreground">Operator finished the session inside Easyli.</p>
          </div>
          <span className="text-right text-muted-foreground">{formatRemoteDateTime(session.endedAt)}</span>
        </div>
      </CardContent>
    </Card>
  );

  const pageHeader = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <Link href="/remote-access" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            Back to sessions
          </Link>
          <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getRemoteStatusClasses(session.status)}`}>
            {session.status}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-semibold">{getRemoteSessionDeviceLabel(session)}</h1>
        <p className="text-sm text-muted-foreground">
          {provider.label} session requested by {getRemoteSessionRequester(session)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => transitionMutation.mutate('start')}
          disabled={transitionMutation.isPending}
        >
          Start session
        </Button>
        <Button type="button" onClick={() => transitionMutation.mutate('end')} disabled={transitionMutation.isPending}>
          End session
        </Button>
        {!isEmbeddedBridge ? (
          <Button type="button" variant="secondary" onClick={() => openLaunchUrl(launchUrl)}>
            Open provider
          </Button>
        ) : null}
      </div>
    </div>
  );

  if (isEmbeddedBridge) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <RemoteAccessLiveBridge session={session} />
        <div className="grid gap-6 xl:grid-cols-2">
          {connectionDetails}
          {auditTrail}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {pageHeader}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Remote Session Console</CardTitle>
            <CardDescription>
              Dedicated operational console for provider launch, connection data and guided support workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.22),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_36%),linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.94))] p-6 text-slate-100 shadow-[0_45px_120px_-58px_rgba(8,47,73,0.95)]">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.34em] text-cyan-100/70">Remote orchestration</p>
                  <p className="mt-3 text-2xl font-semibold">{provider.label}</p>
                  <p className="mt-2 max-w-xl text-sm text-slate-300">
                    Phase 1 keeps the remote engine in the external provider while Easyli owns the session lifecycle,
                    audit trail and connection bundle.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-right">
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Session state</p>
                  <p className="mt-2 text-lg font-semibold capitalize">{session.status}</p>
                  <p className="mt-1 text-xs text-slate-400">Created {formatRemoteDateTime(session.createdAt)}</p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-cyan-200/15 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{provider.connectionCodeLabel}</p>
                  <p className="mt-2 text-xl font-semibold">{connectionCode ?? 'Auto-generated by provider workflow'}</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/15 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{provider.passcodeLabel}</p>
                  <p className="mt-2 text-xl font-semibold">{passcode ?? 'Hidden by provider policy'}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyValue(provider.connectionCodeLabel, connectionCode)}
                >
                  Copy code
                </Button>
                <Button type="button" variant="secondary" onClick={() => copyValue(provider.passcodeLabel, passcode)}>
                  Copy passcode
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => copyValue('Connection bundle', buildRemoteCopyBundle(session))}
                >
                  Copy bundle
                </Button>
                <Button type="button" onClick={() => openLaunchUrl(launchUrl)}>
                  {getRemoteMetadataText(metadata.launchLabel) ?? 'Open provider'}
                </Button>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border/70 bg-background/70 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Connection workflow</p>
                  <p className="text-sm text-muted-foreground">
                    This phase does not render native screen streaming inside Easyli yet. Use the provider and keep this
                    console open for operational control.
                  </p>
                </div>
                <span className="rounded-full border border-border/70 px-3 py-1 text-xs text-muted-foreground">
                  {getRemoteMetadataFlag(metadata.requiresExternalApp, false)
                    ? 'External app required'
                    : 'Browser compatible'}
                </span>
              </div>
              <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
                {instructions.map((step, index) => (
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

        <div className="space-y-6">
          {connectionDetails}
          {auditTrail}
        </div>
      </div>
    </div>
  );
}
