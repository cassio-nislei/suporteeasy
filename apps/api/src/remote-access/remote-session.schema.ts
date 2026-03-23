import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RemoteSessionDocument = HydratedDocument<RemoteSession>;

export enum RemoteSessionStatus {
  REQUESTED = 'requested',
  ACTIVE = 'active',
  ENDED = 'ended',
  FAILED = 'failed'
}

@Schema({ timestamps: true, collection: 'remote_sessions' })
export class RemoteSession {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  requestedBy!: Types.ObjectId | null;

  @Prop({ enum: RemoteSessionStatus, default: RemoteSessionStatus.REQUESTED, index: true })
  status!: RemoteSessionStatus;

  @Prop({ type: String, default: 'builtin-sim', trim: true })
  provider!: string;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  endedAt!: Date | null;

  @Prop({ type: Object, default: {} })
  metadata!: Record<string, unknown>;
}

export const RemoteSessionSchema = SchemaFactory.createForClass(RemoteSession);
RemoteSessionSchema.index({ tenantId: 1, deviceId: 1, status: 1, createdAt: -1 });
