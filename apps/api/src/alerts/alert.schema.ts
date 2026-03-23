import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AlertSeverity } from './alert-rule.schema';

export type AlertDocument = HydratedDocument<Alert>;

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved'
}

@Schema({ _id: false })
export class AlertTimelineEntry {
  @Prop({ required: true, trim: true })
  type!: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  actorId!: Types.ObjectId | null;

  @Prop({ type: Date, required: true, default: () => new Date() })
  occurredAt!: Date;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata!: Record<string, unknown>;
}

const AlertTimelineEntrySchema = SchemaFactory.createForClass(AlertTimelineEntry);

@Schema({ timestamps: true, collection: 'alerts' })
export class Alert {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'AlertRule', required: true, index: true })
  alertRuleId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ticket', default: null, index: true })
  ticketId!: Types.ObjectId | null;

  @Prop({ enum: AlertSeverity, required: true, index: true })
  severity!: AlertSeverity;

  @Prop({ enum: AlertStatus, default: AlertStatus.OPEN, index: true })
  status!: AlertStatus;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ type: Number, default: null })
  triggeredValue!: number | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  acknowledgedBy!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null;

  @Prop({ type: [AlertTimelineEntrySchema], default: [] })
  timeline!: AlertTimelineEntry[];
}

export const AlertSchema = SchemaFactory.createForClass(Alert);
AlertSchema.index({ tenantId: 1, status: 1, severity: 1, createdAt: -1 });
AlertSchema.index({ tenantId: 1, deviceId: 1, alertRuleId: 1, status: 1 });
