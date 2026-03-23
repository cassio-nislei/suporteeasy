import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type IntegrationDocument = HydratedDocument<Integration>;

export enum IntegrationType {
  WEBHOOK = 'webhook',
  SMTP = 'smtp'
}

@Schema({ timestamps: true, collection: 'integrations' })
export class Integration {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ enum: IntegrationType, required: true, index: true })
  type!: IntegrationType;

  @Prop({ type: Object, default: {} })
  config!: Record<string, unknown>;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Date, default: null })
  lastDeliveryAt!: Date | null;

  @Prop({ type: String, default: null })
  lastError!: string | null;
}

export const IntegrationSchema = SchemaFactory.createForClass(Integration);
IntegrationSchema.index({ tenantId: 1, type: 1, enabled: 1 });
IntegrationSchema.index({ tenantId: 1, name: 1 }, { unique: true });
