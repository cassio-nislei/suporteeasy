import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { HydratedDocument, Types } from 'mongoose';

export type RoleDocument = HydratedDocument<Role>;

@Schema({ timestamps: true, collection: 'roles' })
export class Role {
  @ApiProperty()
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null })
  tenantId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }], default: [] })
  permissionIds!: Types.ObjectId[];

  @Prop({ default: true })
  isSystem!: boolean;
}

export const RoleSchema = SchemaFactory.createForClass(Role);
RoleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
RoleSchema.index({ tenantId: 1, name: 1 });
