import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type ScheduledJobDocument = HydratedDocument<ScheduledJob>;

export enum ScheduledJobType {
  SCRIPT = 'script'
}

export enum ScheduledJobStatus {
  PENDING = 'pending',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Schema({ timestamps: true, collection: 'scheduled_jobs' })
export class ScheduledJob {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ enum: ScheduledJobType, required: true, index: true })
  type!: ScheduledJobType;

  @Prop({ type: SchemaTypes.Mixed, required: true })
  payload!: Record<string, unknown>;

  @Prop({ type: Date, required: true, index: true })
  runAt!: Date;

  @Prop({ enum: ScheduledJobStatus, default: ScheduledJobStatus.PENDING, index: true })
  status!: ScheduledJobStatus;
}

export const ScheduledJobSchema = SchemaFactory.createForClass(ScheduledJob);
ScheduledJobSchema.index({ tenantId: 1, status: 1, runAt: 1 });
