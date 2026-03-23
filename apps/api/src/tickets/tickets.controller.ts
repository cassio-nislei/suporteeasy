import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { AddTicketCommentDto } from './dto/add-ticket-comment.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketsService } from './tickets.service';

@ApiTags('tickets')
@ApiBearerAuth()
@Controller('tickets')
@TenantScoped()
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Post()
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Create ticket manually' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateTicketDto) {
    return this.ticketsService.createManual(String(user.tenantId), user.sub, dto);
  }

  @Get()
  @Permissions('tickets:read')
  @ApiOperation({ summary: 'List tickets with filters/pagination' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListTicketsDto) {
    return this.ticketsService.list(String(user.tenantId), query);
  }

  @Get(':ticketId')
  @Permissions('tickets:read')
  @ApiOperation({ summary: 'Get ticket detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.ticketsService.findById(String(user.tenantId), ticketId);
  }

  @Patch(':ticketId')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Update ticket fields' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: UpdateTicketDto
  ) {
    return this.ticketsService.update(String(user.tenantId), ticketId, dto, user.sub);
  }

  @Post(':ticketId/assign')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Assign or unassign ticket' })
  async assign(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: AssignTicketDto
  ) {
    return this.ticketsService.assign(String(user.tenantId), ticketId, dto, user.sub);
  }

  @Post(':ticketId/resolve')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Resolve ticket' })
  async resolve(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.ticketsService.resolve(String(user.tenantId), ticketId);
  }

  @Post(':ticketId/close')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Close ticket' })
  async close(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.ticketsService.close(String(user.tenantId), ticketId);
  }

  @Post(':ticketId/reopen')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Reopen ticket' })
  async reopen(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.ticketsService.reopen(String(user.tenantId), ticketId);
  }

  @Post(':ticketId/comments')
  @Permissions('tickets:write')
  @ApiOperation({ summary: 'Add comment to ticket' })
  async addComment(
    @CurrentUser() user: AuthUser,
    @Param('ticketId') ticketId: string,
    @Body() dto: AddTicketCommentDto
  ) {
    return this.ticketsService.addComment(String(user.tenantId), ticketId, user.sub, dto);
  }

  @Get(':ticketId/comments')
  @Permissions('tickets:read')
  @ApiOperation({ summary: 'List comments for ticket' })
  async listComments(@CurrentUser() user: AuthUser, @Param('ticketId') ticketId: string) {
    return this.ticketsService.listComments(String(user.tenantId), ticketId);
  }
}

