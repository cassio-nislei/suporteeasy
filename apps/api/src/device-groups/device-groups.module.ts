import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesModule } from '../devices/devices.module';
import { DeviceGroup, DeviceGroupSchema } from './device-group.schema';
import { DeviceGroupsController } from './device-groups.controller';
import { DeviceGroupsService } from './device-groups.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DeviceGroup.name, schema: DeviceGroupSchema }]),
    DevicesModule
  ],
  controllers: [DeviceGroupsController],
  providers: [DeviceGroupsService],
  exports: [DeviceGroupsService, MongooseModule]
})
export class DeviceGroupsModule {}
