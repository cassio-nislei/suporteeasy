import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type DeviceActivityDocument = HydratedDocument<DeviceActivity>;

@Schema({ timestamps: true, collection: 'device_activities' })
export class DeviceActivity {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  type!: string;

  @Prop({ type: String, default: '' })
  message!: string;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: Date, default: () => new Date(), index: true })
  occurredAt!: Date;
}

export const DeviceActivitySchema = SchemaFactory.createForClass(DeviceActivity);
DeviceActivitySchema.index({ tenantId: 1, deviceId: 1, occurredAt: -1 });
