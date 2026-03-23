import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AgentsService } from '../agents/agents.service';
import { AuditService } from '../audit/audit.service';
import { DevicesService } from '../devices/devices.service';
import { CreateRemoteSessionDto } from './dto/create-remote-session.dto';
import { ListRemoteSessionsDto } from './dto/list-remote-sessions.dto';
import { buildRemoteSessionMetadata, type RemoteInteractionMode } from './remote-access.providers';
import { RemoteSession, RemoteSessionDocument, RemoteSessionStatus } from './remote-session.schema';

@Injectable()
export class RemoteAccessService {
  constructor(
    @InjectModel(RemoteSession.name)
    private readonly remoteSessionModel: Model<RemoteSessionDocument>,
    private readonly devicesService: DevicesService,
    private readonly agentsService: AgentsService,
    private readonly auditService: AuditService
  ) {}

  async requestSession(tenantId: string, userId: string, dto: CreateRemoteSessionDto) {
    await this.devicesService.findById(tenantId, dto.deviceId);

    const created = await this.remoteSessionModel.create({
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(dto.deviceId),
      requestedBy: new Types.ObjectId(userId),
      provider: dto.provider ?? 'builtin-sim',
      status: RemoteSessionStatus.REQUESTED,
      startedAt: null,
      endedAt: null,
      metadata: buildRemoteSessionMetadata(dto.provider ?? 'builtin-sim', dto.metadata ?? {})
    });

    return this.findById(tenantId, String(created._id));
  }

  async list(tenantId: string, query: ListRemoteSessionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<RemoteSessionDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.deviceId) {
      filter.deviceId = new Types.ObjectId(query.deviceId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.remoteSessionModel
        .find(filter)
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
        .populate({ path: 'requestedBy', select: 'email status' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.remoteSessionModel.countDocuments(filter)
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findById(tenantId: string, sessionId: string) {
    const session = await this.remoteSessionModel
      .findOne({
        _id: new Types.ObjectId(sessionId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
      .populate({ path: 'requestedBy', select: 'email status' })
      .lean();

    if (!session) {
      throw new NotFoundException('Remote session not found');
    }

    return session;
  }

  async startSession(tenantId: string, sessionId: string) {
    return this.transition(tenantId, sessionId, RemoteSessionStatus.ACTIVE, {
      startedAt: new Date()
    });
  }

  async endSession(tenantId: string, sessionId: string) {
    return this.transition(tenantId, sessionId, RemoteSessionStatus.ENDED, {
      endedAt: new Date()
    });
  }

  async updateInteractionMode(
    tenantId: string,
    userId: string,
    sessionId: string,
    interactionMode: RemoteInteractionMode
  ) {
    const updated = await this.remoteSessionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(sessionId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            'metadata.interactionMode': interactionMode
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Remote session not found');
    }

    await this.auditService.logSystemAction({
      action: 'remote-access.interaction-mode.updated',
      tenantId,
      userId,
      entityType: 'remote-session',
      entityId: sessionId,
      metadata: {
        interactionMode
      }
    });

    return this.findById(tenantId, sessionId);
  }

  async authorizeAgentSession(sessionId: string, agentToken: string) {
    const agent = await this.agentsService.findByToken(agentToken);
    if (!agent) {
      throw new UnauthorizedException('Invalid agent token');
    }

    // Validar se agente está stale (sem heartbeat por > 30s)
    if (this.agentsService.isAgentStale(agent)) {
      throw new UnauthorizedException('Agent heartbeat timeout - agent is offline');
    }

    const session = await this.findById(String(agent.tenantId), sessionId);
    const sessionDeviceId =
      session.deviceId && typeof session.deviceId === 'object' && '_id' in session.deviceId
        ? String(session.deviceId._id)
        : String(session.deviceId);

    if (sessionDeviceId !== String(agent.deviceId)) {
      throw new ForbiddenException('Agent is not assigned to this device');
    }

    return { session, agent };
  }

  private async transition(
    tenantId: string,
    sessionId: string,
    status: RemoteSessionStatus,
    setFields: Record<string, unknown>
  ) {
    const updated = await this.remoteSessionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(sessionId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            status,
            ...setFields
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Remote session not found');
    }

    return this.findById(tenantId, sessionId);
  }
}
