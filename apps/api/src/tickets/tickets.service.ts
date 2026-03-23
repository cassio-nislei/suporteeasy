import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { DevicesService } from '../devices/devices.service';
import { AUTOMATION_JOB_TRIGGER, AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SlaService } from '../sla/sla.service';
import { UsersService } from '../users/users.service';
import { AddTicketCommentDto } from './dto/add-ticket-comment.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsDto } from './dto/list-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { TicketComment, TicketCommentDocument, TicketCommentVisibility } from './ticket-comment.schema';
import {
  Ticket,
  TicketDocument,
  TicketPriority,
  TicketSource,
  TicketStatus
} from './ticket.schema';

const ACTIVE_TICKET_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.REOPENED
];

interface CreateFromAlertInput {
  tenantId: string;
  alertId: string;
  deviceId: string;
  clientId?: string | null;
  severity: string;
  source: TicketSource;
  subject: string;
  description: string;
  actorUserId?: string | null;
}

type SlaState = 'none' | 'on_track' | 'at_risk' | 'breached' | 'met';

interface SlaIndicator {
  state: SlaState;
  remainingMinutes: number | null;
}

@Injectable()
export class TicketsService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(TicketComment.name)
    private readonly ticketCommentModel: Model<TicketCommentDocument>,
    private readonly clientsService: ClientsService,
    @Inject(forwardRef(() => DevicesService))
    private readonly devicesService: DevicesService,
    private readonly usersService: UsersService,
    private readonly slaService: SlaService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue?: Queue
  ) {}

  async createManual(tenantId: string, actorUserId: string | null, dto: CreateTicketDto) {
    const clientId = await this.resolveClientForTicket(tenantId, dto.clientId, dto.deviceId);
    const assigneeObjectId = await this.resolveAssigneeObjectId(tenantId, dto.assigneeId ?? null);

    const slaPolicy =
      dto.slaPolicyId !== undefined
        ? await this.slaService.findById(tenantId, dto.slaPolicyId)
        : await this.slaService.resolvePolicyForClient(tenantId, clientId);
    const deadlines = this.slaService.computeDeadlines(slaPolicy);

    const status = dto.status ?? TicketStatus.OPEN;
    const resolvedAt = status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED ? new Date() : null;

    const created = await this.ticketModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: clientId ? new Types.ObjectId(clientId) : null,
      deviceId: dto.deviceId ? new Types.ObjectId(dto.deviceId) : null,
      alertId: null,
      source: dto.source ?? TicketSource.MANUAL,
      subject: dto.subject,
      description: dto.description,
      status,
      priority: dto.priority ?? TicketPriority.MEDIUM,
      assigneeId: assigneeObjectId,
      portalRequesterId: null,
      slaPolicyId: slaPolicy ? new Types.ObjectId(String(slaPolicy._id)) : null,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      firstRespondedAt: null,
      resolvedAt,
      closedAt: status === TicketStatus.CLOSED ? new Date() : null
    });

    await this.notificationsService.notifyTenantUsers(tenantId, {
      type: NotificationType.TICKET_CREATED,
      title: `Ticket created: ${dto.subject}`,
      body: dto.description,
      metadata: {
        ticketId: String(created._id),
        source: dto.source ?? TicketSource.MANUAL
      }
    });

    if (assigneeObjectId) {
      await this.notificationsService.notifyUser(tenantId, String(assigneeObjectId), {
        type: NotificationType.TICKET_ASSIGNED,
        title: `Ticket assigned: ${dto.subject}`,
        body: `You were assigned ticket ${String(created._id)}`,
        metadata: {
          ticketId: String(created._id),
          assignedBy: actorUserId
        }
      });
    }

    await this.enqueueTicketCreatedTrigger(tenantId, {
      ticketId: String(created._id),
      deviceId: dto.deviceId ?? null,
      clientId,
      source: dto.source ?? TicketSource.MANUAL
    });

    return this.findById(tenantId, String(created._id));
  }

  async createFromAlert(input: CreateFromAlertInput) {
    const existing = await this.ticketModel.findOne({
      tenantId: new Types.ObjectId(input.tenantId),
      alertId: new Types.ObjectId(input.alertId),
      status: { $in: ACTIVE_TICKET_STATUSES }
    });

    if (existing) {
      return this.findById(input.tenantId, String(existing._id));
    }

    const device = await this.devicesService.findById(input.tenantId, input.deviceId);
    const inferredClientId =
      input.clientId ??
      (device.clientId && typeof device.clientId === 'object' && '_id' in device.clientId
        ? String(device.clientId._id)
        : null);

    const slaPolicy = await this.slaService.resolvePolicyForClient(input.tenantId, inferredClientId);
    const deadlines = this.slaService.computeDeadlines(slaPolicy);

    const created = await this.ticketModel.create({
      tenantId: new Types.ObjectId(input.tenantId),
      clientId: inferredClientId ? new Types.ObjectId(inferredClientId) : null,
      deviceId: new Types.ObjectId(input.deviceId),
      alertId: new Types.ObjectId(input.alertId),
      source: input.source,
      subject: input.subject,
      description: input.description,
      status: TicketStatus.OPEN,
      priority: this.priorityFromSeverity(input.severity),
      assigneeId: null,
      portalRequesterId: null,
      slaPolicyId: slaPolicy ? new Types.ObjectId(String(slaPolicy._id)) : null,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      firstRespondedAt: null,
      resolvedAt: null,
      closedAt: null
    });

    await this.notificationsService.notifyTenantUsers(input.tenantId, {
      type: NotificationType.TICKET_CREATED,
      title: `Ticket from alert: ${input.subject}`,
      body: input.description,
      metadata: {
        ticketId: String(created._id),
        alertId: input.alertId,
        source: input.source
      }
    });

    await this.enqueueTicketCreatedTrigger(input.tenantId, {
      ticketId: String(created._id),
      deviceId: input.deviceId,
      clientId: inferredClientId,
      source: input.source
    });

    return this.findById(input.tenantId, String(created._id));
  }

  async list(tenantId: string, query: ListTicketsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const filter: FilterQuery<TicketDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.assigneeId) {
      filter.assigneeId = new Types.ObjectId(query.assigneeId);
    }

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.search) {
      filter.$or = [
        { subject: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
        .populate({ path: 'assigneeId', select: 'email status' })
        .populate({ path: 'portalRequesterId', select: 'email status portalClientIds' })
        .populate({ path: 'slaPolicyId', select: 'name firstResponseMinutes resolutionMinutes' })
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(filter)
    ]);

    return {
      items: items.map((ticket) => this.attachSlaIndicators(ticket)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findById(tenantId: string, ticketId: string) {
    const ticket = await this.ticketModel
      .findOne({
        _id: new Types.ObjectId(ticketId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
      .populate({ path: 'assigneeId', select: 'email status' })
      .populate({ path: 'portalRequesterId', select: 'email status portalClientIds' })
      .populate({ path: 'slaPolicyId', select: 'name firstResponseMinutes resolutionMinutes' })
      .lean();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.attachSlaIndicators(ticket);
  }

  async update(
    tenantId: string,
    ticketId: string,
    dto: UpdateTicketDto,
    actorUserId: string | null
  ) {
    const ticket = await this.findTicketDocument(tenantId, ticketId);
    const previousAssigneeId = ticket.assigneeId ? String(ticket.assigneeId) : null;

    if (dto.clientId !== undefined) {
      if (dto.clientId) {
        await this.clientsService.findById(tenantId, dto.clientId);
        ticket.clientId = new Types.ObjectId(dto.clientId);
      } else {
        ticket.clientId = null;
      }
    }

    if (dto.deviceId !== undefined) {
      if (dto.deviceId) {
        await this.devicesService.findById(tenantId, dto.deviceId);
        ticket.deviceId = new Types.ObjectId(dto.deviceId);
      } else {
        ticket.deviceId = null;
      }
    }

    if (dto.assigneeId !== undefined) {
      ticket.assigneeId = await this.resolveAssigneeObjectId(tenantId, dto.assigneeId ?? null);
    }

    if (dto.slaPolicyId !== undefined) {
      if (dto.slaPolicyId) {
        const policy = await this.slaService.findById(tenantId, dto.slaPolicyId);
        ticket.slaPolicyId = new Types.ObjectId(String(policy._id));
        if (!ticket.firstResponseDueAt || !ticket.resolutionDueAt) {
          const deadlines = this.slaService.computeDeadlines(policy, ticket.createdAt as Date);
          ticket.firstResponseDueAt = deadlines.firstResponseDueAt;
          ticket.resolutionDueAt = deadlines.resolutionDueAt;
        }
      } else {
        ticket.slaPolicyId = null;
        ticket.firstResponseDueAt = null;
        ticket.resolutionDueAt = null;
      }
    }

    if (dto.subject !== undefined) {
      ticket.subject = dto.subject;
    }

    if (dto.description !== undefined) {
      ticket.description = dto.description;
    }

    if (dto.priority !== undefined) {
      ticket.priority = dto.priority;
    }

    if (dto.status !== undefined) {
      this.applyStatusTransition(ticket, dto.status);
    }

    await ticket.save();

    const updatedAssigneeId = ticket.assigneeId ? String(ticket.assigneeId) : null;
    if (updatedAssigneeId && updatedAssigneeId !== previousAssigneeId) {
      await this.notificationsService.notifyUser(tenantId, updatedAssigneeId, {
        type: NotificationType.TICKET_ASSIGNED,
        title: `Ticket assigned: ${ticket.subject}`,
        body: `You were assigned ticket ${String(ticket._id)}`,
        metadata: {
          ticketId: String(ticket._id),
          assignedBy: actorUserId
        }
      });
    }

    return this.findById(tenantId, ticketId);
  }

  async assign(tenantId: string, ticketId: string, dto: AssignTicketDto, actorUserId: string | null) {
    return this.update(
      tenantId,
      ticketId,
      {
        assigneeId: dto.assigneeId ?? undefined
      },
      actorUserId
    );
  }

  async resolve(tenantId: string, ticketId: string) {
    const ticket = await this.findTicketDocument(tenantId, ticketId);
    this.applyStatusTransition(ticket, TicketStatus.RESOLVED);
    await ticket.save();
    return this.findById(tenantId, ticketId);
  }

  async close(tenantId: string, ticketId: string) {
    const ticket = await this.findTicketDocument(tenantId, ticketId);
    this.applyStatusTransition(ticket, TicketStatus.CLOSED);
    await ticket.save();
    return this.findById(tenantId, ticketId);
  }

  async reopen(tenantId: string, ticketId: string) {
    const ticket = await this.findTicketDocument(tenantId, ticketId);
    this.applyStatusTransition(ticket, TicketStatus.REOPENED);
    await ticket.save();
    return this.findById(tenantId, ticketId);
  }

  async addComment(tenantId: string, ticketId: string, authorId: string, dto: AddTicketCommentDto) {
    const ticket = await this.findTicketDocument(tenantId, ticketId);

    const comment = await this.ticketCommentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      ticketId: new Types.ObjectId(ticketId),
      authorId: new Types.ObjectId(authorId),
      visibility: dto.visibility,
      body: dto.body
    });

    if (!ticket.firstRespondedAt) {
      ticket.firstRespondedAt = new Date();
      if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
      await ticket.save();
    }

    return this.ticketCommentModel
      .findById(comment._id)
      .populate({ path: 'authorId', select: 'email status' })
      .lean();
  }

  async listComments(tenantId: string, ticketId: string) {
    await this.findTicketDocument(tenantId, ticketId);

    return this.ticketCommentModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        ticketId: new Types.ObjectId(ticketId)
      })
      .populate({ path: 'authorId', select: 'email status' })
      .sort({ createdAt: 1 })
      .lean();
  }

  async createPortalTicket(
    tenantId: string,
    requesterUserId: string,
    input: {
      subject: string;
      description: string;
      clientId?: string | null;
      deviceId?: string | null;
      priority?: TicketPriority;
      slaPolicyId?: string | null;
    }
  ) {
    const clientId = await this.resolveClientForTicket(
      tenantId,
      input.clientId ?? undefined,
      input.deviceId ?? undefined
    );
    const slaPolicy =
      input.slaPolicyId !== undefined && input.slaPolicyId !== null
        ? await this.slaService.findById(tenantId, input.slaPolicyId)
        : await this.slaService.resolvePolicyForClient(tenantId, clientId);
    const deadlines = this.slaService.computeDeadlines(slaPolicy);

    const created = await this.ticketModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: clientId ? new Types.ObjectId(clientId) : null,
      deviceId: input.deviceId ? new Types.ObjectId(input.deviceId) : null,
      alertId: null,
      source: TicketSource.PORTAL,
      subject: input.subject,
      description: input.description,
      status: TicketStatus.OPEN,
      priority: input.priority ?? TicketPriority.MEDIUM,
      assigneeId: null,
      portalRequesterId: new Types.ObjectId(requesterUserId),
      slaPolicyId: slaPolicy ? new Types.ObjectId(String(slaPolicy._id)) : null,
      firstResponseDueAt: deadlines.firstResponseDueAt,
      resolutionDueAt: deadlines.resolutionDueAt,
      firstRespondedAt: null,
      resolvedAt: null,
      closedAt: null
    });

    await this.notificationsService.notifyTenantUsers(tenantId, {
      type: NotificationType.TICKET_CREATED,
      title: `Portal ticket created: ${input.subject}`,
      body: input.description,
      metadata: {
        ticketId: String(created._id),
        source: TicketSource.PORTAL
      }
    });

    await this.enqueueTicketCreatedTrigger(tenantId, {
      ticketId: String(created._id),
      deviceId: input.deviceId ?? null,
      clientId,
      source: TicketSource.PORTAL
    });

    return this.findById(tenantId, String(created._id));
  }

  async listForPortalUser(
    tenantId: string,
    requesterUserId: string,
    query: { page?: number; limit?: number; status?: TicketStatus }
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<TicketDocument> = {
      tenantId: new Types.ObjectId(tenantId),
      portalRequesterId: new Types.ObjectId(requesterUserId)
    };

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.ticketModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
        .populate({ path: 'assigneeId', select: 'email status' })
        .populate({ path: 'slaPolicyId', select: 'name firstResponseMinutes resolutionMinutes' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.ticketModel.countDocuments(filter)
    ]);

    return {
      items: items.map((ticket) => this.attachSlaIndicators(ticket)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findByIdForPortal(tenantId: string, requesterUserId: string, ticketId: string) {
    const ticket = await this.ticketModel
      .findOne({
        _id: new Types.ObjectId(ticketId),
        tenantId: new Types.ObjectId(tenantId),
        portalRequesterId: new Types.ObjectId(requesterUserId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
      .populate({ path: 'assigneeId', select: 'email status' })
      .populate({ path: 'slaPolicyId', select: 'name firstResponseMinutes resolutionMinutes' })
      .lean();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return this.attachSlaIndicators(ticket);
  }

  async addPortalComment(tenantId: string, requesterUserId: string, ticketId: string, body: string) {
    await this.findByIdForPortal(tenantId, requesterUserId, ticketId);

    const comment = await this.ticketCommentModel.create({
      tenantId: new Types.ObjectId(tenantId),
      ticketId: new Types.ObjectId(ticketId),
      authorId: new Types.ObjectId(requesterUserId),
      visibility: TicketCommentVisibility.PUBLIC,
      body
    });

    return this.ticketCommentModel
      .findById(comment._id)
      .populate({ path: 'authorId', select: 'email status' })
      .lean();
  }

  async listCommentsForPortal(tenantId: string, requesterUserId: string, ticketId: string) {
    await this.findByIdForPortal(tenantId, requesterUserId, ticketId);

    return this.ticketCommentModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        ticketId: new Types.ObjectId(ticketId),
        visibility: TicketCommentVisibility.PUBLIC
      })
      .populate({ path: 'authorId', select: 'email status' })
      .sort({ createdAt: 1 })
      .lean();
  }

  private async findTicketDocument(tenantId: string, ticketId: string): Promise<TicketDocument> {
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(ticketId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return ticket;
  }

  private applyStatusTransition(ticket: TicketDocument, status: TicketStatus): void {
    ticket.status = status;

    if (status === TicketStatus.REOPENED) {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
      return;
    }

    if (status === TicketStatus.RESOLVED) {
      ticket.resolvedAt = ticket.resolvedAt ?? new Date();
      return;
    }

    if (status === TicketStatus.CLOSED) {
      ticket.resolvedAt = ticket.resolvedAt ?? new Date();
      ticket.closedAt = new Date();
    }
  }

  private async resolveClientForTicket(
    tenantId: string,
    inputClientId?: string,
    inputDeviceId?: string
  ): Promise<string | null> {
    if (inputClientId) {
      await this.clientsService.findById(tenantId, inputClientId);
      return inputClientId;
    }

    if (!inputDeviceId) {
      return null;
    }

    const device = await this.devicesService.findById(tenantId, inputDeviceId);
    if (device.clientId && typeof device.clientId === 'object' && '_id' in device.clientId) {
      return String(device.clientId._id);
    }

    return null;
  }

  private async resolveAssigneeObjectId(
    tenantId: string,
    assigneeId: string | null
  ): Promise<Types.ObjectId | null> {
    if (!assigneeId) {
      return null;
    }

    const assignee = await this.usersService.findLeanById(assigneeId);
    if (!assignee || !assignee.tenantId || String(assignee.tenantId) !== tenantId) {
      throw new BadRequestException('Invalid assignee for tenant');
    }

    return new Types.ObjectId(assigneeId);
  }

  private priorityFromSeverity(severity: string): TicketPriority {
    const normalized = severity.toLowerCase();
    if (normalized === 'critical') {
      return TicketPriority.URGENT;
    }
    if (normalized === 'high') {
      return TicketPriority.HIGH;
    }
    if (normalized === 'medium') {
      return TicketPriority.MEDIUM;
    }
    return TicketPriority.LOW;
  }

  private async enqueueTicketCreatedTrigger(
    tenantId: string,
    payload: {
      ticketId: string;
      deviceId: string | null;
      clientId: string | null;
      source: TicketSource;
    }
  ): Promise<void> {
    if (!this.automationQueue) {
      return;
    }

    await this.automationQueue.add(
      AUTOMATION_JOB_TRIGGER,
      {
        tenantId,
        trigger: 'ticket_created',
        context: {
          ticketId: payload.ticketId,
          deviceId: payload.deviceId,
          clientId: payload.clientId,
          source: payload.source
        }
      },
      {
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3
      }
    );
  }

  private attachSlaIndicators(ticket: Record<string, unknown>) {
    const resolutionTargetMinutes =
      ticket.slaPolicyId && typeof ticket.slaPolicyId === 'object' && 'resolutionMinutes' in ticket.slaPolicyId
        ? Number((ticket.slaPolicyId as Record<string, unknown>).resolutionMinutes ?? 0)
        : 0;
    const firstResponseTargetMinutes =
      ticket.slaPolicyId && typeof ticket.slaPolicyId === 'object' && 'firstResponseMinutes' in ticket.slaPolicyId
        ? Number((ticket.slaPolicyId as Record<string, unknown>).firstResponseMinutes ?? 0)
        : 0;

    const firstResponse = this.computeSlaClock(
      ticket.firstResponseDueAt as Date | string | null | undefined,
      ticket.firstRespondedAt as Date | string | null | undefined,
      firstResponseTargetMinutes
    );

    const resolution = this.computeSlaClock(
      ticket.resolutionDueAt as Date | string | null | undefined,
      (ticket.resolvedAt as Date | string | null | undefined) ??
        (ticket.closedAt as Date | string | null | undefined),
      resolutionTargetMinutes
    );

    const status = String(ticket.status ?? TicketStatus.OPEN) as TicketStatus;
    const overall = this.computeOverallSlaState(status, firstResponse.state, resolution.state);

    return {
      ...ticket,
      sla: {
        firstResponseDueAt: ticket.firstResponseDueAt ?? null,
        resolutionDueAt: ticket.resolutionDueAt ?? null,
        firstRespondedAt: ticket.firstRespondedAt ?? null,
        resolvedAt: ticket.resolvedAt ?? null,
        firstResponseState: firstResponse.state,
        firstResponseRemainingMinutes: firstResponse.remainingMinutes,
        resolutionState: resolution.state,
        resolutionRemainingMinutes: resolution.remainingMinutes,
        overallState: overall
      }
    };
  }

  private computeSlaClock(
    dueAtInput: Date | string | null | undefined,
    respondedAtInput: Date | string | null | undefined,
    targetMinutes: number
  ): SlaIndicator {
    if (!dueAtInput) {
      return {
        state: 'none',
        remainingMinutes: null
      };
    }

    const dueAt = new Date(dueAtInput);
    const respondedAt = respondedAtInput ? new Date(respondedAtInput) : null;

    if (respondedAt) {
      return {
        state: respondedAt.getTime() <= dueAt.getTime() ? 'met' : 'breached',
        remainingMinutes: null
      };
    }

    const remainingMinutes = Math.ceil((dueAt.getTime() - Date.now()) / 60_000);
    if (remainingMinutes < 0) {
      return {
        state: 'breached',
        remainingMinutes
      };
    }

    const riskThreshold = Math.min(60, Math.max(5, Math.ceil(targetMinutes * 0.2)));
    if (remainingMinutes <= riskThreshold) {
      return {
        state: 'at_risk',
        remainingMinutes
      };
    }

    return {
      state: 'on_track',
      remainingMinutes
    };
  }

  private computeOverallSlaState(
    status: TicketStatus,
    firstResponseState: SlaState,
    resolutionState: SlaState
  ): SlaState {
    if (firstResponseState === 'none' && resolutionState === 'none') {
      return 'none';
    }

    if (status === TicketStatus.RESOLVED || status === TicketStatus.CLOSED) {
      if (firstResponseState === 'breached' || resolutionState === 'breached') {
        return 'breached';
      }

      if (resolutionState === 'met') {
        return 'met';
      }
    }

    if (firstResponseState === 'breached' || resolutionState === 'breached') {
      return 'breached';
    }

    if (firstResponseState === 'at_risk' || resolutionState === 'at_risk') {
      return 'at_risk';
    }

    return 'on_track';
  }
}
