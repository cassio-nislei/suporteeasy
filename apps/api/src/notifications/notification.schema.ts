import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  ALERT_CREATED = 'alert_created',
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  SCRIPT_EXECUTION = 'script_execution',
  AUTOMATION = 'automation'
}

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: Types.ObjectId;

  @Prop({ enum: NotificationType, required: true, index: true })
  type!: NotificationType;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ type: Date, default: null, index: true })
  readAt!: Date | null;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata!: Record<string, unknown>;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ tenantId: 1, userId: 1, readAt: 1, createdAt: -1 });
