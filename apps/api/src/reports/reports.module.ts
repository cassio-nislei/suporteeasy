import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Alert, AlertSchema } from '../alerts/alert.schema';
import { Invoice, InvoiceSchema } from '../billing/invoice.schema';
import { Subscription, SubscriptionSchema } from '../billing/subscription.schema';
import { Client, ClientSchema } from '../clients/client.schema';
import { Contact, ContactSchema } from '../contacts/contact.schema';
import { Device, DeviceSchema } from '../devices/device.schema';
import {
  ScriptExecution,
  ScriptExecutionSchema
} from '../script-executions/script-execution.schema';
import { Ticket, TicketSchema } from '../tickets/ticket.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Alert.name, schema: AlertSchema },
      { name: Client.name, schema: ClientSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Contact.name, schema: ContactSchema },
      { name: ScriptExecution.name, schema: ScriptExecutionSchema },
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema }
    ])
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService]
})
export class ReportsModule {}
