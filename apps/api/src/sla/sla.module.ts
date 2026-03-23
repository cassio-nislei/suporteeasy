import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { SlaController } from './sla.controller';
import { SlaPolicy, SlaPolicySchema } from './sla-policy.schema';
import { SlaService } from './sla.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: SlaPolicy.name, schema: SlaPolicySchema }]), ClientsModule],
  controllers: [SlaController],
  providers: [SlaService],
  exports: [SlaService, MongooseModule]
})
export class SlaModule {}

