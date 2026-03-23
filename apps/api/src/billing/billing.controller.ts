import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { MonthlySummaryDto } from './dto/monthly-summary.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@ApiTags('billing')
@ApiBearerAuth()
@Controller('billing')
@TenantScoped()
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  @Permissions('billing:write')
  @ApiOperation({ summary: 'Create invoice' })
  async createInvoice(@CurrentUser() user: AuthUser, @Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(String(user.tenantId), dto);
  }

  @Get('invoices')
  @Permissions('billing:read')
  @ApiOperation({ summary: 'List invoices' })
  async listInvoices(@CurrentUser() user: AuthUser, @Query() query: ListInvoicesDto) {
    return this.billingService.listInvoices(String(user.tenantId), query);
  }

  @Get('invoices/:invoiceId')
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Get invoice detail' })
  async detailInvoice(@CurrentUser() user: AuthUser, @Param('invoiceId') invoiceId: string) {
    return this.billingService.findInvoiceById(String(user.tenantId), invoiceId);
  }

  @Patch('invoices/:invoiceId')
  @Permissions('billing:write')
  @ApiOperation({ summary: 'Update invoice' })
  async updateInvoice(
    @CurrentUser() user: AuthUser,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceDto
  ) {
    return this.billingService.updateInvoice(String(user.tenantId), invoiceId, dto);
  }

  @Post('subscriptions')
  @Permissions('billing:write')
  @ApiOperation({ summary: 'Create subscription' })
  async createSubscription(@CurrentUser() user: AuthUser, @Body() dto: CreateSubscriptionDto) {
    return this.billingService.createSubscription(String(user.tenantId), dto);
  }

  @Get('subscriptions')
  @Permissions('billing:read')
  @ApiOperation({ summary: 'List subscriptions' })
  async listSubscriptions(@CurrentUser() user: AuthUser, @Query() query: ListSubscriptionsDto) {
    return this.billingService.listSubscriptions(String(user.tenantId), query);
  }

  @Get('subscriptions/:subscriptionId')
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Get subscription detail' })
  async detailSubscription(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId') subscriptionId: string
  ) {
    return this.billingService.findSubscriptionById(String(user.tenantId), subscriptionId);
  }

  @Patch('subscriptions/:subscriptionId')
  @Permissions('billing:write')
  @ApiOperation({ summary: 'Update subscription' })
  async updateSubscription(
    @CurrentUser() user: AuthUser,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto
  ) {
    return this.billingService.updateSubscription(String(user.tenantId), subscriptionId, dto);
  }

  @Get('summary/monthly')
  @Permissions('billing:read')
  @ApiOperation({ summary: 'Monthly billing summary' })
  async monthlySummary(@CurrentUser() user: AuthUser, @Query() query: MonthlySummaryDto) {
    return this.billingService.monthlySummary(String(user.tenantId), query);
  }
}
