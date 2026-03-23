import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CreateKnowledgeBaseArticleDto } from './dto/create-knowledge-base-article.dto';
import { ListKnowledgeBaseArticlesDto } from './dto/list-knowledge-base-articles.dto';
import { UpdateKnowledgeBaseArticleDto } from './dto/update-knowledge-base-article.dto';
import {
  ArticleVisibility,
  KnowledgeBaseArticle,
  KnowledgeBaseArticleDocument
} from './knowledge-base-article.schema';

@Injectable()
export class KnowledgeBaseService {
  constructor(
    @InjectModel(KnowledgeBaseArticle.name)
    private readonly articleModel: Model<KnowledgeBaseArticleDocument>
  ) {}

  async create(tenantId: string, authorId: string, dto: CreateKnowledgeBaseArticleDto) {
    const visibility = dto.visibility ?? ArticleVisibility.INTERNAL;
    const created = await this.articleModel.create({
      tenantId: new Types.ObjectId(tenantId),
      authorId: new Types.ObjectId(authorId),
      title: dto.title.trim(),
      slug: this.normalizeSlug(dto.slug ?? dto.title),
      summary: dto.summary?.trim() ?? '',
      contentMarkdown: dto.contentMarkdown,
      visibility,
      tags: this.normalizeTags(dto.tags ?? []),
      publishedAt:
        dto.publishedAt !== undefined
          ? new Date(dto.publishedAt)
          : visibility === ArticleVisibility.PUBLIC
            ? new Date()
            : null
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListKnowledgeBaseArticlesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'updatedAt';

    const filter: FilterQuery<KnowledgeBaseArticleDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.visibility) {
      filter.visibility = query.visibility;
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { summary: { $regex: query.search, $options: 'i' } },
        { tags: { $elemMatch: { $regex: query.search, $options: 'i' } } }
      ];
    }

    const [items, total] = await Promise.all([
      this.articleModel
        .find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.articleModel.countDocuments(filter)
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit))
      }
    };
  }

  async findById(tenantId: string, articleId: string) {
    const article = await this.articleModel
      .findOne({
        _id: new Types.ObjectId(articleId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!article) {
      throw new NotFoundException('Knowledge base article not found');
    }

    return article;
  }

  async update(tenantId: string, articleId: string, dto: UpdateKnowledgeBaseArticleDto) {
    const current = await this.articleModel
      .findOne({
        _id: new Types.ObjectId(articleId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!current) {
      throw new NotFoundException('Knowledge base article not found');
    }

    const nextTitle = dto.title?.trim() ?? current.title;
    const nextVisibility = dto.visibility ?? current.visibility;

    const updated = await this.articleModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(articleId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.title !== undefined ? { title: nextTitle } : {}),
            ...(dto.slug !== undefined || dto.title !== undefined
              ? { slug: this.normalizeSlug(dto.slug ?? nextTitle) }
              : {}),
            ...(dto.summary !== undefined ? { summary: dto.summary.trim() } : {}),
            ...(dto.contentMarkdown !== undefined ? { contentMarkdown: dto.contentMarkdown } : {}),
            ...(dto.visibility !== undefined ? { visibility: nextVisibility } : {}),
            ...(dto.tags !== undefined ? { tags: this.normalizeTags(dto.tags) } : {}),
            ...(dto.publishedAt !== undefined
              ? { publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : null }
              : dto.visibility === ArticleVisibility.PUBLIC && !current.publishedAt
                ? { publishedAt: new Date() }
                : {})
          }
        },
        {
          new: true
        }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Knowledge base article not found');
    }

    return updated;
  }

  async remove(tenantId: string, articleId: string) {
    const result = await this.articleModel.deleteOne({
      _id: new Types.ObjectId(articleId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return {
      deleted: result.deletedCount > 0
    };
  }

  private normalizeSlug(raw: string): string {
    const slug = raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180);

    return slug || `article-${Date.now()}`;
  }

  private normalizeTags(tags: string[]): string[] {
    return [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))];
  }
}
