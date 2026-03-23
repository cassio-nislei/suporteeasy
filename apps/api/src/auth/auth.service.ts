import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { Permission } from '../permissions/permission.schema';
import { PermissionsService } from '../permissions/permissions.service';
import { Role } from '../roles/role.schema';
import { RolesService } from '../roles/roles.service';
import { TenantsService } from '../tenants/tenants.service';
import { User, UserStatus } from '../users/user.schema';
import { UsersService } from '../users/users.service';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import { ConfirmEmailVerificationDto } from './dto/confirm-email-verification.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestEmailVerificationDto } from './dto/request-email-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface AccessTokenPayload extends AuthUser {}

interface RefreshTokenPayload {
  sub: string;
  jti: string;
  type: 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly permissionsService: PermissionsService,
    private readonly tenantsService: TenantsService,
    private readonly auditService: AuditService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Optional()
    @InjectQueue(AUTH_EMAIL_QUEUE)
    private readonly authEmailQueue?: Queue
  ) {}

  async login(dto: LoginDto, request?: Request) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      await this.auditService.logAuthAction({
        action: 'auth.login.failed',
        metadata: { email: dto.email, reason: 'user_not_found' },
        ...this.extractRequestMeta(request)
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditService.logAuthAction({
        action: 'auth.login.failed',
        tenantId: user.tenantId ? String(user.tenantId) : null,
        userId: String(user._id),
        metadata: { email: dto.email, reason: 'invalid_password' },
        ...this.extractRequestMeta(request)
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (![UserStatus.ACTIVE, UserStatus.PENDING_VERIFICATION].includes(user.status)) {
      throw new UnauthorizedException('User is not allowed to login');
    }

    const authUser = await this.buildAuthUser(user);
    const tokens = await this.issueTokens(authUser);

    await this.usersService.updateLastLoginAt(String(user._id));

    await this.auditService.logAuthAction({
      action: 'auth.login.success',
      tenantId: authUser.tenantId,
      userId: authUser.sub,
      entityId: authUser.sub,
      metadata: { email: authUser.email },
      ...this.extractRequestMeta(request)
    });

    return {
      tokens,
      user: await this.composeMeResponse(authUser.sub)
    };
  }

  async refresh(dto: RefreshTokenDto, request?: Request) {
    let payload: RefreshTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(dto.refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev_refresh_secret_change')
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token type');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (![UserStatus.ACTIVE, UserStatus.PENDING_VERIFICATION].includes(user.status)) {
      await this.usersService.clearRefreshTokenHash(String(user._id));
      await this.auditService.logAuthAction({
        action: 'auth.refresh.blocked',
        tenantId: user.tenantId ? String(user.tenantId) : null,
        userId: String(user._id),
        entityId: String(user._id),
        metadata: { reason: `status_${user.status}` },
        ...this.extractRequestMeta(request)
      });
      throw new UnauthorizedException('User is not allowed to refresh session');
    }

    const isRefreshValid = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!isRefreshValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const authUser = await this.buildAuthUser(user);
    const tokens = await this.issueTokens(authUser);

    await this.auditService.logAuthAction({
      action: 'auth.refresh.success',
      tenantId: authUser.tenantId,
      userId: authUser.sub,
      entityId: authUser.sub,
      ...this.extractRequestMeta(request)
    });

    return {
      tokens,
      user: await this.composeMeResponse(authUser.sub)
    };
  }

  async logout(userId: string): Promise<{ message: string }> {
    await this.usersService.clearRefreshTokenHash(userId);

    await this.auditService.logAuthAction({
      action: 'auth.logout',
      userId,
      entityId: userId
    });

    return { message: 'Logged out' };
  }

  async me(user: AuthUser) {
    return this.composeMeResponse(user.sub);
  }

  async forgotPassword(dto: ForgotPasswordDto, request?: Request) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message: 'If this account exists, reset instructions were sent' };
    }

    const token = this.generateOpaqueToken();
    const tokenHash = this.hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.usersService.setResetPasswordToken(String(user._id), tokenHash, expiresAt);

    if (this.authEmailQueue) {
      await this.authEmailQueue.add('forgot-password', {
        type: 'forgot-password',
        email: user.email,
        token
      });
    }

    await this.auditService.logAuthAction({
      action: 'auth.forgot_password.requested',
      tenantId: user.tenantId ? String(user.tenantId) : null,
      userId: String(user._id),
      entityId: String(user._id),
      ...this.extractRequestMeta(request)
    });

    return {
      message: 'If this account exists, reset instructions were sent',
      debugToken: this.isDevelopment() ? token : undefined
    };
  }

  async resetPassword(dto: ResetPasswordDto, request?: Request) {
    const tokenHash = this.hashOpaqueToken(dto.token);
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    const updated = await this.usersService.resetPasswordByTokenHash(tokenHash, passwordHash);
    if (!updated) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    await this.auditService.logAuthAction({
      action: 'auth.reset_password.completed',
      metadata: { tokenHashPrefix: tokenHash.substring(0, 8) },
      ...this.extractRequestMeta(request)
    });

    return { message: 'Password reset successfully' };
  }

  async requestEmailVerification(dto: RequestEmailVerificationDto, request?: Request) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return { message: 'If this account exists, verification instructions were sent' };
    }

    const token = this.generateOpaqueToken();
    const tokenHash = this.hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.usersService.setEmailVerificationToken(String(user._id), tokenHash, expiresAt);

    if (this.authEmailQueue) {
      await this.authEmailQueue.add('email-verification', {
        type: 'email-verification',
        email: user.email,
        token
      });
    }

    await this.auditService.logAuthAction({
      action: 'auth.email_verification.requested',
      tenantId: user.tenantId ? String(user.tenantId) : null,
      userId: String(user._id),
      entityId: String(user._id),
      ...this.extractRequestMeta(request)
    });

    return {
      message: 'If this account exists, verification instructions were sent',
      debugToken: this.isDevelopment() ? token : undefined
    };
  }

  async confirmEmailVerification(dto: ConfirmEmailVerificationDto, request?: Request) {
    const tokenHash = this.hashOpaqueToken(dto.token);
    const user = await this.usersService.verifyEmailByTokenHash(tokenHash);

    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.auditService.logAuthAction({
      action: 'auth.email_verification.completed',
      tenantId: user.tenantId ? String(user.tenantId) : null,
      userId: String(user._id),
      entityId: String(user._id),
      ...this.extractRequestMeta(request)
    });

    return { message: 'Email verified successfully' };
  }

  private async composeMeResponse(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const authUser = await this.buildAuthUser(user);
    const tenant = authUser.tenantId ? await this.tenantsService.findById(authUser.tenantId) : null;
    const roles = await this.rolesService.findByIds(authUser.roleIds);

    return {
      id: authUser.sub,
      email: authUser.email,
      tenantId: authUser.tenantId,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      roleIds: authUser.roleIds,
      isPortalUser: authUser.isPortalUser ?? false,
      portalClientIds: (user.portalClientIds ?? []).map((clientId) => String(clientId)),
      roles: roles.map((role) => ({ id: role._id, slug: role.slug, name: role.name })),
      permissions: authUser.permissions,
      tenant: tenant
        ? {
            id: tenant._id,
            name: tenant.name,
            slug: tenant.slug,
            plan: tenant.plan,
            status: tenant.status
          }
        : null
    };
  }

  private async buildAuthUser(user: User): Promise<AuthUser> {
    const roles = await this.rolesService.findByIds(user.roleIds ?? []);
    const permissionIds = roles.flatMap((role) => role.permissionIds ?? []);
    const permissions = await this.permissionsService.findByIds(permissionIds);

    return {
      sub: String(user._id),
      tenantId: user.tenantId ? String(user.tenantId) : null,
      email: user.email,
      roleIds: roles.map((role) => String(role._id)),
      permissions: this.extractPermissionKeys(permissions),
      isPortalUser: user.isPortalUser ?? false
    };
  }

  private extractPermissionKeys(permissions: Permission[]): string[] {
    return [...new Set(permissions.map((permission) => permission.key))];
  }

  private async issueTokens(user: AuthUser) {
    const accessPayload: AccessTokenPayload = {
      sub: user.sub,
      tenantId: user.tenantId,
      email: user.email,
      roleIds: user.roleIds,
      permissions: user.permissions,
      isPortalUser: user.isPortalUser ?? false
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: user.sub,
      jti: randomUUID(),
      type: 'refresh'
    };

    const accessToken = await this.jwtService.signAsync(accessPayload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any
    });

    const refreshToken = await this.jwtService.signAsync(refreshPayload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET', 'dev_refresh_secret_change'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') as any
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.storeRefreshTokenHash(user.sub, refreshTokenHash);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m')
    };
  }

  private hashOpaqueToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  private isDevelopment(): boolean {
    return this.configService.get<string>('NODE_ENV', 'development') !== 'production';
  }

  private extractRequestMeta(request?: Request) {
    if (!request) {
      return {
        ipAddress: null,
        userAgent: null
      };
    }

    return {
      ipAddress: request.ip ?? null,
      userAgent: request.get('user-agent') ?? null
    };
  }
}
