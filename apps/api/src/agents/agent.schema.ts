import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AgentDocument = HydratedDocument<Agent>;

export enum AgentStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error'
}

@Schema({ timestamps: true, collection: 'agents' })
export class Agent {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ required: true, trim: true })
  version!: string;

  @Prop({ type: Date, default: null })
  lastHeartbeatAt!: Date | null;

  @Prop({ enum: AgentStatus, default: AgentStatus.OFFLINE, index: true })
  status!: AgentStatus;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
AgentSchema.index({ tenantId: 1, deviceId: 1 }, { unique: true });
