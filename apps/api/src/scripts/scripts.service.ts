import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreateScriptDto } from './dto/create-script.dto';
import { ListScriptsDto } from './dto/list-scripts.dto';
import { UpdateScriptDto } from './dto/update-script.dto';
import { Script, ScriptDocument } from './script.schema';

@Injectable()
export class ScriptsService {
  constructor(
    @InjectModel(Script.name)
    private readonly scriptModel: Model<ScriptDocument>
  ) {}

  async create(tenantId: string, dto: CreateScriptDto): Promise<Script> {
    const created = await this.scriptModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      description: dto.description ?? '',
      category: dto.category ?? 'general',
      platform: dto.platform,
      body: dto.body,
      parameters:
        dto.parameters?.map((parameter) => ({
          name: parameter.name,
          type: parameter.type ?? 'string',
          description: parameter.description ?? '',
          required: parameter.required ?? false,
          defaultValue: parameter.defaultValue ?? null
        })) ?? [],
      enabled: dto.enabled ?? true
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListScriptsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ScriptDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
        { category: { $regex: query.search, $options: 'i' } }
      ];
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.platform) {
      filter.platform = query.platform;
    }

    if (query.enabled !== undefined) {
      filter.enabled = query.enabled;
    }

    const [items, total] = await Promise.all([
      this.scriptModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.scriptModel.countDocuments(filter)
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

  async findById(tenantId: string, scriptId: string): Promise<Script> {
    const script = await this.scriptModel
      .findOne({
        _id: new Types.ObjectId(scriptId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!script) {
      throw new NotFoundException('Script not found');
    }

    return script;
  }

  async update(tenantId: string, scriptId: string, dto: UpdateScriptDto): Promise<Script> {
    const updated = await this.scriptModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(scriptId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.category !== undefined ? { category: dto.category } : {}),
            ...(dto.platform !== undefined ? { platform: dto.platform } : {}),
            ...(dto.body !== undefined ? { body: dto.body } : {}),
            ...(dto.parameters !== undefined
              ? {
                  parameters: dto.parameters.map((parameter) => ({
                    name: parameter.name,
                    type: parameter.type ?? 'string',
                    description: parameter.description ?? '',
                    required: parameter.required ?? false,
                    defaultValue: parameter.defaultValue ?? null
                  }))
                }
              : {}),
            ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Script not found');
    }

    return updated;
  }

  async remove(tenantId: string, scriptId: string): Promise<{ deleted: boolean }> {
    const result = await this.scriptModel.deleteOne({
      _id: new Types.ObjectId(scriptId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return {
      deleted: result.deletedCount > 0
    };
  }
}
