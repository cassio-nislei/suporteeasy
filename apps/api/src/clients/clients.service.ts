import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreateClientDto } from './dto/create-client.dto';
import { ListClientsDto } from './dto/list-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client, ClientDocument } from './client.schema';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>
  ) {}

  async create(tenantId: string, dto: CreateClientDto): Promise<Client> {
    const created = await this.clientModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      status: dto.status,
      tags: dto.tags ?? [],
      notes: dto.notes ?? ''
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListClientsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ClientDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: query.search, $options: 'i' } } },
        { notes: { $regex: query.search, $options: 'i' } }
      ];
    }

    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const [items, total] = await Promise.all([
      this.clientModel
        .find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.clientModel.countDocuments(filter)
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

  async findById(tenantId: string, clientId: string): Promise<Client> {
    const client = await this.clientModel
      .findOne({
        _id: new Types.ObjectId(clientId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!client) {
      throw new NotFoundException('Client not found');
    }

    return client;
  }

  async update(tenantId: string, clientId: string, dto: UpdateClientDto): Promise<Client> {
    const updated = await this.clientModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(clientId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Client not found');
    }

    return updated;
  }

  async remove(tenantId: string, clientId: string): Promise<{ deleted: boolean }> {
    const result = await this.clientModel.deleteOne({
      _id: new Types.ObjectId(clientId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }
}
