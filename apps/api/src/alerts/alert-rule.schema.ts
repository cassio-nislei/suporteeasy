import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AlertRuleDocument = HydratedDocument<AlertRule>;

export enum AlertRuleTargetType {
  METRIC = 'metric',
  DEVICE_STATUS = 'device_status'
}

export enum AlertSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum AlertConditionOperator {
  GT = 'gt',
  GTE = 'gte',
  LT = 'lt',
  LTE = 'lte',
  EQ = 'eq',
  NEQ = 'neq'
}

export enum AlertDeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  UNKNOWN = 'unknown'
}

@Schema({ _id: false })
export class AlertRuleConditions {
  @Prop({ type: String, default: null })
  metricType!: string | null;

  @Prop({ type: String, enum: AlertConditionOperator, default: null })
  operator!: AlertConditionOperator | null;

  @Prop({ type: Number, default: null })
  threshold!: number | null;

  @Prop({ type: String, enum: AlertDeviceStatus, default: null })
  status!: AlertDeviceStatus | null;
}

const AlertRuleConditionsSchema = SchemaFactory.createForClass(AlertRuleConditions);

@Schema({ timestamps: true, collection: 'alert_rules' })
export class AlertRule {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ enum: AlertRuleTargetType, required: true, index: true })
  targetType!: AlertRuleTargetType;

  @Prop({ type: AlertRuleConditionsSchema, default: {} })
  conditions!: AlertRuleConditions;

  @Prop({ enum: AlertSeverity, required: true, index: true })
  severity!: AlertSeverity;

  @Prop({ type: Number, default: 0, min: 0 })
  cooldown!: number;

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  @Prop({ type: Boolean, default: false })
  autoCreateTicket!: boolean;
}

export const AlertRuleSchema = SchemaFactory.createForClass(AlertRule);
AlertRuleSchema.index({ tenantId: 1, targetType: 1, enabled: 1 });
AlertRuleSchema.index({ tenantId: 1, name: 1 });
