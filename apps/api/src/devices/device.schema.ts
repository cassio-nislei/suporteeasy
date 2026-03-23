import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

export enum DeviceOnlineStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}

@Schema({ _id: false })
export class DeviceInventory {
  @Prop({ type: String, default: '' })
  cpuModel!: string;

  @Prop({ type: Number, default: 0 })
  cpuCores!: number;

  @Prop({ type: Number, default: 0 })
  ramGb!: number;

  @Prop({ type: Number, default: 0 })
  diskGb!: number;

  @Prop({ type: String, default: '' })
  serialNumber!: string;

  @Prop({ type: [String], default: [] })
  services!: string[];
}

const DeviceInventorySchema = SchemaFactory.createForClass(DeviceInventory);

@Schema({ timestamps: true, collection: 'devices' })
export class Device {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', default: null, index: true })
  clientId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  hostname!: string;

  @Prop({ required: true, trim: true })
  ipAddress!: string;

  @Prop({ required: true, trim: true })
  os!: string;

  @Prop({ enum: DeviceOnlineStatus, default: DeviceOnlineStatus.UNKNOWN, index: true })
  onlineStatus!: DeviceOnlineStatus;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String, default: '' })
  notes!: string;

  @Prop({ type: DeviceInventorySchema, default: {} })
  inventory!: DeviceInventory;

  @Prop({ type: Date, default: null })
  lastHeartbeatAt!: Date | null;

  @Prop({ type: Date, default: null })
  lastSeenAt!: Date | null;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'DeviceGroup' }], default: [] })
  groupIds!: Types.ObjectId[];
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ tenantId: 1, hostname: 1 });
DeviceSchema.index({ tenantId: 1, ipAddress: 1 });
DeviceSchema.index({ tenantId: 1, onlineStatus: 1 });
