import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractDocument = HydratedDocument<Contract>;

export enum ContractStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  EXPIRED = 'expired',
  TERMINATED = 'terminated'
}

@Schema({ timestamps: true, collection: 'contracts' })
export class Contract {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: 'managed-services', trim: true, index: true })
  type!: string;

  @Prop({ enum: ContractStatus, default: ContractStatus.DRAFT, index: true })
  status!: ContractStatus;

  @Prop({ type: Date, required: true })
  startDate!: Date;

  @Prop({ type: Date, default: null })
  endDate!: Date | null;

  @Prop({ type: Number, default: 0 })
  monthlyValue!: number;

  @Prop({ type: String, default: '', trim: true })
  termsMarkdown!: string;

  @Prop({ type: Boolean, default: true })
  autoRenew!: boolean;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
ContractSchema.index({ tenantId: 1, clientId: 1, status: 1, startDate: -1 });
ContractSchema.index({ tenantId: 1, name: 1 });
