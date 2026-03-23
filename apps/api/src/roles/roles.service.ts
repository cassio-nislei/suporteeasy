import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from './role.schema';

@Injectable()
export class RolesService {
  constructor(
    @InjectModel(Role.name)
    private readonly roleModel: Model<RoleDocument>
  ) {}

  async findByIds(ids: Array<string | Types.ObjectId>): Promise<Role[]> {
    if (ids.length === 0) {
      return [];
    }

    const objectIds = ids.map((id) => new Types.ObjectId(String(id)));
    return this.roleModel.find({ _id: { $in: objectIds } }).lean();
  }

  async findByTenant(tenantId: string): Promise<Role[]> {
    return this.roleModel
      .find({ $or: [{ tenantId: new Types.ObjectId(tenantId) }, { tenantId: null }] })
      .sort({ isSystem: -1, name: 1 })
      .lean();
  }

  async upsertRole(input: {
    tenantId: Types.ObjectId | null;
    slug: string;
    name: string;
    description: string;
    permissionIds: Types.ObjectId[];
    isSystem: boolean;
  }): Promise<RoleDocument> {
    return this.roleModel.findOneAndUpdate(
      { tenantId: input.tenantId, slug: input.slug },
      {
        $set: {
          name: input.name,
          description: input.description,
          permissionIds: input.permissionIds,
          isSystem: input.isSystem
        }
      },
      { upsert: true, new: true }
    );
  }
}
