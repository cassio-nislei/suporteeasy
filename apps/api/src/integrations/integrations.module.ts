import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { Integration, IntegrationSchema } from './integration.schema';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Integration.name, schema: IntegrationSchema }]),
    AuditModule
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService],
  exports: [IntegrationsService, MongooseModule]
})
export class IntegrationsModule {}
