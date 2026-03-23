import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { Public } from '../common/decorators/public.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreatePortalCommentDto } from './dto/create-portal-comment.dto';
import { CreatePortalTicketDto } from './dto/create-portal-ticket.dto';
import { CustomerPortalLoginDto } from './dto/customer-portal-login.dto';
import { ListPortalTicketsDto } from './dto/list-portal-tickets.dto';
import { CustomerPortalService } from './customer-portal.service';

@ApiTags('customer-portal')
@Controller('customer-portal')
export class CustomerPortalController {
  constructor(private readonly customerPortalService: CustomerPortalService) {}

  @Post('auth/login')
  @Public()
  @ApiOperation({ summary: 'Customer portal login' })
  async login(@Body() dto: CustomerPortalLoginDto, @Req() request: Request) {
    return this.customerPortalService.login(dto, request);
  }

  @Get('me')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:access')
  @ApiOperation({ summary: 'Get current portal session user' })
  async me(@CurrentUser() user: AuthUser) {
    return this.customerPortalService.me(user);
  }

  @Get('tickets')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:tickets:read')
  @ApiOperation({ summary: 'List customer portal tickets (own tickets only)' })
  async listTickets(@CurrentUser() user: AuthUser, @Query() query: ListPortalTicketsDto) {
    return this.customerPortalService.listTickets(user, query);
  }

  @Post('tickets')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:tickets:write')
  @ApiOperation({ summary: 'Create portal ticket' })
  async createTicket(@CurrentUser() user: AuthUser, @Body() dto: CreatePortalTicketDto) {
    return this.customerPortalService.createTicket(user, dto);
  }

  @Get('tickets/:ticketId')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:tickets:read')
  @ApiOperation({ summary: 'Portal ticket detail (own ticket)' })
  async detailTicket(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.customerPortalService.detailTicket(user, ticketId);
  }

  @Get('tickets/:ticketId/comments')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:tickets:read')
  @ApiOperation({ summary: 'List portal-visible comments for own ticket' })
  async listComments(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.customerPortalService.listComments(user, ticketId);
  }

  @Post('tickets/:ticketId/comments')
  @ApiBearerAuth()
  @TenantScoped()
  @Permissions('portal:tickets:write')
  @ApiOperation({ summary: 'Add portal comment to own ticket' })
  async addComment(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: CreatePortalCommentDto
  ) {
    return this.customerPortalService.addComment(user, ticketId, dto);
  }
}
