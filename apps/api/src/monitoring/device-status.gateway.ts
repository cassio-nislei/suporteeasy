import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

export interface DeviceStatusEvent {
  tenantId: string;
  deviceId: string;
  hostname: string;
  onlineStatus: 'online' | 'offline' | 'unknown';
  lastHeartbeatAt: string | null;
}

interface WsAccessTokenPayload {
  sub: string;
  tenantId: string | null;
  permissions?: string[];
}

@WebSocketGateway({ namespace: '/ws/devices', cors: { origin: '*' } })
export class DeviceStatusGateway {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  @WebSocketServer()
  server!: Server;

  @SubscribeMessage('subscribe')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tenantId?: string; token?: string }
  ) {
    const tenantId = payload?.tenantId?.trim();
    if (!tenantId) {
      return { ok: false, reason: 'tenantId is required' };
    }

    const accessTokenPayload = this.verifyToken(client, payload?.token);
    if (!accessTokenPayload) {
      return { ok: false, reason: 'invalid token' };
    }

    const permissions = accessTokenPayload.permissions ?? [];
    const isPlatformUser = permissions.includes('*');

    if (!isPlatformUser && accessTokenPayload.tenantId !== tenantId) {
      return { ok: false, reason: 'tenant mismatch' };
    }

    if (!isPlatformUser && !permissions.includes('devices:read')) {
      return { ok: false, reason: 'insufficient permissions' };
    }

    client.join(this.tenantRoom(tenantId));
    return { ok: true };
  }

  emitDeviceStatus(event: DeviceStatusEvent): void {
    if (!this.server) {
      return;
    }

    this.server.to(this.tenantRoom(event.tenantId)).emit('device.status.updated', event);
  }

  private tenantRoom(tenantId: string): string {
    return `tenant:${tenantId}`;
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
}
