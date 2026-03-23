import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { AutomationsModule } from '../automations/automations.module';
import { ClientsModule } from '../clients/clients.module';
import { ContactsModule } from '../contacts/contacts.module';
import { DevicesModule } from '../devices/devices.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { ScriptExecutionsModule } from '../script-executions/script-executions.module';
import { TicketsModule } from '../tickets/tickets.module';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [
    ClientsModule,
    ContactsModule,
    DevicesModule,
    MonitoringModule,
    AlertsModule,
    TicketsModule,
    ScriptExecutionsModule,
    AutomationsModule
  ],
  controllers: [DashboardsController],
  providers: [DashboardsService],
  exports: [DashboardsService]
})
export class DashboardsModule {}
