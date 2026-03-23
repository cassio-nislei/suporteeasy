import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { queuesEnabled } from '../common/config/runtime-flags';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { AUTH_EMAIL_QUEUE } from './auth.constants';
import { AuthController } from './auth.controller';
import { AuthEmailProcessor } from './auth-email.processor';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET', 'dev_access_secret_change'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as any
        }
      })
    }),
    ...(queuesEnabled ? [BullModule.registerQueue({ name: AUTH_EMAIL_QUEUE })] : []),
    UsersModule,
    RolesModule,
    PermissionsModule,
    TenantsModule,
    AuditModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, ...(queuesEnabled ? [AuthEmailProcessor] : [])],
  exports: [AuthService]
})
export class AuthModule {}
