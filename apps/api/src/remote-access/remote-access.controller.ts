import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { CreateRemoteSessionDto } from './dto/create-remote-session.dto';
import { ListRemoteSessionsDto } from './dto/list-remote-sessions.dto';
import { UpdateRemoteSessionInteractionModeDto } from './dto/update-remote-session-interaction-mode.dto';
import { RemoteAccessService } from './remote-access.service';

@ApiTags('remote-access')
@ApiBearerAuth()
@Controller('remote-access')
@TenantScoped()
export class RemoteAccessController {
  constructor(private readonly remoteAccessService: RemoteAccessService) {}

  @Post('sessions')
  @Permissions('remote-access:write')
  @ApiOperation({ summary: 'Request remote access session' })
  async createSession(@CurrentUser() user: AuthUser, @Body() dto: CreateRemoteSessionDto) {
    return this.remoteAccessService.requestSession(String(user.tenantId), user.sub, dto);
  }

  @Get('sessions')
  @Permissions('remote-access:read')
  @ApiOperation({ summary: 'List remote sessions' })
  async listSessions(@CurrentUser() user: AuthUser, @Query() query: ListRemoteSessionsDto) {
    return this.remoteAccessService.list(String(user.tenantId), query);
  }

  @Get('sessions/:sessionId')
  @Permissions('remote-access:read')
  @ApiOperation({ summary: 'Get remote session detail' })
  async detailSession(@CurrentUser() user: AuthUser, @Param('sessionId') sessionId: string) {
    return this.remoteAccessService.findById(String(user.tenantId), sessionId);
  }

  @Post('sessions/:sessionId/start')
  @Permissions('remote-access:write')
  @ApiOperation({ summary: 'Start remote session' })
  async startSession(@CurrentUser() user: AuthUser, @Param('sessionId') sessionId: string) {
    return this.remoteAccessService.startSession(String(user.tenantId), sessionId);
  }

  @Post('sessions/:sessionId/end')
  @Permissions('remote-access:write')
  @ApiOperation({ summary: 'End remote session' })
  async endSession(@CurrentUser() user: AuthUser, @Param('sessionId') sessionId: string) {
    return this.remoteAccessService.endSession(String(user.tenantId), sessionId);
  }

  @Patch('sessions/:sessionId/interaction-mode')
  @Permissions('remote-access:write')
  @ApiOperation({ summary: 'Update remote session interaction mode' })
  async updateInteractionMode(
    @CurrentUser() user: AuthUser,
    @Param('sessionId') sessionId: string,
    @Body() dto: UpdateRemoteSessionInteractionModeDto
  ) {
    return this.remoteAccessService.updateInteractionMode(
      String(user.tenantId),
      user.sub,
      sessionId,
      dto.interactionMode
    );
  }
}
