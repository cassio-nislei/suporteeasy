import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TenantDocument = HydratedDocument<Tenant>;

export enum TenantPlan {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise'
}

export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended'
}

@Schema({ timestamps: true, collection: 'tenants' })
export class Tenant {
  _id!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, unique: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ enum: TenantPlan, default: TenantPlan.PRO })
  plan!: TenantPlan;

  @Prop({ enum: TenantStatus, default: TenantStatus.ACTIVE })
  status!: TenantStatus;

  @Prop({ type: Object, default: {} })
  settings!: Record<string, unknown>;
}

export const TenantSchema = SchemaFactory.createForClass(Tenant);
