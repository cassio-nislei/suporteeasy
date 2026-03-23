import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { Device, DeviceSchema } from './device.schema';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Device.name, schema: DeviceSchema }]),
    ClientsModule,
    forwardRef(() => MonitoringModule)
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService, MongooseModule]
})
export class DevicesModule {}
