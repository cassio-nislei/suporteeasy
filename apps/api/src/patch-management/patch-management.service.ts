import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { DevicesService } from '../devices/devices.service';
import { CreatePatchPolicyDto } from './dto/create-patch-policy.dto';
import { ListPatchesDto } from './dto/list-patches.dto';
import { SchedulePatchDto } from './dto/schedule-patch.dto';
import { SimulatePatchScanDto } from './dto/simulate-patch-scan.dto';
import { UpdatePatchPolicyDto } from './dto/update-patch-policy.dto';
import { PatchPolicy, PatchPolicyDocument } from './patch-policy.schema';
import { Patch, PatchDocument, PatchStatus } from './patch.schema';

@Injectable()
export class PatchManagementService {
  constructor(
    @InjectModel(PatchPolicy.name)
    private readonly patchPolicyModel: Model<PatchPolicyDocument>,
    @InjectModel(Patch.name)
    private readonly patchModel: Model<PatchDocument>,
    private readonly devicesService: DevicesService
  ) {}

  async createPolicy(tenantId: string, dto: CreatePatchPolicyDto) {
    const created = await this.patchPolicyModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name.trim(),
      description: dto.description ?? '',
      targetTags: dto.targetTags ?? [],
      maintenanceWindow: dto.maintenanceWindow ?? '',
      autoApprove: dto.autoApprove ?? false,
      enabled: dto.enabled ?? true
    });

    return created.toObject();
  }

  async listPolicies(tenantId: string) {
    return this.patchPolicyModel
      .find({
        tenantId: new Types.ObjectId(tenantId)
      })
      .sort({ name: 1 })
      .lean();
  }

  async updatePolicy(tenantId: string, policyId: string, dto: UpdatePatchPolicyDto) {
    const updated = await this.patchPolicyModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(policyId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.targetTags !== undefined ? { targetTags: dto.targetTags } : {}),
            ...(dto.maintenanceWindow !== undefined
              ? { maintenanceWindow: dto.maintenanceWindow }
              : {}),
            ...(dto.autoApprove !== undefined ? { autoApprove: dto.autoApprove } : {}),
            ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Patch policy not found');
    }

    return updated;
  }

  async removePolicy(tenantId: string, policyId: string) {
    const result = await this.patchPolicyModel.deleteOne({
      _id: new Types.ObjectId(policyId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }

  async simulatePatchScan(tenantId: string, dto: SimulatePatchScanDto) {
    await this.devicesService.findById(tenantId, dto.deviceId);

    let policyId: Types.ObjectId | null = null;
    if (dto.policyId) {
      await this.ensurePolicy(tenantId, dto.policyId);
      policyId = new Types.ObjectId(dto.policyId);
    }

    const created = await this.patchModel.create({
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(dto.deviceId),
      policyId,
      kbId: dto.kbId.trim(),
      title: dto.title.trim(),
      severity: dto.severity ?? 'medium',
      status: PatchStatus.AVAILABLE,
      releasedAt: new Date(),
      scheduledAt: null,
      installedAt: null,
      metadata: {
        source: 'simulated-scan'
      }
    });

    return this.findPatchById(tenantId, String(created._id));
  }

  async listPatches(tenantId: string, query: ListPatchesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<PatchDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.deviceId) {
      filter.deviceId = new Types.ObjectId(query.deviceId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.severity) {
      filter.severity = query.severity;
    }

    const [items, total] = await Promise.all([
      this.patchModel
        .find(filter)
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
        .populate({ path: 'policyId', select: 'name enabled autoApprove' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.patchModel.countDocuments(filter)
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

  async findPatchById(tenantId: string, patchId: string) {
    const patch = await this.patchModel
      .findOne({
        _id: new Types.ObjectId(patchId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
      .populate({ path: 'policyId', select: 'name enabled autoApprove' })
      .lean();

    if (!patch) {
      throw new NotFoundException('Patch not found');
    }

    return patch;
  }

  async approvePatch(tenantId: string, patchId: string) {
    return this.patchStatusUpdate(tenantId, patchId, PatchStatus.APPROVED);
  }

  async schedulePatch(tenantId: string, patchId: string, dto: SchedulePatchDto) {
    const updated = await this.patchModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(patchId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            status: PatchStatus.SCHEDULED,
            scheduledAt: new Date(dto.scheduledAt)
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Patch not found');
    }

    return this.findPatchById(tenantId, patchId);
  }

  async executePatch(tenantId: string, patchId: string) {
    const patch = await this.patchModel.findOne({
      _id: new Types.ObjectId(patchId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (!patch) {
      throw new NotFoundException('Patch not found');
    }

    patch.status = PatchStatus.INSTALLING;
    await patch.save();

    const success = Math.random() > 0.15;
    patch.status = success ? PatchStatus.INSTALLED : PatchStatus.FAILED;
    patch.installedAt = success ? new Date() : null;
    patch.metadata = {
      ...(patch.metadata ?? {}),
      lastExecutionAt: new Date().toISOString(),
      result: success ? 'installed' : 'failed'
    };
    await patch.save();

    return this.findPatchById(tenantId, patchId);
  }

  private async patchStatusUpdate(tenantId: string, patchId: string, status: PatchStatus) {
    const updated = await this.patchModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(patchId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: { status }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Patch not found');
    }

    return this.findPatchById(tenantId, patchId);
  }

  private async ensurePolicy(tenantId: string, policyId: string): Promise<void> {
    const policy = await this.patchPolicyModel.findOne({
      _id: new Types.ObjectId(policyId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (!policy) {
      throw new NotFoundException('Patch policy not found');
    }
  }
}
