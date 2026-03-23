import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketsModule } from '../tickets/tickets.module';
import { UsersModule } from '../users/users.module';
import { CustomerPortalController } from './customer-portal.controller';
import { CustomerPortalService } from './customer-portal.service';

@Module({
  imports: [AuthModule, UsersModule, TicketsModule],
  controllers: [CustomerPortalController],
  providers: [CustomerPortalService],
  exports: [CustomerPortalService]
})
export class CustomerPortalModule {}
