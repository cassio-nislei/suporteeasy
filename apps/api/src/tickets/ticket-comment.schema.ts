import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TicketCommentDocument = HydratedDocument<TicketComment>;

export enum TicketCommentVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal'
}

@Schema({ timestamps: true, collection: 'ticket_comments' })
export class TicketComment {
  _id!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Ticket', required: true, index: true })
  ticketId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  authorId!: Types.ObjectId;

  @Prop({ enum: TicketCommentVisibility, default: TicketCommentVisibility.INTERNAL, index: true })
  visibility!: TicketCommentVisibility;

  @Prop({ required: true, trim: true })
  body!: string;
}

export const TicketCommentSchema = SchemaFactory.createForClass(TicketComment);
TicketCommentSchema.index({ tenantId: 1, ticketId: 1, createdAt: 1 });

