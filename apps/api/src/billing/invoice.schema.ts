import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type InvoiceDocument = HydratedDocument<Invoice>;

export enum InvoiceStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PAID = 'paid',
  OVERDUE = 'overdue',
  VOID = 'void'
}

@Schema({ timestamps: true, collection: 'invoices' })
export class Invoice {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true, index: true })
  clientId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract', default: null, index: true })
  contractId!: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  number!: string;

  @Prop({ enum: InvoiceStatus, default: InvoiceStatus.DRAFT, index: true })
  status!: InvoiceStatus;

  @Prop({ type: Date, required: true, index: true })
  issueDate!: Date;

  @Prop({ type: Date, required: true, index: true })
  dueDate!: Date;

  @Prop({ type: String, default: 'USD', trim: true })
  currency!: string;

  @Prop({ type: Number, default: 0 })
  subtotal!: number;

  @Prop({ type: Number, default: 0 })
  tax!: number;

  @Prop({ type: Number, default: 0 })
  total!: number;

  @Prop({ type: Date, default: null })
  paidAt!: Date | null;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
InvoiceSchema.index({ tenantId: 1, number: 1 }, { unique: true });
InvoiceSchema.index({ tenantId: 1, clientId: 1, issueDate: -1 });
