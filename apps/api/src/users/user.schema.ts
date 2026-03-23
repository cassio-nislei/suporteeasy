import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export enum UserStatus {
  INVITED = 'invited',
  PENDING_VERIFICATION = 'pending_verification',
  ACTIVE = 'active',
  SUSPENDED = 'suspended'
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', default: null, index: true })
  tenantId!: Types.ObjectId | null;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ required: true })
  passwordHash!: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Role' }], default: [] })
  roleIds!: Types.ObjectId[];

  @Prop({ enum: UserStatus, default: UserStatus.PENDING_VERIFICATION })
  status!: UserStatus;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  @Prop({ type: String, default: null })
  refreshTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt!: Date | null;

  @Prop({ type: String, default: null })
  inviteTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  inviteTokenExpiresAt!: Date | null;

  @Prop({ type: Date, default: null })
  inviteAcceptedAt!: Date | null;

  @Prop({ type: String, default: null })
  resetPasswordTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  resetPasswordExpiresAt!: Date | null;

  @Prop({ type: String, default: null })
  emailVerificationTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpiresAt!: Date | null;

  @Prop({ type: Boolean, default: false, index: true })
  isPortalUser!: boolean;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Client' }], default: [] })
  portalClientIds!: Types.ObjectId[];
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ tenantId: 1, status: 1 });
UserSchema.index({ tenantId: 1, email: 1 });
