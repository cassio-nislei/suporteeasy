import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { ScriptPlatform } from '../scripts/script.schema';

export type ScriptExecutionDocument = HydratedDocument<ScriptExecution>;

export enum ScriptExecutionStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed'
}

@Schema({ _id: false })
export class ScriptExecutionLogEntry {
  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;
}

@Schema({ _id: false })
export class ScriptSnapshot {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true })
  category!: string;

  @Prop({ enum: ScriptPlatform, required: true })
  platform!: ScriptPlatform;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ type: [String], default: [] })
  parameterNames!: string[];
}

const ScriptExecutionLogEntrySchema = SchemaFactory.createForClass(ScriptExecutionLogEntry);
const ScriptSnapshotSchema = SchemaFactory.createForClass(ScriptSnapshot);

@Schema({ timestamps: true, collection: 'script_executions' })
export class ScriptExecution {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Script', required: true, index: true })
  scriptId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Device', required: true, index: true })
  deviceId!: Types.ObjectId;

  @Prop({ enum: ScriptExecutionStatus, default: ScriptExecutionStatus.QUEUED, index: true })
  status!: ScriptExecutionStatus;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt!: Date | null;

  @Prop({ type: [ScriptExecutionLogEntrySchema], default: [] })
  logs!: ScriptExecutionLogEntry[];

  @Prop({ type: SchemaTypes.Mixed, default: null })
  result!: Record<string, unknown> | null;

  @Prop({ type: ScriptSnapshotSchema, required: true })
  scriptSnapshot!: ScriptSnapshot;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null, index: true })
  requestedBy!: Types.ObjectId | null;

  @Prop({ type: String, default: 'manual', trim: true, index: true })
  source!: string;
}

export const ScriptExecutionSchema = SchemaFactory.createForClass(ScriptExecution);
ScriptExecutionSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
ScriptExecutionSchema.index({ tenantId: 1, deviceId: 1, createdAt: -1 });
