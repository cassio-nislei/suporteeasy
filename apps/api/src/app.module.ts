import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AgentsModule } from './agents/agents.module';
import { AlertsModule } from './alerts/alerts.module';
import { AutomationsModule } from './automations/automations.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { ClientsModule } from './clients/clients.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { TenantGuard } from './common/guards/tenant.guard';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { queuesEnabled } from './common/config/runtime-flags';
import { ContractsModule } from './contracts/contracts.module';
import { CustomerPortalModule } from './customer-portal/customer-portal.module';
import { DatabaseModule } from './database/database.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DeviceGroupsModule } from './device-groups/device-groups.module';
import { DevicesModule } from './devices/devices.module';
import { HealthModule } from './health/health.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { JobsModule } from './jobs/jobs.module';
import { KnowledgeBaseModule } from './knowledge-base/knowledge-base.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PatchManagementModule } from './patch-management/patch-management.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RemoteAccessModule } from './remote-access/remote-access.module';
import { ReportsModule } from './reports/reports.module';
import { RolesModule } from './roles/roles.module';
import { ScriptExecutionsModule } from './script-executions/script-executions.module';
import { ScriptsModule } from './scripts/scripts.module';
import { SeedsModule } from './seeds/seeds.module';
import { SettingsModule } from './settings/settings.module';
import { SlaModule } from './sla/sla.module';
import { TenantsModule } from './tenants/tenants.module';
import { TicketsModule } from './tickets/tickets.module';
import { UsersModule } from './users/users.module';
import { ContactsModule } from './contacts/contacts.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local']
    }),
    ...(queuesEnabled
      ? [
          BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
              connection: {
                host: configService.get<string>('REDIS_HOST', 'localhost'),
                port: configService.get<number>('REDIS_PORT', 6379),
                lazyConnect: true
              }
            })
          })
        ]
      : []),
    DatabaseModule,
    AuditModule,
    PermissionsModule,
    RolesModule,
    TenantsModule,
    UsersModule,
    ClientsModule,
    ContactsModule,
    DevicesModule,
    DeviceGroupsModule,
    AgentsModule,
    MonitoringModule,
    JobsModule,
    AlertsModule,
    ScriptsModule,
    ScriptExecutionsModule,
    AutomationsModule,
    SlaModule,
    TicketsModule,
    NotificationsModule,
    DashboardsModule,
    KnowledgeBaseModule,
    ContractsModule,
    BillingModule,
    ReportsModule,
    CustomerPortalModule,
    PatchManagementModule,
    RemoteAccessModule,
    IntegrationsModule,
    SettingsModule,
    ApiKeysModule,
    AuthModule,
    HealthModule,
    SeedsModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard
    },
    {
      provide: APP_GUARD,
      useClass: TenantGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor
    }
  ]
})
export class AppModule {}
