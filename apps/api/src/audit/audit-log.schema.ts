import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null })
  tenantId!: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  userId!: Types.ObjectId | null;

  @Prop({ required: true })
  action!: string;

  @Prop({ required: true })
  entityType!: string;

  @Prop({ type: String, default: null })
  entityId!: string | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ tenantId: 1, createdAt: -1 });
AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
