import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpsertSettingsDto } from './dto/upsert-settings.dto';
import { Settings, SettingsDocument } from './settings.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Settings.name)
    private readonly settingsModel: Model<SettingsDocument>
  ) {}

  async upsert(tenantId: string, userId: string, dto: UpsertSettingsDto) {
    return this.settingsModel
      .findOneAndUpdate(
        {
          tenantId: new Types.ObjectId(tenantId),
          key: dto.key.toLowerCase()
        },
        {
          $set: {
            value: dto.value,
            updatedBy: new Types.ObjectId(userId)
          }
        },
        {
          new: true,
          upsert: true
        }
      )
      .lean();
  }

  async list(tenantId: string) {
    return this.settingsModel
      .find({
        tenantId: new Types.ObjectId(tenantId)
      })
      .sort({ key: 1 })
      .lean();
  }

  async getByKey(tenantId: string, key: string) {
    const found = await this.settingsModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        key: key.toLowerCase()
      })
      .lean();

    if (!found) {
      throw new NotFoundException('Setting not found');
    }

    return found;
  }
}
