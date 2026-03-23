import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Permission, PermissionDocument } from './permission.schema';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission.name)
    private readonly permissionModel: Model<PermissionDocument>
  ) {}

  async findByIds(ids: Array<string | Types.ObjectId>): Promise<Permission[]> {
    const objectIds = ids.map((id) => new Types.ObjectId(String(id)));
    return this.permissionModel.find({ _id: { $in: objectIds } }).lean();
  }

  async findAll(): Promise<Permission[]> {
    return this.permissionModel.find().sort({ module: 1, key: 1 }).lean();
  }

  async findByKeys(keys: string[]): Promise<Permission[]> {
    if (keys.length === 0) {
      return [];
    }

    return this.permissionModel.find({ key: { $in: keys } }).lean();
  }

  async upsertMany(
    permissions: Array<Pick<Permission, 'key' | 'description' | 'module'>>
  ): Promise<void> {
    if (permissions.length === 0) {
      return;
    }

    const operations = permissions.map((permission) => ({
      updateOne: {
        filter: { key: permission.key },
        update: {
          $set: permission
        },
        upsert: true
      }
    }));

    await this.permissionModel.bulkWrite(operations);
  }
}
