import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SlaPolicyDocument = HydratedDocument<SlaPolicy>;

export enum SlaEscalationTrigger {
  FIRST_RESPONSE = 'first_response',
  RESOLUTION = 'resolution'
}

@Schema({ _id: false })
export class SlaEscalationRule {
  @Prop({ enum: SlaEscalationTrigger, required: true })
  trigger!: SlaEscalationTrigger;

  @Prop({ type: Number, required: true, min: 1 })
  afterMinutes!: number;

  @Prop({ type: String, required: true, trim: true })
  action!: string;

  @Prop({ type: String, default: null })
  targetRoleSlug!: string | null;
}

const SlaEscalationRuleSchema = SchemaFactory.createForClass(SlaEscalationRule);

@Schema({ timestamps: true, collection: 'sla_policies' })
export class SlaPolicy {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', default: null, index: true })
  clientId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: Number, required: true, min: 1 })
  firstResponseMinutes!: number;

  @Prop({ type: Number, required: true, min: 1 })
  resolutionMinutes!: number;

  @Prop({ type: [SlaEscalationRuleSchema], default: [] })
  escalationRules!: SlaEscalationRule[];

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;
}

export const SlaPolicySchema = SchemaFactory.createForClass(SlaPolicy);
SlaPolicySchema.index({ tenantId: 1, clientId: 1, enabled: 1 });

