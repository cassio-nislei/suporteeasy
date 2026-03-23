import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ScriptPlatform } from '../scripts/script.schema';

export type AgentCommandDocument = HydratedDocument<AgentCommand>;

export enum AgentCommandStatus {
  PENDING = 'pending',
  DISPATCHED = 'dispatched',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Schema({ timestamps: true, collection: 'agent_commands' })
export class AgentCommand {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Agent', required: true, index: true })
  agentId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ScriptExecution', required: true, index: true })
  scriptExecutionId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Script', required: true })
  scriptId!: Types.ObjectId;

  @Prop({ enum: AgentCommandStatus, default: AgentCommandStatus.PENDING, index: true })
  status!: AgentCommandStatus;

  @Prop({ required: true, trim: true })
  scriptName!: string;

  @Prop({ enum: ScriptPlatform, required: true })
  platform!: ScriptPlatform;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  parameters!: Record<string, string | number | boolean>;

  @Prop({ type: Date, default: null })
  dispatchedAt!: Date | null;

  @Prop({ type: Date, default: null })
  completedAt!: Date | null;

  @Prop({ type: SchemaTypes.Mixed, default: null })
  result!: Record<string, unknown> | null;
}

export const AgentCommandSchema = SchemaFactory.createForClass(AgentCommand);
AgentCommandSchema.index({ tenantId: 1, deviceId: 1, status: 1, createdAt: 1 });
