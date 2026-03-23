import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from '../common/interfaces/auth-user.interface';

interface AccessTokenPayload {
  sub: string;
  tenantId: string | null;
  email: string;
  roleIds: string[];
  permissions: string[];
  isPortalUser?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change')
    });
  }

  validate(payload: AccessTokenPayload): AuthUser {
    return {
      sub: payload.sub,
      tenantId: payload.tenantId,
      email: payload.email,
      roleIds: payload.roleIds,
      permissions: payload.permissions,
      isPortalUser: payload.isPortalUser ?? false
    };
  }
}
