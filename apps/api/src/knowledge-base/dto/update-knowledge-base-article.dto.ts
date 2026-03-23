import { PartialType } from '@nestjs/swagger';
import { CreateKnowledgeBaseArticleDto } from './create-knowledge-base-article.dto';

export class UpdateKnowledgeBaseArticleDto extends PartialType(CreateKnowledgeBaseArticleDto) {}
