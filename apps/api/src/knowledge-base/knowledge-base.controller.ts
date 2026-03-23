import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateKnowledgeBaseArticleDto } from './dto/create-knowledge-base-article.dto';
import { ListKnowledgeBaseArticlesDto } from './dto/list-knowledge-base-articles.dto';
import { UpdateKnowledgeBaseArticleDto } from './dto/update-knowledge-base-article.dto';
import { KnowledgeBaseService } from './knowledge-base.service';

@ApiTags('knowledge-base')
@ApiBearerAuth()
@Controller('knowledge-base/articles')
@TenantScoped()
export class KnowledgeBaseController {
  constructor(private readonly knowledgeBaseService: KnowledgeBaseService) {}

  @Post()
  @Permissions('knowledge-base:write')
  @ApiOperation({ summary: 'Create knowledge base article' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateKnowledgeBaseArticleDto) {
    return this.knowledgeBaseService.create(String(user.tenantId), user.sub, dto);
  }

  @Get()
  @Permissions('knowledge-base:read')
  @ApiOperation({ summary: 'List knowledge base articles' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListKnowledgeBaseArticlesDto) {
    return this.knowledgeBaseService.list(String(user.tenantId), query);
  }

  @Get(':articleId')
  @Permissions('knowledge-base:read')
  @ApiOperation({ summary: 'Get knowledge base article detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('articleId') articleId: string) {
    return this.knowledgeBaseService.findById(String(user.tenantId), articleId);
  }

  @Patch(':articleId')
  @Permissions('knowledge-base:write')
  @ApiOperation({ summary: 'Update knowledge base article' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('articleId') articleId: string,
    @Body() dto: UpdateKnowledgeBaseArticleDto
  ) {
    return this.knowledgeBaseService.update(String(user.tenantId), articleId, dto);
  }

  @Delete(':articleId')
  @Permissions('knowledge-base:write')
  @ApiOperation({ summary: 'Delete knowledge base article' })
  async remove(@CurrentUser() user: AuthUser, @Param('articleId') articleId: string) {
    return this.knowledgeBaseService.remove(String(user.tenantId), articleId);
  }
}
