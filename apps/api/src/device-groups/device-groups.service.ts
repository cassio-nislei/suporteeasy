import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DevicesService } from '../devices/devices.service';
import { CreateDeviceGroupDto } from './dto/create-device-group.dto';
import { UpdateDeviceGroupDto } from './dto/update-device-group.dto';
import { DeviceGroup, DeviceGroupDocument } from './device-group.schema';

@Injectable()
export class DeviceGroupsService {
  constructor(
    @InjectModel(DeviceGroup.name)
    private readonly deviceGroupModel: Model<DeviceGroupDocument>,
    private readonly devicesService: DevicesService
  ) {}

  async create(tenantId: string, dto: CreateDeviceGroupDto) {
    if (dto.deviceIds?.length) {
      await Promise.all(dto.deviceIds.map((deviceId) => this.devicesService.findById(tenantId, deviceId)));
    }

    const created = await this.deviceGroupModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      description: dto.description ?? '',
      deviceIds: (dto.deviceIds ?? []).map((id) => new Types.ObjectId(id))
    });

    return created.toObject();
  }

  async list(tenantId: string) {
    return this.deviceGroupModel
      .find({ tenantId: new Types.ObjectId(tenantId) })
      .sort({ name: 1 })
      .lean();
  }

  async findById(tenantId: string, groupId: string) {
    const group = await this.deviceGroupModel
      .findOne({
        _id: new Types.ObjectId(groupId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!group) {
      throw new NotFoundException('Device group not found');
    }

    return group;
  }

  async update(tenantId: string, groupId: string, dto: UpdateDeviceGroupDto) {
    if (dto.deviceIds?.length) {
      await Promise.all(dto.deviceIds.map((deviceId) => this.devicesService.findById(tenantId, deviceId)));
    }

    const updated = await this.deviceGroupModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(groupId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined ? { description: dto.description } : {}),
            ...(dto.deviceIds !== undefined
              ? { deviceIds: dto.deviceIds.map((id) => new Types.ObjectId(id)) }
              : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Device group not found');
    }

    return updated;
  }

  async remove(tenantId: string, groupId: string) {
    const result = await this.deviceGroupModel.deleteOne({
      _id: new Types.ObjectId(groupId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }
}
