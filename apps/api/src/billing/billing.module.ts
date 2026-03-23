import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { ContractsModule } from '../contracts/contracts.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { Invoice, InvoiceSchema } from './invoice.schema';
import { Subscription, SubscriptionSchema } from './subscription.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invoice.name, schema: InvoiceSchema },
      { name: Subscription.name, schema: SubscriptionSchema }
    ]),
    ClientsModule,
    ContractsModule
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService, MongooseModule]
})
export class BillingModule {}
