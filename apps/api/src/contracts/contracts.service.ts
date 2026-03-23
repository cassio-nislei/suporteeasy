import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { Contract, ContractDocument } from './contract.schema';
import { CreateContractDto } from './dto/create-contract.dto';
import { ListContractsDto } from './dto/list-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name)
    private readonly contractModel: Model<ContractDocument>,
    private readonly clientsService: ClientsService
  ) {}

  async create(tenantId: string, dto: CreateContractDto) {
    await this.clientsService.findById(tenantId, dto.clientId);

    const created = await this.contractModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(dto.clientId),
      name: dto.name.trim(),
      type: dto.type?.trim() ?? 'managed-services',
      status: dto.status,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      monthlyValue: dto.monthlyValue ?? 0,
      termsMarkdown: dto.termsMarkdown ?? '',
      autoRenew: dto.autoRenew ?? true
    });

    return this.findById(tenantId, String(created._id));
  }

  async list(tenantId: string, query: ListContractsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const filter: FilterQuery<ContractDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { type: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      this.contractModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.contractModel.countDocuments(filter)
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

  async findById(tenantId: string, contractId: string) {
    const contract = await this.contractModel
      .findOne({
        _id: new Types.ObjectId(contractId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .lean();

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async update(tenantId: string, contractId: string, dto: UpdateContractDto) {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const updated = await this.contractModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(contractId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.clientId !== undefined ? { clientId: new Types.ObjectId(dto.clientId) } : {}),
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.startDate !== undefined ? { startDate: new Date(dto.startDate) } : {}),
            ...(dto.endDate !== undefined ? { endDate: dto.endDate ? new Date(dto.endDate) : null } : {}),
            ...(dto.monthlyValue !== undefined ? { monthlyValue: dto.monthlyValue } : {}),
            ...(dto.termsMarkdown !== undefined ? { termsMarkdown: dto.termsMarkdown } : {}),
            ...(dto.autoRenew !== undefined ? { autoRenew: dto.autoRenew } : {})
          }
        },
        {
          new: true
        }
      )
      .populate({ path: 'clientId', select: 'name status' })
      .lean();

    if (!updated) {
      throw new NotFoundException('Contract not found');
    }

    return updated;
  }

  async remove(tenantId: string, contractId: string) {
    const result = await this.contractModel.deleteOne({
      _id: new Types.ObjectId(contractId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return {
      deleted: result.deletedCount > 0
    };
  }

  async findLeanByClientIds(tenantId: string, clientIds: string[]) {
    if (clientIds.length === 0) {
      return [];
    }

    return this.contractModel.find({
      tenantId: new Types.ObjectId(tenantId),
      clientId: { $in: clientIds.map((id) => new Types.ObjectId(id)) }
    }).lean();
  }
}
