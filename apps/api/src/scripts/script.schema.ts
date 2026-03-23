import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ScriptDocument = HydratedDocument<Script>;

export enum ScriptPlatform {
  POWERSHELL = 'powershell',
  BASH = 'bash',
  PYTHON = 'python',
  SHELL = 'shell'
}

@Schema({ _id: false })
export class ScriptParameter {
  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, required: true, trim: true, default: 'string' })
  type!: string;

  @Prop({ type: String, default: '', trim: true })
  description!: string;

  @Prop({ type: Boolean, default: false })
  required!: boolean;

  @Prop({ type: String, default: null })
  defaultValue!: string | null;
}

const ScriptParameterSchema = SchemaFactory.createForClass(ScriptParameter);

@Schema({ timestamps: true, collection: 'scripts' })
export class Script {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ type: String, default: '', trim: true })
  description!: string;

  @Prop({ type: String, default: 'general', trim: true, index: true })
  category!: string;

  @Prop({ enum: ScriptPlatform, required: true, index: true })
  platform!: ScriptPlatform;

  @Prop({ required: true, trim: true })
  body!: string;

  @Prop({ type: [ScriptParameterSchema], default: [] })
  parameters!: ScriptParameter[];

  @Prop({ type: Boolean, default: true, index: true })
  enabled!: boolean;
}

export const ScriptSchema = SchemaFactory.createForClass(Script);
ScriptSchema.index({ tenantId: 1, name: 1 }, { unique: true });
ScriptSchema.index({ tenantId: 1, category: 1, enabled: 1 });
