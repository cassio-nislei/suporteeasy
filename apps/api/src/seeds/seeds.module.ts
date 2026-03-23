import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AlertsModule } from '../alerts/alerts.module';
import { BillingModule } from '../billing/billing.module';
import { ClientsModule } from '../clients/clients.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ContractsModule } from '../contracts/contracts.module';
import { DevicesModule } from '../devices/devices.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PatchManagementModule } from '../patch-management/patch-management.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RemoteAccessModule } from '../remote-access/remote-access.module';
import { RolesModule } from '../roles/roles.module';
import { AutomationsModule } from '../automations/automations.module';
import { ScriptExecutionsModule } from '../script-executions/script-executions.module';
import { ScriptsModule } from '../scripts/scripts.module';
import { SettingsModule } from '../settings/settings.module';
import { SlaModule } from '../sla/sla.module';
import { TicketsModule } from '../tickets/tickets.module';
import { TenantsModule } from '../tenants/tenants.module';
import { UsersModule } from '../users/users.module';
import { KnowledgeBaseModule } from '../knowledge-base/knowledge-base.module';
import { SeedService } from './seed.service';

@Module({
  imports: [
    PermissionsModule,
    RolesModule,
    TenantsModule,
    UsersModule,
    ClientsModule,
    ContactsModule,
    DevicesModule,
    AgentsModule,
    MonitoringModule,
    AlertsModule,
    TicketsModule,
    SlaModule,
    ScriptsModule,
    ScriptExecutionsModule,
    AutomationsModule,
    NotificationsModule,
    KnowledgeBaseModule,
    ContractsModule,
    BillingModule,
    PatchManagementModule,
    RemoteAccessModule,
    IntegrationsModule,
    SettingsModule,
    ApiKeysModule
  ],
  providers: [SeedService],
  exports: [SeedService]
})
export class SeedsModule {}
