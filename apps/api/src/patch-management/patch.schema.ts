import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatchDocument = HydratedDocument<Patch>;

export enum PatchStatus {
  AVAILABLE = 'available',
  APPROVED = 'approved',
  SCHEDULED = 'scheduled',
  INSTALLING = 'installing',
  INSTALLED = 'installed',
  FAILED = 'failed'
}

@Schema({ timestamps: true, collection: 'patches' })
export class Patch {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'PatchPolicy', default: null, index: true })
  policyId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  kbId!: string;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ type: String, default: 'medium', index: true })
  severity!: string;

  @Prop({ enum: PatchStatus, default: PatchStatus.AVAILABLE, index: true })
  status!: PatchStatus;

  @Prop({ type: Date, default: null })
  releasedAt!: Date | null;

  @Prop({ type: Date, default: null })
  scheduledAt!: Date | null;

  @Prop({ type: Date, default: null })
  installedAt!: Date | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const PatchSchema = SchemaFactory.createForClass(Patch);
PatchSchema.index({ tenantId: 1, deviceId: 1, status: 1, severity: 1 });
PatchSchema.index({ tenantId: 1, kbId: 1 });
