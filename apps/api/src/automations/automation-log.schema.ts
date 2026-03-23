import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { AutomationTrigger } from './automation.schema';

export type AutomationLogDocument = HydratedDocument<AutomationLog>;

export enum AutomationLogStatus {
  RUNNING = 'running',
  SUCCESS = 'success',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

@Schema({ _id: false })
export class AutomationLogEntry {
  @Prop({ required: true, trim: true })
  message!: string;

  @Prop({ required: true, trim: true, default: 'info' })
  level!: 'info' | 'warn' | 'error';

  @Prop({ type: Date, required: true, default: () => new Date() })
  createdAt!: Date;
}

const AutomationLogEntrySchema = SchemaFactory.createForClass(AutomationLogEntry);

@Schema({ timestamps: true, collection: 'automation_logs' })
export class AutomationLog {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Automation', required: true, index: true })
  automationId!: Types.ObjectId;

  @Prop({ enum: AutomationTrigger, required: true, index: true })
  trigger!: AutomationTrigger;

  @Prop({ enum: AutomationLogStatus, required: true, index: true })
  status!: AutomationLogStatus;

  @Prop({ type: Date, default: null })
  startedAt!: Date | null;

  @Prop({ type: Date, default: null })
  finishedAt!: Date | null;

  @Prop({ type: [AutomationLogEntrySchema], default: [] })
  entries!: AutomationLogEntry[];

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  context!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  error!: string | null;
}

export const AutomationLogSchema = SchemaFactory.createForClass(AutomationLog);
AutomationLogSchema.index({ tenantId: 1, createdAt: -1 });
AutomationLogSchema.index({ tenantId: 1, automationId: 1, createdAt: -1 });
