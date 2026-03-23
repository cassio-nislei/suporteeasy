import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContactDocument = HydratedDocument<Contact>;

@Schema({ timestamps: true, collection: 'contacts' })
export class Contact {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  @Prop({ default: '', trim: true })
  phone!: string;

  @Prop({ default: '', trim: true })
  title!: string;
}

export const ContactSchema = SchemaFactory.createForClass(Contact);
ContactSchema.index({ tenantId: 1, clientId: 1, email: 1 });
ContactSchema.index({ tenantId: 1, name: 1 });
