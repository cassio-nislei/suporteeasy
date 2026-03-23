import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { Device, DeviceDocument, DeviceOnlineStatus } from './device.schema';
import { CreateDeviceDto } from './dto/create-device.dto';
import { ListDevicesDto } from './dto/list-devices.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    private readonly clientsService: ClientsService
  ) {}

  async create(tenantId: string, dto: CreateDeviceDto): Promise<Device> {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const created = await this.deviceModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : null,
      hostname: dto.hostname,
      ipAddress: dto.ipAddress,
      os: dto.os,
      onlineStatus: DeviceOnlineStatus.UNKNOWN,
      tags: dto.tags ?? [],
      notes: dto.notes ?? '',
      inventory: {
        cpuModel: dto.inventory?.cpuModel ?? '',
        cpuCores: dto.inventory?.cpuCores ?? 0,
        ramGb: dto.inventory?.ramGb ?? 0,
        diskGb: dto.inventory?.diskGb ?? 0,
        serialNumber: dto.inventory?.serialNumber ?? '',
        services: dto.inventory?.services ?? []
      }
    });

    return this.serialize(await created.populate({ path: 'clientId', select: 'name status' }));
  }

  async list(tenantId: string, query: ListDevicesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<DeviceDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.onlineStatus) {
      filter.onlineStatus = query.onlineStatus;
    }

    if (query.search) {
      filter.$or = [
        { hostname: { $regex: query.search, $options: 'i' } },
        { ipAddress: { $regex: query.search, $options: 'i' } },
        { os: { $regex: query.search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: query.search, $options: 'i' } } }
      ];
    }

    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const [items, total] = await Promise.all([
      this.deviceModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit),
      this.deviceModel.countDocuments(filter)
    ]);

    return {
      items: items.map((item) => this.serialize(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findById(tenantId: string, deviceId: string): Promise<Device> {
    const device = await this.deviceModel
      .findOne({
        _id: new Types.ObjectId(deviceId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return this.serialize(device);
  }

  async update(tenantId: string, deviceId: string, dto: UpdateDeviceDto): Promise<Device> {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const updated = await this.deviceModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(deviceId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.clientId !== undefined
              ? { clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : null }
              : {}),
            ...(dto.hostname !== undefined ? { hostname: dto.hostname } : {}),
            ...(dto.ipAddress !== undefined ? { ipAddress: dto.ipAddress } : {}),
            ...(dto.os !== undefined ? { os: dto.os } : {}),
            ...(dto.tags !== undefined ? { tags: dto.tags } : {}),
            ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            ...(dto.inventory !== undefined
              ? {
                  inventory: {
                    cpuModel: dto.inventory.cpuModel ?? '',
                    cpuCores: dto.inventory.cpuCores ?? 0,
                    ramGb: dto.inventory.ramGb ?? 0,
                    diskGb: dto.inventory.diskGb ?? 0,
                    serialNumber: dto.inventory.serialNumber ?? '',
                    services: dto.inventory.services ?? []
                  }
                }
              : {})
          }
        },
        { new: true }
      )
      .populate({ path: 'clientId', select: 'name status' });

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    return this.serialize(updated);
  }

  async remove(tenantId: string, deviceId: string): Promise<{ deleted: boolean }> {
    const result = await this.deviceModel.deleteOne({
      _id: new Types.ObjectId(deviceId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }

  async findByIdForAgent(deviceId: string): Promise<DeviceDocument | null> {
    return this.deviceModel.findById(deviceId);
  }

  async touchHeartbeat(
    tenantId: string,
    deviceId: string,
    status: DeviceOnlineStatus,
    inventoryServices?: string[]
  ): Promise<DeviceDocument | null> {
    return this.deviceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(deviceId),
        tenantId: new Types.ObjectId(tenantId)
      },
      {
        $set: {
          onlineStatus: status,
          lastHeartbeatAt: new Date(),
          lastSeenAt: new Date(),
          ...(inventoryServices ? { 'inventory.services': inventoryServices } : {})
        }
      },
      {
        new: true
      }
    );
  }

  async setOnlineStatus(
    tenantId: string,
    deviceId: string,
    status: DeviceOnlineStatus,
    heartbeatAt?: Date
  ): Promise<DeviceDocument | null> {
    return this.deviceModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(deviceId),
        tenantId: new Types.ObjectId(tenantId)
      },
      {
        $set: {
          onlineStatus: status,
          ...(heartbeatAt ? { lastHeartbeatAt: heartbeatAt, lastSeenAt: heartbeatAt } : {})
        }
      },
      { new: true }
    );
  }

  async markStaleDevicesOffline(thresholdDate: Date): Promise<Device[]> {
    const staleDevices = await this.deviceModel
      .find({
        onlineStatus: DeviceOnlineStatus.ONLINE,
        lastHeartbeatAt: { $lt: thresholdDate }
      })
      .lean();

    if (staleDevices.length === 0) {
      return [];
    }

    await this.deviceModel.updateMany(
      {
        _id: { $in: staleDevices.map((device) => device._id) }
      },
      {
        $set: {
          onlineStatus: DeviceOnlineStatus.OFFLINE
        }
      }
    );

    return staleDevices;
  }

  async addTags(tenantId: string, deviceId: string, tags: string[]): Promise<Device> {
    const normalizedTags = [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];

    const updated = await this.deviceModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(deviceId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $addToSet: {
            tags: { $each: normalizedTags }
          }
        },
        { new: true }
      )
      .populate({ path: 'clientId', select: 'name status' });

    if (!updated) {
      throw new NotFoundException('Device not found');
    }

    return this.serialize(updated);
  }

  async countByStatus(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const [total, online, offline] = await Promise.all([
      this.deviceModel.countDocuments({ tenantId: tenantObjectId }),
      this.deviceModel.countDocuments({ tenantId: tenantObjectId, onlineStatus: DeviceOnlineStatus.ONLINE }),
      this.deviceModel.countDocuments({ tenantId: tenantObjectId, onlineStatus: DeviceOnlineStatus.OFFLINE })
    ]);

    return {
      total,
      online,
      offline,
      unknown: Math.max(0, total - online - offline)
    };
  }

  private serialize(device: DeviceDocument | (Device & { clientId?: unknown })): Device {
    return typeof (device as DeviceDocument).toObject === 'function'
      ? ((device as DeviceDocument).toObject() as Device)
      : (device as Device);
  }
}
