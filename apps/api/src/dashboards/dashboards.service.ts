import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Alert, AlertDocument, AlertStatus } from '../alerts/alert.schema';
import { AlertSeverity } from '../alerts/alert-rule.schema';
import { AutomationLog, AutomationLogDocument, AutomationLogStatus } from '../automations/automation-log.schema';
import { Client, ClientDocument } from '../clients/client.schema';
import { Contact, ContactDocument } from '../contacts/contact.schema';
import { Device, DeviceDocument, DeviceOnlineStatus } from '../devices/device.schema';
import { Metric, MetricDocument } from '../monitoring/metric.schema';
import { ScriptExecution, ScriptExecutionDocument, ScriptExecutionStatus } from '../script-executions/script-execution.schema';
import { Ticket, TicketDocument, TicketStatus } from '../tickets/ticket.schema';

@Injectable()
export class DashboardsService {
  constructor(
    @InjectModel(Client.name)
    private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Metric.name)
    private readonly metricModel: Model<MetricDocument>,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
    @InjectModel(Ticket.name)
    private readonly ticketModel: Model<TicketDocument>,
    @InjectModel(ScriptExecution.name)
    private readonly scriptExecutionModel: Model<ScriptExecutionDocument>,
    @InjectModel(AutomationLog.name)
    private readonly automationLogModel: Model<AutomationLogDocument>
  ) {}

  async overview(tenantId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const now = new Date();
    const riskWindow = new Date(now.getTime() + 60 * 60 * 1000);
    const activeTicketStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.REOPENED];
    const openAlertStatuses = [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED];
    const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      clientCount,
      contactCount,
      deviceTotal,
      deviceOnline,
      deviceOffline,
      latestMetrics,
      openTickets,
      criticalAlerts,
      slaAtRisk,
      slaBreached,
      scriptsQueued,
      scriptsRunning,
      scriptsFailed,
      scriptsLast24h,
      automationsTotal,
      automationsFailed
    ] = await Promise.all([
      this.clientModel.countDocuments({ tenantId: tenantObjectId }),
      this.contactModel.countDocuments({ tenantId: tenantObjectId }),
      this.deviceModel.countDocuments({ tenantId: tenantObjectId }),
      this.deviceModel.countDocuments({ tenantId: tenantObjectId, onlineStatus: DeviceOnlineStatus.ONLINE }),
      this.deviceModel.countDocuments({ tenantId: tenantObjectId, onlineStatus: DeviceOnlineStatus.OFFLINE }),
      this.metricModel
        .find({ tenantId: tenantObjectId })
        .sort({ timestamp: -1 })
        .limit(12)
        .lean(),
      this.ticketModel.countDocuments({
        tenantId: tenantObjectId,
        status: { $in: activeTicketStatuses }
      }),
      this.alertModel.countDocuments({
        tenantId: tenantObjectId,
        severity: AlertSeverity.CRITICAL,
        status: { $in: openAlertStatuses }
      }),
      this.ticketModel.countDocuments({
        tenantId: tenantObjectId,
        status: { $in: activeTicketStatuses },
        resolutionDueAt: {
          $gte: now,
          $lte: riskWindow
        }
      }),
      this.ticketModel.countDocuments({
        tenantId: tenantObjectId,
        status: { $in: activeTicketStatuses },
        resolutionDueAt: {
          $lt: now
        }
      }),
      this.scriptExecutionModel.countDocuments({
        tenantId: tenantObjectId,
        status: ScriptExecutionStatus.QUEUED
      }),
      this.scriptExecutionModel.countDocuments({
        tenantId: tenantObjectId,
        status: ScriptExecutionStatus.RUNNING
      }),
      this.scriptExecutionModel.countDocuments({
        tenantId: tenantObjectId,
        status: ScriptExecutionStatus.FAILED
      }),
      this.scriptExecutionModel.countDocuments({
        tenantId: tenantObjectId,
        createdAt: { $gte: last24Hours }
      }),
      this.automationLogModel.countDocuments({
        tenantId: tenantObjectId,
        createdAt: { $gte: last24Hours }
      }),
      this.automationLogModel.countDocuments({
        tenantId: tenantObjectId,
        createdAt: { $gte: last24Hours },
        status: AutomationLogStatus.FAILED
      })
    ]);

    return {
      counts: {
        clients: clientCount,
        contacts: contactCount,
        devices: {
          total: deviceTotal,
          online: deviceOnline,
          offline: deviceOffline,
          unknown: Math.max(0, deviceTotal - deviceOnline - deviceOffline)
        },
        tickets: {
          open: openTickets
        },
        alerts: {
          criticalOpen: criticalAlerts
        },
        sla: {
          atRisk: slaAtRisk,
          breached: slaBreached
        },
        scripts: {
          queued: scriptsQueued,
          running: scriptsRunning,
          failed: scriptsFailed,
          last24h: scriptsLast24h
        },
        automations: {
          runsLast24h: automationsTotal,
          failedLast24h: automationsFailed
        }
      },
      latestMetrics
    };
  }
}
