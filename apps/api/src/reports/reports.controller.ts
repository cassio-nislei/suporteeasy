import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { TenantScoped } from '../common/decorators/tenant-scoped.decorator';
import { AuthUser } from '../common/interfaces/auth-user.interface';
import { ReportQueryDto } from './dto/report-query.dto';
import { TicketsByPeriodQueryDto } from './dto/tickets-by-period-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller('reports')
@TenantScoped()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('tickets-by-period')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Tickets by period report' })
  async ticketsByPeriod(
    @CurrentUser() user: AuthUser,
    @Query() query: TicketsByPeriodQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.ticketsByPeriod(String(user.tenantId), query);
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="tickets-by-period.csv"');
      return this.reportsService.toCsv(report.rows);
    }

    return report;
  }

  @Get('alerts-by-severity')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Alerts by severity report' })
  async alertsBySeverity(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.alertsBySeverity(String(user.tenantId), query);
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="alerts-by-severity.csv"');
      return this.reportsService.toCsv(report.rows);
    }

    return report;
  }

  @Get('assets-by-client')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Assets by client report' })
  async assetsByClient(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.assetsByClient(String(user.tenantId));
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="assets-by-client.csv"');
      return this.reportsService.toCsv(report.rows);
    }

    return report;
  }

  @Get('sla-compliance')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'SLA compliance report' })
  async slaCompliance(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.slaCompliance(String(user.tenantId), query);
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="sla-compliance.csv"');
      return this.reportsService.toCsv([
        {
          metric: 'first_response',
          met: report.firstResponse.met,
          breached: report.firstResponse.breached,
          compliance: report.firstResponse.compliance
        },
        {
          metric: 'resolution',
          met: report.resolution.met,
          breached: report.resolution.breached,
          compliance: report.resolution.compliance
        }
      ]);
    }

    return report;
  }

  @Get('script-execution-stats')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Script execution report' })
  async scriptExecutionStats(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.scriptExecutionStats(String(user.tenantId), query);
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="script-execution-stats.csv"');
      return this.reportsService.toCsv([report.totals]);
    }

    return report;
  }

  @Get('revenue-summary')
  @Permissions('reports:read')
  @ApiOperation({ summary: 'Revenue summary report' })
  async revenueSummary(
    @CurrentUser() user: AuthUser,
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const report = await this.reportsService.revenueSummary(String(user.tenantId), query);
    if (query.format === 'csv') {
      response.setHeader('Content-Type', 'text/csv; charset=utf-8');
      response.setHeader('Content-Disposition', 'attachment; filename="revenue-summary.csv"');
      return this.reportsService.toCsv([report.totals]);
    }

    return report;
  }
}
