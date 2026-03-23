import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ArticleVisibility } from '../knowledge-base-article.schema';

export class CreateKnowledgeBaseArticleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(180)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(180)
  slug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  summary?: string;

  @ApiProperty({
    description: 'Markdown content'
  })
  @IsString()
  contentMarkdown!: string;

  @ApiPropertyOptional({ enum: ArticleVisibility, default: ArticleVisibility.INTERNAL })
  @IsOptional()
  @IsIn([ArticleVisibility.PUBLIC, ArticleVisibility.INTERNAL])
  visibility?: ArticleVisibility = ArticleVisibility.INTERNAL;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @Type(() => String)
  @IsString({ each: true })
  tags?: string[] = [];

  @ApiPropertyOptional({
    description: 'Set publication date. If omitted and visibility=public, service can set now.'
  })
  @IsOptional()
  @IsDateString()
  publishedAt?: string;
}
