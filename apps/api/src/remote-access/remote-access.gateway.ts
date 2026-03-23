import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AgentDocument } from '../agents/agent.schema';
import {
  normalizeRemoteInteractionMode,
  type RemoteInteractionMode,
  remoteInteractionModes
} from './remote-access.providers';
import { RemoteAccessService } from './remote-access.service';

interface WsAccessTokenPayload {
  sub: string;
  tenantId: string | null;
  permissions?: string[];
}

interface RemoteOperatorState {
  role: 'operator';
  sessionId: string;
  tenantId: string;
  userId: string;
  permissions: string[];
}

interface RemoteAgentState {
  role: 'agent';
  sessionId: string;
  tenantId: string;
  deviceId: string;
  agentId: string;
  agentVersion: string;
  joinedAt: string;
}

type RemoteSocketState = RemoteOperatorState | RemoteAgentState;

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

interface RemoteFrameEvent {
  sessionId: string;
  mimeType: 'image/svg+xml' | 'image/png' | 'image/jpeg';
  payload: string;
  width: number;
  height: number;
  displayId?: string;
  generatedAt: string;
}

interface RemoteNoticeEvent {
  sessionId: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  at: string;
}

@WebSocketGateway({ namespace: '/ws/remote-access', cors: { origin: '*' } })
export class RemoteAccessGateway implements OnGatewayDisconnect {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly remoteAccessService: RemoteAccessService
  ) {}

  @WebSocketServer()
  server!: Server;

  private readonly socketState = new Map<string, RemoteSocketState>();
  private readonly latestFrames = new Map<string, RemoteFrameEvent>();
  private readonly latestTelemetry = new Map<string, RemoteTelemetryEvent>();
  private readonly latestNotices = new Map<string, RemoteNoticeEvent[]>();

  @SubscribeMessage('operator.join')
  async handleOperatorJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string; token?: string; tenantId?: string }
  ) {
    const sessionId = payload?.sessionId?.trim();
    if (!sessionId) {
      this.emitError(client, 'sessionId is required');
      return;
    }

    const accessTokenPayload = this.verifyToken(client, payload?.token);
    if (!accessTokenPayload) {
      this.emitError(client, 'invalid token');
      return;
    }

    const permissions = accessTokenPayload.permissions ?? [];
    const isPlatformUser = permissions.includes('*');
    const tenantId = (isPlatformUser ? payload?.tenantId : accessTokenPayload.tenantId)?.trim();

    if (!tenantId) {
      this.emitError(client, 'tenantId is required for this session');
      return;
    }

    if (!isPlatformUser && !permissions.includes('remote-access:read')) {
      this.emitError(client, 'insufficient permissions');
      return;
    }

    let session: Awaited<ReturnType<RemoteAccessService['findById']>>;
    try {
      session = await this.remoteAccessService.findById(tenantId, sessionId);
    } catch {
      this.emitError(client, 'remote session not found');
      return;
    }

    client.join(this.sessionRoom(sessionId));
    client.join(this.operatorRoom(sessionId));
    this.socketState.set(client.id, {
      role: 'operator',
      sessionId,
      tenantId,
      userId: accessTokenPayload.sub,
      permissions
    });

    client.emit('remote.joined', { role: 'operator', sessionId, tenantId });
    this.emitPresence(sessionId, tenantId);

    const telemetry =
      this.latestTelemetry.get(sessionId) ?? this.buildSessionTelemetry(sessionId, session.status, session.metadata ?? {});
    client.emit('remote.telemetry', telemetry);

    const frame = this.latestFrames.get(sessionId);
    if (frame) {
      client.emit('remote.frame', frame);
    }

    const notices = this.latestNotices.get(sessionId) ?? [];
    notices.forEach((notice) => client.emit('remote.notice', notice));
  }

  @SubscribeMessage('agent.join')
  async handleAgentJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string; agentToken?: string }
  ) {
    const sessionId = payload?.sessionId?.trim();
    const agentToken = payload?.agentToken?.trim();

    if (!sessionId || !agentToken) {
      this.emitError(client, 'sessionId and agentToken are required');
      return;
    }

    try {
      const { session, agent } = await this.remoteAccessService.authorizeAgentSession(sessionId, agentToken);
      const tenantId = String(agent.tenantId);

      // Validar se sessão está em estado válido para agente conectar
      if (!['active', 'requested'].includes(session.status)) {
        throw new Error(`Cannot join session with status "${session.status}"`);
      }

      client.join(this.sessionRoom(sessionId));
      client.join(this.agentRoom(sessionId));
      this.socketState.set(client.id, this.buildAgentState(sessionId, agent));

      client.emit('remote.joined', { role: 'agent', sessionId, tenantId });
      this.cacheNotice(sessionId, {
        sessionId,
        level: 'info',
        message: 'Windows agent bridge connected.',
        at: new Date().toISOString()
      });

      const telemetry =
        this.latestTelemetry.get(sessionId) ?? this.buildSessionTelemetry(sessionId, session.status, session.metadata ?? {});

      this.latestTelemetry.set(sessionId, telemetry);
      client.emit('remote.telemetry', telemetry);
      this.emitPresence(sessionId, tenantId);
    } catch (error) {
      this.emitError(client, error instanceof Error ? error.message : 'agent join failed');
    }
  }

  @SubscribeMessage('operator.control')
  handleOperatorControl(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      sessionId?: string;
      type?: string;
      payload?: Record<string, unknown>;
    }
  ) {
    const state = this.socketState.get(client.id);
    const sessionId = payload?.sessionId?.trim();
    const type = payload?.type?.trim();

    if (!state || state.role !== 'operator' || !sessionId || state.sessionId !== sessionId) {
      this.emitError(client, 'operator is not joined to this session');
      return;
    }

    if (!this.canControl(state.permissions)) {
      this.emitError(client, 'remote-access:write permission is required');
      return;
    }

    if (!type) {
      this.emitError(client, 'control type is required');
      return;
    }

    if (type === 'session.interaction-mode.set') {
      const interactionMode = payload?.payload?.interactionMode;
      if (
        typeof interactionMode !== 'string' ||
        !(remoteInteractionModes as readonly string[]).includes(interactionMode)
      ) {
        this.emitError(client, 'valid interactionMode is required');
        return;
      }
    }

    const event = {
      sessionId,
      type,
      payload: payload?.payload ?? {},
      at: new Date().toISOString(),
      actor: {
        userId: state.userId
      }
    };

    // Validar se agente está realmente conectado antes de rotear comando
    let agentConnected = false;
    for (const [, socketState] of this.socketState) {
      if (socketState.role === 'agent' && socketState.sessionId === sessionId) {
        agentConnected = true;
        break;
      }
    }

    if (!agentConnected) {
      this.emitError(client, 'No agent is currently connected to this session');
      return;
    }

    this.server.to(this.agentRoom(sessionId)).emit('remote.control', event);
  }

  @SubscribeMessage('operator.request-snapshot')
  handleOperatorRequestSnapshot(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string }
  ) {
    this.handleOperatorControl(client, {
      sessionId: payload?.sessionId,
      type: 'viewer.snapshot.request',
      payload: {}
    });
  }

  @SubscribeMessage('operator.request-consent')
  handleOperatorRequestConsent(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string }
  ) {
    this.handleOperatorControl(client, {
      sessionId: payload?.sessionId,
      type: 'session.consent.request',
      payload: {}
    });
  }

  @SubscribeMessage('agent.frame')
  handleAgentFrame(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: RemoteFrameEvent
  ) {
    const state = this.socketState.get(client.id);

    if (!state || state.role !== 'agent' || state.sessionId !== payload?.sessionId) {
      this.emitError(client, 'agent is not joined to this session');
      return;
    }

    if (
      !['image/svg+xml', 'image/png', 'image/jpeg'].includes(payload?.mimeType) ||
      typeof payload?.payload !== 'string'
    ) {
      this.emitError(client, 'invalid frame payload');
      return;
    }

    const frame: RemoteFrameEvent = {
      sessionId: state.sessionId,
      mimeType: payload.mimeType,
      payload: payload.payload,
      width: Number(payload.width) || 1280,
      height: Number(payload.height) || 720,
      displayId: typeof payload.displayId === 'string' ? payload.displayId : undefined,
      generatedAt: payload.generatedAt ?? new Date().toISOString()
    };

    this.latestFrames.set(state.sessionId, frame);
    this.server.to(this.operatorRoom(state.sessionId)).emit('remote.frame', frame);
  }

  @SubscribeMessage('agent.telemetry')
  handleAgentTelemetry(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: Omit<RemoteTelemetryEvent, 'sessionId'> & { sessionId?: string }
  ) {
    const state = this.socketState.get(client.id);

    if (!state || state.role !== 'agent' || state.sessionId !== payload?.sessionId) {
      this.emitError(client, 'agent is not joined to this session');
      return;
    }

    const telemetry: RemoteTelemetryEvent = {
      sessionId: state.sessionId,
      connectionState: payload.connectionState ?? 'ready',
      consentStatus: payload.consentStatus,
      interactionMode:
        typeof payload.interactionMode === 'string'
          ? normalizeRemoteInteractionMode(payload.interactionMode, 'view-only')
          : undefined,
      inputControlSupported:
        typeof payload.inputControlSupported === 'boolean' ? payload.inputControlSupported : undefined,
      localInputLocked: typeof payload.localInputLocked === 'boolean' ? payload.localInputLocked : undefined,
      fps: payload.fps,
      latencyMs: payload.latencyMs,
      quality: payload.quality,
      lastFrameAt: payload.lastFrameAt,
      lastInputAt: payload.lastInputAt,
      lastInputSummary: payload.lastInputSummary,
      streamActive: payload.streamActive,
      frameWidth: payload.frameWidth,
      frameHeight: payload.frameHeight,
      selectedDisplayId: typeof payload.selectedDisplayId === 'string' ? payload.selectedDisplayId : undefined,
      displays: Array.isArray(payload.displays)
        ? payload.displays.map((entry) => ({
            id: typeof entry?.id === 'string' ? entry.id : 'unknown-display',
            deviceName: typeof entry?.deviceName === 'string' ? entry.deviceName : undefined,
            label: typeof entry?.label === 'string' ? entry.label : 'Monitor',
            index: typeof entry?.index === 'number' ? entry.index : undefined,
            isPrimary: Boolean(entry?.isPrimary),
            x: Number(entry?.x) || 0,
            y: Number(entry?.y) || 0,
            width: Number(entry?.width) || 0,
            height: Number(entry?.height) || 0
          }))
        : undefined,
      capabilities: Array.isArray(payload.capabilities)
        ? payload.capabilities.filter((entry): entry is string => typeof entry === 'string')
        : undefined
    };

    this.latestTelemetry.set(state.sessionId, telemetry);
    this.server.to(this.sessionRoom(state.sessionId)).emit('remote.telemetry', telemetry);
  }

  @SubscribeMessage('agent.notice')
  handleAgentNotice(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { sessionId?: string; level?: 'info' | 'warn' | 'error'; message?: string }
  ) {
    const state = this.socketState.get(client.id);
    const sessionId = payload?.sessionId?.trim();

    if (!state || state.role !== 'agent' || !sessionId || state.sessionId !== sessionId) {
      this.emitError(client, 'agent is not joined to this session');
      return;
    }

    const message = payload?.message?.trim();
    if (!message) {
      this.emitError(client, 'notice message is required');
      return;
    }

    this.cacheNotice(sessionId, {
      sessionId,
      level: payload.level ?? 'info',
      message,
      at: new Date().toISOString()
    });
  }

  handleDisconnect(client: Socket) {
    const state = this.socketState.get(client.id);
    if (!state) {
      return;
    }

    this.socketState.delete(client.id);

    if (state.role === 'agent') {
      this.cacheNotice(state.sessionId, {
        sessionId: state.sessionId,
        level: 'warn',
        message: 'Windows agent bridge disconnected.',
        at: new Date().toISOString()
      });
    }

    this.emitPresence(state.sessionId, state.tenantId);
  }

  private buildAgentState(sessionId: string, agent: AgentDocument): RemoteAgentState {
    return {
      role: 'agent',
      sessionId,
      tenantId: String(agent.tenantId),
      deviceId: String(agent.deviceId),
      agentId: String(agent._id),
      agentVersion: agent.version,
      joinedAt: new Date().toISOString()
    };
  }

  private emitPresence(sessionId: string, tenantId: string) {
    const presence = this.buildPresence(sessionId, tenantId);
    this.server.to(this.sessionRoom(sessionId)).emit('remote.presence', presence);
  }

  private buildPresence(sessionId: string, tenantId: string): RemotePresenceEvent {
    let operatorCount = 0;
    let agent: RemotePresenceEvent['agent'] = null;

    for (const state of this.socketState.values()) {
      if (state.sessionId !== sessionId) {
        continue;
      }

      if (state.role === 'operator') {
        operatorCount += 1;
        continue;
      }

      agent = {
        agentId: state.agentId,
        deviceId: state.deviceId,
        version: state.agentVersion,
        joinedAt: state.joinedAt
      };
    }

    return {
      sessionId,
      tenantId,
      operatorCount,
      agentConnected: Boolean(agent),
      agent
    };
  }

  private cacheNotice(sessionId: string, notice: RemoteNoticeEvent) {
    const current = this.latestNotices.get(sessionId) ?? [];
    const next = [...current.slice(-9), notice];
    this.latestNotices.set(sessionId, next);
    this.server.to(this.sessionRoom(sessionId)).emit('remote.notice', notice);
  }

  private buildSessionTelemetry(
    sessionId: string,
    status: 'requested' | 'active' | 'ended' | 'failed',
    metadata: Record<string, unknown>
  ): RemoteTelemetryEvent {
    return {
      sessionId,
      connectionState: status === 'ended' ? 'ended' : status === 'active' ? 'active' : 'ready',
      interactionMode: normalizeRemoteInteractionMode(metadata?.interactionMode, 'view-only'),
      inputControlSupported: metadata?.supportsPointer === true && metadata?.supportsKeyboard === true,
      localInputLocked: false,
      streamActive: false
    };
  }

  private canControl(permissions: string[]): boolean {
    return permissions.includes('*') || permissions.includes('remote-access:write');
  }

  private sessionRoom(sessionId: string): string {
    return `remote:session:${sessionId}`;
  }

  private operatorRoom(sessionId: string): string {
    return `${this.sessionRoom(sessionId)}:operators`;
  }

  private agentRoom(sessionId: string): string {
    return `${this.sessionRoom(sessionId)}:agents`;
  }

  private verifyToken(client: Socket, payloadToken?: string): WsAccessTokenPayload | null {
    const token = this.extractToken(client, payloadToken);
    if (!token) {
      return null;
    }

    try {
      return this.jwtService.verify<WsAccessTokenPayload>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change')
      });
    } catch {
      return null;
    }
  }

  private extractToken(client: Socket, payloadToken?: string): string | null {
    const candidate =
      this.normalizeToken(payloadToken) ??
      this.normalizeToken((client.handshake.auth as Record<string, unknown> | undefined)?.token) ??
      this.normalizeToken(client.handshake.headers?.authorization);

    return candidate;
  }

  private normalizeToken(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.replace(/^Bearer\s+/i, '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private emitError(client: Socket, message: string) {
    client.emit('remote.error', {
      message,
      at: new Date().toISOString()
    });
  }
}
