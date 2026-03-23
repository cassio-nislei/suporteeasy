import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from './audit-log.schema';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';

interface AuthAuditInput {
  action: string;
  tenantId?: string | null;
  userId?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface SystemAuditInput {
  action: string;
  tenantId?: string | null;
  userId?: string | null;
  entityType?: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>
  ) {}

  async logAuthAction(input: AuthAuditInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        tenantId: input.tenantId ? new Types.ObjectId(input.tenantId) : null,
        userId: input.userId ? new Types.ObjectId(input.userId) : null,
        action: input.action,
        entityType: 'auth',
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error instanceof Error ? error.stack : String(error));
    }
  }

  async logSystemAction(input: SystemAuditInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        tenantId: input.tenantId ? new Types.ObjectId(input.tenantId) : null,
        userId: input.userId ? new Types.ObjectId(input.userId) : null,
        action: input.action,
        entityType: input.entityType ?? 'system',
        entityId: input.entityId ?? null,
        metadata: input.metadata ?? {},
        ipAddress: null,
        userAgent: null
      });
    } catch (error) {
      this.logger.error('Failed to write system audit log', error instanceof Error ? error.stack : String(error));
    }
  }

  async listLogs(tenantId: string | null, query: ListAuditLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<AuditLogDocument> = {};
    if (tenantId) {
      filter.tenantId = new Types.ObjectId(tenantId);
    }

    if (query.action) {
      filter.action = { $regex: query.action, $options: 'i' };
    }

    if (query.entityType) {
      filter.entityType = { $regex: query.entityType, $options: 'i' };
    }

    if (query.userId) {
      filter.userId = new Types.ObjectId(query.userId);
    }

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.auditLogModel.countDocuments(filter)
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
}
