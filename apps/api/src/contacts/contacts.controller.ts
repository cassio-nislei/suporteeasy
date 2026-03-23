import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@ApiTags('contacts')
@ApiBearerAuth()
@Controller('contacts')
@TenantScoped()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Post()
  @Permissions('contacts:write')
  @ApiOperation({ summary: 'Create contact' })
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateContactDto) {
    return this.contactsService.create(String(user.tenantId), dto);
  }

  @Get()
  @Permissions('contacts:read')
  @ApiOperation({ summary: 'List contacts with pagination/filter/sort' })
  async list(@CurrentUser() user: AuthUser, @Query() query: ListContactsDto) {
    return this.contactsService.list(String(user.tenantId), query);
  }

  @Get(':contactId')
  @Permissions('contacts:read')
  @ApiOperation({ summary: 'Get contact detail' })
  async detail(@CurrentUser() user: AuthUser, @Param('contactId') contactId: string) {
    return this.contactsService.findById(String(user.tenantId), contactId);
  }

  @Patch(':contactId')
  @Permissions('contacts:write')
  @ApiOperation({ summary: 'Update contact' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto
  ) {
    return this.contactsService.update(String(user.tenantId), contactId, dto);
  }

  @Delete(':contactId')
  @Permissions('contacts:write')
  @ApiOperation({ summary: 'Delete contact' })
  async remove(@CurrentUser() user: AuthUser, @Param('contactId') contactId: string) {
    return this.contactsService.remove(String(user.tenantId), contactId);
  }
}
