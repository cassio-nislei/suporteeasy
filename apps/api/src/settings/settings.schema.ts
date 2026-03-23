import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SettingsDocument = HydratedDocument<Settings>;

@Schema({ timestamps: true, collection: 'settings' })
export class Settings {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  key!: string;

  @Prop({ type: Object, default: {} })
  value!: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  updatedBy!: Types.ObjectId | null;
}

export const SettingsSchema = SchemaFactory.createForClass(Settings);
SettingsSchema.index({ tenantId: 1, key: 1 }, { unique: true });
