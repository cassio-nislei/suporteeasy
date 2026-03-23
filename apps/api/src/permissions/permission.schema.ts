import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PermissionDocument = HydratedDocument<Permission>;

@Schema({ timestamps: true, collection: 'permissions' })
export class Permission {
  _id!: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  key!: string;

  @Prop({ required: true, trim: true })
  description!: string;

  @Prop({ required: true, trim: true })
  module!: string;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
