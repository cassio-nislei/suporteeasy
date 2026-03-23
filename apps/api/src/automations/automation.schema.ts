import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type AutomationDocument = HydratedDocument<Automation>;

export enum AutomationTrigger {
  ALERT_CREATED = 'alert_created',
  DEVICE_OFFLINE = 'device_offline',
  SCRIPT_FAILED = 'script_failed',
  TICKET_CREATED = 'ticket_created'
}

export enum AutomationActionType {
  CREATE_TICKET = 'create_ticket',
  SEND_NOTIFICATION = 'send_notification',
  EXECUTE_SCRIPT = 'execute_script',
  ASSIGN_TECHNICIAN = 'assign_technician',
  TAG_DEVICE = 'tag_device',
  WRITE_ACTIVITY_LOG = 'write_activity_log'
}

@Schema({ _id: false })
export class AutomationAction {
  @Prop({ enum: AutomationActionType, required: true })
  type!: AutomationActionType;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  config!: Record<string, unknown>;
}

@Schema({ _id: false })
export class AutomationRetryPolicy {
  @Prop({ type: Number, default: 1, min: 1 })
  maxAttempts!: number;

  @Prop({ type: Number, default: 0, min: 0 })
  backoffMs!: number;
}

const AutomationActionSchema = SchemaFactory.createForClass(AutomationAction);
const AutomationRetryPolicySchema = SchemaFactory.createForClass(AutomationRetryPolicy);

@Schema({ timestamps: true, collection: 'automations' })
export class Automation {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ enum: AutomationTrigger, required: true, index: true })
  trigger!: AutomationTrigger;

  @Prop({ type: SchemaTypes.Mixed, default: {} })
  conditions!: Record<string, unknown>;

  @Prop({ type: [AutomationActionSchema], default: [] })
  actions!: AutomationAction[];

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;

  @Prop({ type: AutomationRetryPolicySchema, default: {} })
  retryPolicy!: AutomationRetryPolicy;
}

export const AutomationSchema = SchemaFactory.createForClass(Automation);
AutomationSchema.index({ tenantId: 1, trigger: 1, enabled: 1 });
AutomationSchema.index({ tenantId: 1, name: 1 });
