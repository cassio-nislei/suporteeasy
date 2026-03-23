import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { ArticleVisibility } from '../knowledge-base-article.schema';

export class ListKnowledgeBaseArticlesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ArticleVisibility })
  @IsOptional()
  @IsIn([ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL])
  visibility?: ArticleVisibility;

  @ApiPropertyOptional({ default: 'updatedAt', enum: ['updatedAt', 'title', 'publishedAt'] })
  @IsOptional()
  @IsIn(['updatedAt', 'title', 'publishedAt'])
  sortBy?: 'updatedAt' | 'title' | 'publishedAt' = 'updatedAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
