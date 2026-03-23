import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SubscriptionDocument = HydratedDocument<Subscription>;

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  CANCELED = 'canceled'
}

@Schema({ timestamps: true, collection: 'subscriptions' })
export class Subscription {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract', default: null, index: true })
  contractId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  planName!: string;

  @Prop({ enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE, index: true })
  status!: SubscriptionStatus;

  @Prop({ type: Number, default: 0 })
  monthlyPrice!: number;

  @Prop({ type: Date, required: true })
  startedAt!: Date;

  @Prop({ type: Date, default: null })
  canceledAt!: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
SubscriptionSchema.index({ tenantId: 1, clientId: 1, status: 1 });
