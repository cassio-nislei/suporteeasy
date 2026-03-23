import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { CreateSlaPolicyDto } from './dto/create-sla-policy.dto';
import { ListSlaPoliciesDto } from './dto/list-sla-policies.dto';
import { UpdateSlaPolicyDto } from './dto/update-sla-policy.dto';
import { SlaPolicy, SlaPolicyDocument } from './sla-policy.schema';

export interface SlaDeadlines {
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
}

@Injectable()
export class SlaService {
  constructor(
    @InjectModel(SlaPolicy.name)
    private readonly slaPolicyModel: Model<SlaPolicyDocument>,
    private readonly clientsService: ClientsService
  ) {}

  async create(tenantId: string, dto: CreateSlaPolicyDto): Promise<SlaPolicy> {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const created = await this.slaPolicyModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : null,
      name: dto.name,
      firstResponseMinutes: dto.firstResponseMinutes,
      resolutionMinutes: dto.resolutionMinutes,
      escalationRules: (dto.escalationRules ?? []).map((rule) => ({
        trigger: rule.trigger,
        afterMinutes: rule.afterMinutes,
        action: rule.action,
        targetRoleSlug: rule.targetRoleSlug ?? null
      })),
      enabled: dto.enabled ?? true
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListSlaPoliciesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<SlaPolicyDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.enabled !== undefined) {
      filter.enabled = query.enabled;
    }

    const [items, total] = await Promise.all([
      this.slaPolicyModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .sort({ clientId: -1, name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.slaPolicyModel.countDocuments(filter)
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

  async findById(tenantId: string, policyId: string): Promise<SlaPolicy> {
    const policy = await this.slaPolicyModel
      .findOne({
        _id: new Types.ObjectId(policyId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .lean();

    if (!policy) {
      throw new NotFoundException('SLA policy not found');
    }

    return policy;
  }

  async update(tenantId: string, policyId: string, dto: UpdateSlaPolicyDto): Promise<SlaPolicy> {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const updated = await this.slaPolicyModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(policyId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.clientId !== undefined
              ? { clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : null }
              : {}),
            ...(dto.firstResponseMinutes !== undefined
              ? { firstResponseMinutes: dto.firstResponseMinutes }
              : {}),
            ...(dto.resolutionMinutes !== undefined ? { resolutionMinutes: dto.resolutionMinutes } : {}),
            ...(dto.escalationRules !== undefined
              ? {
                  escalationRules: dto.escalationRules.map((rule) => ({
                    trigger: rule.trigger,
                    afterMinutes: rule.afterMinutes,
                    action: rule.action,
                    targetRoleSlug: rule.targetRoleSlug ?? null
                  }))
                }
              : {}),
            ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
          }
        },
        {
          new: true
        }
      )
      .populate({ path: 'clientId', select: 'name status' })
      .lean();

    if (!updated) {
      throw new NotFoundException('SLA policy not found');
    }

    return updated;
  }

  async remove(tenantId: string, policyId: string): Promise<{ deleted: boolean }> {
    const result = await this.slaPolicyModel.deleteOne({
      _id: new Types.ObjectId(policyId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }

  async resolvePolicyForClient(tenantId: string, clientId?: string | null): Promise<SlaPolicy | null> {
    const tenantObjectId = new Types.ObjectId(tenantId);

    if (clientId) {
      const clientSpecific = await this.slaPolicyModel
        .findOne({
          tenantId: tenantObjectId,
          clientId: new Types.ObjectId(clientId),
          enabled: true
        })
        .sort({ updatedAt: -1 })
        .lean();

      if (clientSpecific) {
        return clientSpecific;
      }
    }

    return this.slaPolicyModel
      .findOne({
        tenantId: tenantObjectId,
        clientId: null,
        enabled: true
      })
      .sort({ updatedAt: -1 })
      .lean();
  }

  computeDeadlines(policy: SlaPolicy | null, fromDate = new Date()): SlaDeadlines {
    if (!policy) {
      return {
        firstResponseDueAt: null,
        resolutionDueAt: null
      };
    }

    return {
      firstResponseDueAt: new Date(fromDate.getTime() + policy.firstResponseMinutes * 60_000),
      resolutionDueAt: new Date(fromDate.getTime() + policy.resolutionMinutes * 60_000)
    };
  }
}

