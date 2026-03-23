import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientDocument = HydratedDocument<Client>;

export enum ClientStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

@Schema({ timestamps: true, collection: 'clients' })
export class Client {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name!: string;

  @Prop({ enum: ClientStatus, default: ClientStatus.ACTIVE, index: true })
  status!: ClientStatus;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: String, default: '' })
  notes!: string;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.index({ tenantId: 1, name: 1 });
ClientSchema.index({ tenantId: 1, status: 1 });
