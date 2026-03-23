import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument } from '../alerts/alert.schema';
import { Invoice, InvoiceDocument, InvoiceStatus } from '../billing/invoice.schema';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from '../billing/subscription.schema';
import { Client, ClientDocument } from '../clients/client.schema';
import { Contact, ContactDocument } from '../contacts/contact.schema';
import { Device, DeviceDocument } from '../devices/device.schema';
import {
  ScriptExecution,
  ScriptExecutionDocument,
  ScriptExecutionStatus
} from '../script-executions/script-execution.schema';
import { Ticket, TicketDocument, TicketStatus } from '../tickets/ticket.schema';
import { ReportQueryDto } from './dto/report-query.dto';
import { TicketsByPeriodQueryDto } from './dto/tickets-by-period-query.dto';

interface DateRange {
  from: Date;
  to: Date;
}

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(ScriptExecution.name)
    private readonly scriptExecutionModel: Model<ScriptExecutionDocument>,
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>
  ) {}

  async ticketsByPeriod(tenantId: string, query: TicketsByPeriodQueryDto) {
    const range = this.resolveDateRange(query);
    const tenantObjectId = new Types.ObjectId(tenantId);
    const dateFormat = query.groupBy === 'week' ? '%Y-W%V' : '%Y-%m-%d';

    const rows = await this.ticketModel.aggregate([
      {
        $match: {
          tenantId: tenantObjectId,
          createdAt: {
            $gte: range.from,
            $lte: range.to
          }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt', timezone: 'UTC' } },
          total: { $sum: 1 },
          open: {
            $sum: {
              $cond: [{ $in: ['$status', [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED]] }, 1, 0]
            }
          },
          resolved: {
            $sum: {
              $cond: [{ $in: ['$status', [TicketStatus.RESOLVED, TicketStatus.CLOSED]] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      range,
      groupBy: query.groupBy ?? 'day',
      rows: rows.map((row) => ({
        period: row._id,
        total: row.total,
        open: row.open,
        resolved: row.resolved
      }))
    };
  }

  async alertsBySeverity(tenantId: string, query: ReportQueryDto) {
    const range = this.resolveDateRange(query);
    const rows = await this.alertModel.aggregate([
      {
        $match: {
          tenantId: new Types.ObjectId(tenantId),
          createdAt: {
            $gte: range.from,
            $lte: range.to
          }
        }
      },
      {
        $group: {
          _id: '$severity',
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return {
      range,
      rows: rows.map((row) => ({
        severity: row._id,
        total: row.total
      }))
    };
  }

  async assetsByClient(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const [clients, deviceCounts, contactCounts] = await Promise.all([
      this.clientModel.find({ tenantId: tenantObjectId }).sort({ name: 1 }).lean(),
      this.deviceModel.aggregate([
        { $match: { tenantId: tenantObjectId } },
        { $group: { _id: '$clientId', devices: { $sum: 1 } } }
      ]),
      this.contactModel.aggregate([
        { $match: { tenantId: tenantObjectId } },
        { $group: { _id: '$clientId', contacts: { $sum: 1 } } }
      ])
    ]);

    const deviceByClient = new Map(deviceCounts.map((row) => [String(row._id), Number(row.devices ?? 0)]));
    const contactByClient = new Map(contactCounts.map((row) => [String(row._id), Number(row.contacts ?? 0)]));

    const rows = clients.map((client) => ({
      clientId: String(client._id),
      clientName: client.name,
      clientStatus: client.status,
      devices: deviceByClient.get(String(client._id)) ?? 0,
      contacts: contactByClient.get(String(client._id)) ?? 0
    }));

    return {
      rows,
      summary: {
        clients: rows.length,
        devices: rows.reduce((acc, row) => acc + row.devices, 0),
        contacts: rows.reduce((acc, row) => acc + row.contacts, 0)
      }
    };
  }

  async slaCompliance(tenantId: string, query: ReportQueryDto) {
    const range = this.resolveDateRange(query);
    const tickets = await this.ticketModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        createdAt: {
          $gte: range.from,
          $lte: range.to
        }
      })
      .lean();

    let firstResponseMet = 0;
    let firstResponseBreached = 0;
    let resolutionMet = 0;
    let resolutionBreached = 0;

    for (const ticket of tickets) {
      if (ticket.firstResponseDueAt && ticket.firstRespondedAt) {
        if (new Date(ticket.firstRespondedAt).getTime() <= new Date(ticket.firstResponseDueAt).getTime()) {
          firstResponseMet += 1;
        } else {
          firstResponseBreached += 1;
        }
      }

      const finalDate = ticket.closedAt ?? ticket.resolvedAt;
      if (ticket.resolutionDueAt && finalDate) {
        if (new Date(finalDate).getTime() <= new Date(ticket.resolutionDueAt).getTime()) {
          resolutionMet += 1;
        } else {
          resolutionBreached += 1;
        }
      }
    }

    const firstResponseTotal = firstResponseMet + firstResponseBreached;
    const resolutionTotal = resolutionMet + resolutionBreached;

    return {
      range,
      firstResponse: {
        met: firstResponseMet,
        breached: firstResponseBreached,
        compliance:
          firstResponseTotal > 0 ? Number(((firstResponseMet / firstResponseTotal) * 100).toFixed(2)) : 0
      },
      resolution: {
        met: resolutionMet,
        breached: resolutionBreached,
        compliance: resolutionTotal > 0 ? Number(((resolutionMet / resolutionTotal) * 100).toFixed(2)) : 0
      },
      totals: {
        evaluatedTickets: tickets.length
      }
    };
  }

  async scriptExecutionStats(tenantId: string, query: ReportQueryDto) {
    const range = this.resolveDateRange(query);
    const executions = await this.scriptExecutionModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        createdAt: {
          $gte: range.from,
          $lte: range.to
        }
      })
      .lean();

    const byStatus = {
      [ScriptExecutionStatus.QUEUED]: 0,
      [ScriptExecutionStatus.RUNNING]: 0,
      [ScriptExecutionStatus.SUCCESS]: 0,
      [ScriptExecutionStatus.FAILED]: 0
    };

    let durationSum = 0;
    let durationCount = 0;

    for (const execution of executions) {
      byStatus[execution.status] = (byStatus[execution.status] ?? 0) + 1;
      if (execution.startedAt && execution.finishedAt) {
        durationSum += new Date(execution.finishedAt).getTime() - new Date(execution.startedAt).getTime();
        durationCount += 1;
      }
    }

    return {
      range,
      totals: {
        total: executions.length,
        queued: byStatus[ScriptExecutionStatus.QUEUED],
        running: byStatus[ScriptExecutionStatus.RUNNING],
        success: byStatus[ScriptExecutionStatus.SUCCESS],
        failed: byStatus[ScriptExecutionStatus.FAILED],
        avgDurationSeconds:
          durationCount > 0 ? Number((durationSum / durationCount / 1000).toFixed(2)) : 0
      }
    };
  }

  async revenueSummary(tenantId: string, query: ReportQueryDto) {
    const range = this.resolveDateRange(query);
    const [invoices, subscriptions] = await Promise.all([
      this.invoiceModel
        .find({
          tenantId: new Types.ObjectId(tenantId),
          issueDate: {
            $gte: range.from,
            $lte: range.to
          }
        })
        .lean(),
      this.subscriptionModel
        .find({
          tenantId: new Types.ObjectId(tenantId)
        })
        .lean()
    ]);

    let billed = 0;
    let paid = 0;
    let overdue = 0;

    for (const invoice of invoices) {
      billed += invoice.total;
      if (invoice.status === InvoiceStatus.PAID) {
        paid += invoice.total;
      }
      if (invoice.status === InvoiceStatus.OVERDUE) {
        overdue += invoice.total;
      }
    }

    const recurringMonthly = subscriptions
      .filter((subscription) => subscription.status === SubscriptionStatus.ACTIVE)
      .reduce((acc, subscription) => acc + subscription.monthlyPrice, 0);

    return {
      range,
      totals: {
        invoices: invoices.length,
        billed: Number(billed.toFixed(2)),
        paid: Number(paid.toFixed(2)),
        overdue: Number(overdue.toFixed(2)),
        recurringMonthly: Number(recurringMonthly.toFixed(2))
      }
    };
  }

  toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    const csvRows = [
      headers.join(','),
      ...rows.map((row) =>
        headers
          .map((header) => {
            const raw = row[header];
            const value = raw === null || raw === undefined ? '' : String(raw);
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          })
          .join(',')
      )
    ];

    return csvRows.join('\n');
  }

  private resolveDateRange(query: ReportQueryDto): DateRange {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : now;
    return { from, to };
  }
}
