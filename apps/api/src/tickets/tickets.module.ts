import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { queuesEnabled } from '../common/config/runtime-flags';
import { ClientsModule } from '../clients/clients.module';
import { DevicesModule } from '../devices/devices.module';
import { AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { NotificationsModule } from '../notifications/notifications.module';
import { SlaModule } from '../sla/sla.module';
import { UsersModule } from '../users/users.module';
import { TicketComment, TicketCommentSchema } from './ticket-comment.schema';
import { Ticket, TicketSchema } from './ticket.schema';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    ...(queuesEnabled ? [BullModule.registerQueue({ name: AUTOMATION_QUEUE })] : []),
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: TicketComment.name, schema: TicketCommentSchema }
    ]),
    ClientsModule,
    forwardRef(() => DevicesModule),
    UsersModule,
    SlaModule,
    NotificationsModule
  ],
  controllers: [TicketsController],
  providers: [TicketsService],
  exports: [TicketsService, MongooseModule]
})
export class TicketsModule {}
