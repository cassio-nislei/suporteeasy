import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PatchPolicyDocument = HydratedDocument<PatchPolicy>;

@Schema({ timestamps: true, collection: 'patch_policies' })
export class PatchPolicy {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: '', trim: true })
  description!: string;

  @Prop({ type: [String], default: [] })
  targetTags!: string[];

  @Prop({ type: String, default: '', trim: true })
  maintenanceWindow!: string;

  @Prop({ type: Boolean, default: false })
  autoApprove!: boolean;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;
}

export const PatchPolicySchema = SchemaFactory.createForClass(PatchPolicy);
PatchPolicySchema.index({ tenantId: 1, name: 1 }, { unique: true });
