import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { KnowledgeBaseController } from './knowledge-base.controller';
import {
  KnowledgeBaseArticle,
  KnowledgeBaseArticleSchema
} from './knowledge-base-article.schema';
import { KnowledgeBaseService } from './knowledge-base.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: KnowledgeBaseArticle.name, schema: KnowledgeBaseArticleSchema }])
  ],
  controllers: [KnowledgeBaseController],
  providers: [KnowledgeBaseService],
  exports: [KnowledgeBaseService, MongooseModule]
})
export class KnowledgeBaseModule {}
