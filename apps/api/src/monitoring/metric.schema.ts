import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type MetricDocument = HydratedDocument<Metric>;

@Schema({ timestamps: true, collection: 'metrics' })
export class Metric {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ required: true, trim: true, index: true })
  type!: string;

  @Prop({ required: true })
  value!: number;

  @Prop({ required: true, trim: true })
  unit!: string;

  @Prop({ type: Date, required: true, index: true })
  timestamp!: Date;
}

export const MetricSchema = SchemaFactory.createForClass(Metric);
MetricSchema.index({ tenantId: 1, deviceId: 1, type: 1, timestamp: -1 });
