import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { TicketsService } from '../tickets/tickets.service';
import { UsersService } from '../users/users.service';
import { CreatePortalCommentDto } from './dto/create-portal-comment.dto';
import { CreatePortalTicketDto } from './dto/create-portal-ticket.dto';
import { CustomerPortalLoginDto } from './dto/customer-portal-login.dto';
import { ListPortalTicketsDto } from './dto/list-portal-tickets.dto';

@Injectable()
export class CustomerPortalService {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly ticketsService: TicketsService
  ) {}

  async login(dto: CustomerPortalLoginDto, request?: Request) {
    const response = await this.authService.login(dto, request);
    if (!response.user.isPortalUser || !response.user.permissions.includes('portal:access')) {
      throw new UnauthorizedException('Portal access is not enabled for this account');
    }

    return response;
  }

  async me(user: AuthUser) {
    this.ensurePortalUser(user);
    return this.authService.me(user);
  }

  async listTickets(user: AuthUser, query: ListPortalTicketsDto) {
    this.ensurePortalUser(user);
    return this.ticketsService.listForPortalUser(String(user.tenantId), user.sub, query);
  }

  async detailTicket(user: AuthUser, ticketId: string) {
    this.ensurePortalUser(user);
    return this.ticketsService.findByIdForPortal(String(user.tenantId), user.sub, ticketId);
  }

  async createTicket(user: AuthUser, dto: CreatePortalTicketDto) {
    this.ensurePortalUser(user);
    const portalUser = await this.usersService.findById(user.sub);
    if (!portalUser) {
      throw new UnauthorizedException('Portal user not found');
    }

    const allowedClientIds = (portalUser.portalClientIds ?? []).map((clientId) => String(clientId));
    let resolvedClientId = dto.clientId ?? null;

    if (!resolvedClientId && allowedClientIds.length === 1) {
      resolvedClientId = allowedClientIds[0];
    }

    if (resolvedClientId && allowedClientIds.length > 0 && !allowedClientIds.includes(resolvedClientId)) {
      throw new ForbiddenException('You cannot create tickets for this client');
    }

    return this.ticketsService.createPortalTicket(String(user.tenantId), user.sub, {
      subject: dto.subject,
      description: dto.description,
      clientId: resolvedClientId,
      deviceId: dto.deviceId,
      priority: dto.priority
    });
  }

  async listComments(user: AuthUser, ticketId: string) {
    this.ensurePortalUser(user);
    return this.ticketsService.listCommentsForPortal(String(user.tenantId), user.sub, ticketId);
  }

  async addComment(user: AuthUser, ticketId: string, dto: CreatePortalCommentDto) {
    this.ensurePortalUser(user);
    return this.ticketsService.addPortalComment(String(user.tenantId), user.sub, ticketId, dto.body);
  }

  private ensurePortalUser(user: AuthUser) {
    if (!user.tenantId) {
      throw new UnauthorizedException('Portal user tenant context is required');
    }

    const isPortal = user.isPortalUser || user.permissions.includes('portal:access');
    if (!isPortal) {
      throw new UnauthorizedException('Portal access is not enabled for this account');
    }
  }
}
