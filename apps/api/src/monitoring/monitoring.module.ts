import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { AlertsModule } from '../alerts/alerts.module';
import { queuesEnabled } from '../common/config/runtime-flags';
import { DevicesModule } from '../devices/devices.module';
import { AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { DeviceActivity, DeviceActivitySchema } from './device-activity.schema';
import { DeviceStatusGateway } from './device-status.gateway';
import { Metric, MetricSchema } from './metric.schema';
import { MonitoringController } from './monitoring.controller';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: AUTOMATION_QUEUE })] : []),
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: Metric.name, schema: MetricSchema },
      { name: DeviceActivity.name, schema: DeviceActivitySchema }
    ]),
    forwardRef(() => DevicesModule),
    forwardRef(() => AgentsModule),
    forwardRef(() => AlertsModule)
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService, DeviceStatusGateway],
  exports: [MonitoringService, DeviceStatusGateway, MongooseModule]
})
export class MonitoringModule {}
