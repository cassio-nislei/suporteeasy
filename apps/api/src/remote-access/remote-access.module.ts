import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../agents/agents.module';
import { AuditModule } from '../audit/audit.module';
import { DevicesModule } from '../devices/devices.module';
import { RemoteAccessController } from './remote-access.controller';
import { RemoteAccessGateway } from './remote-access.gateway';
import { RemoteAccessService } from './remote-access.service';
import { RemoteSession, RemoteSessionSchema } from './remote-session.schema';

@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([{ name: RemoteSession.name, schema: RemoteSessionSchema }]),
    forwardRef(() => DevicesModule),
    AgentsModule,
    AuditModule
  ],
  controllers: [RemoteAccessController],
  providers: [RemoteAccessService, RemoteAccessGateway],
  exports: [RemoteAccessService, MongooseModule]
})
export class RemoteAccessModule {}
