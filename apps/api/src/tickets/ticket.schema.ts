import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketDocument = HydratedDocument<Ticket>;

export enum TicketSource {
  MANUAL = 'manual',
  ALERT = 'alert',
  AUTOMATION = 'automation',
  PORTAL = 'portal'
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REOPENED = 'reopened'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

@Schema({ timestamps: true, collection: 'tickets' })
export class Ticket {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', default: null, index: true })
  clientId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Device', default: null, index: true })
  deviceId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'Alert', default: null, index: true })
  alertId!: Types.ObjectId | null;

  @Prop({ enum: TicketSource, required: true, default: TicketSource.MANUAL, index: true })
  source!: TicketSource;

  @Prop({ required: true, trim: true })
  subject!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ enum: TicketStatus, default: TicketStatus.OPEN, index: true })
  status!: TicketStatus;

  @Prop({ enum: TicketPriority, default: TicketPriority.MEDIUM, index: true })
  priority!: TicketPriority;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  assigneeId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  portalRequesterId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'SlaPolicy', default: null, index: true })
  slaPolicyId!: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  firstResponseDueAt!: Date | null;

  @Prop({ type: Date, default: null })
  resolutionDueAt!: Date | null;

  @Prop({ type: Date, default: null })
  firstRespondedAt!: Date | null;

  @Prop({ type: Date, default: null })
  resolvedAt!: Date | null;

  @Prop({ type: Date, default: null })
  closedAt!: Date | null;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);
TicketSchema.index({ tenantId: 1, status: 1, priority: 1, createdAt: -1 });
TicketSchema.index({ tenantId: 1, alertId: 1 });
TicketSchema.index({ tenantId: 1, assigneeId: 1, status: 1 });
TicketSchema.index({ tenantId: 1, portalRequesterId: 1, createdAt: -1 });
TicketSchema.index({ tenantId: 1, resolutionDueAt: 1, status: 1 });
