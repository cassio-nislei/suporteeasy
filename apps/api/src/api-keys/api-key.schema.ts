import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ApiKeyDocument = HydratedDocument<ApiKey>;

@Schema({ timestamps: true, collection: 'api_keys' })
export class ApiKey {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, index: true })
  keyPrefix!: string;

  @Prop({ required: true, trim: true, index: true })
  hashedKey!: string;

  @Prop({ type: [String], default: [] })
  scopes!: string[];

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Date, default: null })
  expiresAt!: Date | null;

  @Prop({ type: Date, default: null, index: true })
  revokedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  createdBy!: Types.ObjectId | null;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
ApiKeySchema.index({ tenantId: 1, name: 1 });
ApiKeySchema.index({ tenantId: 1, revokedAt: 1, expiresAt: 1 });
