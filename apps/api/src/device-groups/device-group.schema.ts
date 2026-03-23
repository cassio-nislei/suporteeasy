import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceGroupDocument = HydratedDocument<DeviceGroup>;

@Schema({ timestamps: true, collection: 'device_groups' })
export class DeviceGroup {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: '' })
  description!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Device' }], default: [] })
  deviceIds!: Types.ObjectId[];
}

export const DeviceGroupSchema = SchemaFactory.createForClass(DeviceGroup);
DeviceGroupSchema.index({ tenantId: 1, name: 1 });
