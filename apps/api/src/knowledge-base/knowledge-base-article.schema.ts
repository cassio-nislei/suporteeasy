import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type KnowledgeBaseArticleDocument = HydratedDocument<KnowledgeBaseArticle>;

export enum ArticleVisibility {
  PUBLIC = 'public',
  INTERNAL = 'internal'
}

@Schema({ timestamps: true, collection: 'knowledge_base_articles' })
export class KnowledgeBaseArticle {
  _id!: Types.ObjectId;
  createdAt!: Date;
  updatedAt!: Date;

  @Prop({ type: Types.ObjectId, ref: 'Tenant', required: true, index: true })
  tenantId!: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true, trim: true, lowercase: true })
  slug!: string;

  @Prop({ type: String, default: '', trim: true })
  summary!: string;

  @Prop({ required: true, trim: true })
  contentMarkdown!: string;

  @Prop({ enum: ArticleVisibility, default: ArticleVisibility.INTERNAL, index: true })
  visibility!: ArticleVisibility;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ type: Date, default: null })
  publishedAt!: Date | null;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  authorId!: Types.ObjectId | null;
}

export const KnowledgeBaseArticleSchema = SchemaFactory.createForClass(KnowledgeBaseArticle);
KnowledgeBaseArticleSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
KnowledgeBaseArticleSchema.index({ tenantId: 1, visibility: 1, createdAt: -1 });
