import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesModule } from '../devices/devices.module';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { Agent, AgentSchema } from './agent.schema';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Agent.name, schema: AgentSchema }]),
    DevicesModule,
    forwardRef(() => MonitoringModule)
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService, MongooseModule]
})
export class AgentsModule {}
