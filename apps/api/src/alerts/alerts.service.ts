import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { FilterQuery, Model, Types } from 'mongoose';
import { DevicesService } from '../devices/devices.service';
import { AUTOMATION_JOB_TRIGGER, AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketSource } from '../tickets/ticket.schema';
import { TicketsService } from '../tickets/tickets.service';
import {
  AlertConditionOperator,
  AlertRule,
  AlertRuleDocument,
  AlertRuleTargetType,
  AlertSeverity
} from './alert-rule.schema';
import { Alert, AlertDocument, AlertStatus } from './alert.schema';
import { CreateAlertRuleDto } from './dto/create-alert-rule.dto';
import { ListAlertsDto } from './dto/list-alerts.dto';
import { ListAlertRulesDto } from './dto/list-alert-rules.dto';
import { UpdateAlertRuleDto } from './dto/update-alert-rule.dto';

interface MetricSnapshot {
  type: string;
  value: number;
  unit: string;
  timestamp: Date;
}

interface DeviceSnapshot {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  hostname: string;
  clientId?: Types.ObjectId | null;
}

@Injectable()
export class AlertsService {
  private readonly logger = new Logger(AlertsService.name);

  constructor(
    @InjectModel(AlertRule.name)
    private readonly alertRuleModel: Model<AlertRuleDocument>,
    @InjectModel(Alert.name)
    private readonly alertModel: Model<AlertDocument>,
    private readonly devicesService: DevicesService,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue?: Queue
  ) {}

  async createRule(tenantId: string, dto: CreateAlertRuleDto): Promise<AlertRule> {
    this.ensureRuleConditions(dto.targetType, {
      metricType: dto.conditions.metricType,
      operator: dto.conditions.operator,
      threshold: dto.conditions.threshold,
      status: dto.conditions.status
    });

    const created = await this.alertRuleModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      targetType: dto.targetType,
      conditions: {
        metricType: dto.conditions.metricType ?? null,
        operator: dto.conditions.operator ?? null,
        threshold: dto.conditions.threshold ?? null,
        status: dto.conditions.status ?? null
      },
      severity: dto.severity,
      cooldown: dto.cooldown ?? 0,
      enabled: dto.enabled ?? true,
      autoCreateTicket: dto.autoCreateTicket ?? false
    });

    return created.toObject();
  }

  async listRules(tenantId: string, query: ListAlertRulesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<AlertRuleDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.targetType) {
      filter.targetType = query.targetType;
    }

    if (query.enabled !== undefined) {
      filter.enabled = query.enabled;
    }

    if (query.search) {
      filter.$or = [{ name: { $regex: query.search, $options: 'i' } }];
    }

    const [items, total] = await Promise.all([
      this.alertRuleModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.alertRuleModel.countDocuments(filter)
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

  async findRuleById(tenantId: string, ruleId: string): Promise<AlertRule> {
    const rule = await this.alertRuleModel
      .findOne({
        _id: new Types.ObjectId(ruleId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!rule) {
      throw new NotFoundException('Alert rule not found');
    }

    return rule;
  }

  async updateRule(tenantId: string, ruleId: string, dto: UpdateAlertRuleDto): Promise<AlertRule> {
    const existing = await this.alertRuleModel.findOne({
      _id: new Types.ObjectId(ruleId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (!existing) {
      throw new NotFoundException('Alert rule not found');
    }

    const mergedTargetType = dto.targetType ?? existing.targetType;
    const mergedConditions = {
      metricType: dto.conditions?.metricType ?? existing.conditions.metricType,
      operator: dto.conditions?.operator ?? existing.conditions.operator,
      threshold: dto.conditions?.threshold ?? existing.conditions.threshold,
      status: dto.conditions?.status ?? existing.conditions.status
    };

    this.ensureRuleConditions(mergedTargetType, mergedConditions);

    existing.set({
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.targetType !== undefined ? { targetType: dto.targetType } : {}),
      ...(dto.conditions !== undefined ? { conditions: mergedConditions } : {}),
      ...(dto.severity !== undefined ? { severity: dto.severity } : {}),
      ...(dto.cooldown !== undefined ? { cooldown: dto.cooldown } : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
      ...(dto.autoCreateTicket !== undefined ? { autoCreateTicket: dto.autoCreateTicket } : {})
    });

    await existing.save();
    return existing.toObject();
  }

  async removeRule(tenantId: string, ruleId: string): Promise<{ deleted: boolean }> {
    const result = await this.alertRuleModel.deleteOne({
      _id: new Types.ObjectId(ruleId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }

  async listAlerts(tenantId: string, query: ListAlertsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const filter: FilterQuery<AlertDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.deviceId) {
      filter.deviceId = new Types.ObjectId(query.deviceId);
    }

    if (query.severity) {
      filter.severity = query.severity;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [
        { title: { $regex: query.search, $options: 'i' } },
        { message: { $regex: query.search, $options: 'i' } }
      ];
    }

    const [items, total] = await Promise.all([
      this.alertModel
        .find(filter)
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus clientId' })
        .populate({ path: 'alertRuleId', select: 'name targetType severity' })
        .populate({ path: 'ticketId', select: 'subject status priority assigneeId' })
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.alertModel.countDocuments(filter)
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

  async findAlertById(tenantId: string, alertId: string): Promise<Alert> {
    const alert = await this.alertModel
      .findOne({
        _id: new Types.ObjectId(alertId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus clientId' })
      .populate({ path: 'alertRuleId', select: 'name targetType severity conditions' })
      .populate({ path: 'ticketId', select: 'subject status priority assigneeId createdAt' })
      .lean();

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  async acknowledgeAlert(tenantId: string, alertId: string, actorUserId: string): Promise<Alert> {
    const alert = await this.findAlertDocument(tenantId, alertId);

    if (alert.status === AlertStatus.RESOLVED) {
      throw new BadRequestException('Resolved alerts cannot be acknowledged');
    }

    if (alert.status !== AlertStatus.ACKNOWLEDGED) {
      alert.status = AlertStatus.ACKNOWLEDGED;
      alert.acknowledgedBy = new Types.ObjectId(actorUserId);
      alert.timeline.push(
        this.buildTimelineEntry({
          type: 'acknowledged',
          message: 'Alert acknowledged',
          actorId: actorUserId
        }) as any
      );
      await alert.save();
    }

    return alert.toObject();
  }

  async resolveAlert(tenantId: string, alertId: string, actorUserId: string): Promise<Alert> {
    const alert = await this.findAlertDocument(tenantId, alertId);

    if (alert.status !== AlertStatus.RESOLVED) {
      alert.status = AlertStatus.RESOLVED;
      alert.resolvedAt = new Date();
      alert.timeline.push(
        this.buildTimelineEntry({
          type: 'resolved',
          message: 'Alert resolved',
          actorId: actorUserId
        }) as any
      );
      await alert.save();
    }

    return alert.toObject();
  }

  async createTicketFromAlert(tenantId: string, alertId: string, actorUserId: string) {
    const alert = await this.findAlertDocument(tenantId, alertId);

    if (alert.ticketId) {
      const existing = await this.ticketsService.findById(tenantId, String(alert.ticketId));
      return {
        created: false,
        ticket: existing
      };
    }

    const ticket = (await this.ticketsService.createFromAlert({
      tenantId,
      alertId: String(alert._id),
      deviceId: String(alert.deviceId),
      severity: alert.severity,
      source: TicketSource.ALERT,
      subject: `Alert: ${alert.title}`,
      description: alert.message,
      actorUserId
    })) as any;
    const ticketId = String(ticket._id);

    alert.ticketId = new Types.ObjectId(ticketId);
    alert.timeline.push(
      this.buildTimelineEntry({
        type: 'ticket-created',
        message: `Ticket created from alert by ${actorUserId}`,
        actorId: actorUserId,
        metadata: {
          ticketId
        }
      }) as any
    );
    await alert.save();

    return {
      created: true,
      ticket
    };
  }

  async evaluateMetrics(tenantId: string, deviceId: string, metrics: MetricSnapshot[]): Promise<void> {
    if (metrics.length === 0) {
      return;
    }

    const device = await this.devicesService.findByIdForAgent(deviceId);
    if (!device || String(device.tenantId) !== tenantId) {
      return;
    }

    const rules = await this.alertRuleModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        enabled: true,
        targetType: AlertRuleTargetType.METRIC
      })
      .lean();

    for (const rule of rules) {
      if (!rule.conditions.metricType || !rule.conditions.operator || rule.conditions.threshold === null) {
        continue;
      }

      const metric = [...metrics]
        .filter((item) => item.type === rule.conditions.metricType)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!metric) {
        continue;
      }

      const matched = this.matchesOperator(
        metric.value,
        rule.conditions.operator,
        Number(rule.conditions.threshold)
      );

      if (!matched) {
        continue;
      }

      await this.triggerAlertForRule(
        rule,
        {
          _id: device._id,
          tenantId: device.tenantId,
          hostname: device.hostname,
          clientId: device.clientId ?? null
        },
        {
          title: `${rule.conditions.metricType.toUpperCase()} threshold breached`,
          message: `Metric ${rule.conditions.metricType}=${metric.value}${metric.unit} matched rule ${rule.name}`,
          triggeredValue: metric.value,
          metadata: {
            metricType: metric.type,
            operator: rule.conditions.operator,
            threshold: rule.conditions.threshold,
            unit: metric.unit,
            timestamp: metric.timestamp.toISOString()
          }
        }
      );
    }
  }

  async evaluateDeviceStatus(
    tenantId: string,
    deviceId: string,
    status: 'online' | 'offline' | 'unknown',
    source: 'heartbeat' | 'reconcile' = 'heartbeat'
  ): Promise<void> {
    const device = await this.devicesService.findByIdForAgent(deviceId);
    if (!device || String(device.tenantId) !== tenantId) {
      return;
    }

    const rules = await this.alertRuleModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        enabled: true,
        targetType: AlertRuleTargetType.DEVICE_STATUS,
        'conditions.status': status
      })
      .lean();

    for (const rule of rules) {
      await this.triggerAlertForRule(
        rule,
        {
          _id: device._id,
          tenantId: device.tenantId,
          hostname: device.hostname,
          clientId: device.clientId ?? null
        },
        {
          title: `Device ${status}`,
          message: `Device ${device.hostname} is ${status} (${source})`,
          metadata: {
            status,
            source
          }
        }
      );
    }
  }

  private async triggerAlertForRule(
    rule: AlertRule,
    device: DeviceSnapshot,
    payload: {
      title: string;
      message: string;
      triggeredValue?: number;
      metadata?: Record<string, unknown>;
    }
  ): Promise<Alert | null> {
    const tenantId = String(device.tenantId);
    const tenantObjectId = new Types.ObjectId(String(device.tenantId));
    const deviceObjectId = new Types.ObjectId(String(device._id));
    const ruleObjectId = new Types.ObjectId(String(rule._id));

    const existingOpen = await this.alertModel.findOne({
      tenantId: tenantObjectId,
      deviceId: deviceObjectId,
      alertRuleId: ruleObjectId,
      status: { $in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] }
    });

    if (existingOpen) {
      existingOpen.status = AlertStatus.OPEN;
      existingOpen.message = payload.message;
      existingOpen.triggeredValue = payload.triggeredValue ?? null;
      existingOpen.timeline.push(
        this.buildTimelineEntry({
          type: 'retriggered',
          message: `Alert retriggered: ${payload.message}`,
          metadata: payload.metadata
        }) as any
      );
      await existingOpen.save();
      return existingOpen.toObject();
    }

    const latestAlert = await this.alertModel
      .findOne({
        tenantId: tenantObjectId,
        deviceId: deviceObjectId,
        alertRuleId: ruleObjectId
      })
      .sort({ createdAt: -1 })
      .lean();

    const cooldownMs = Math.max(0, Number(rule.cooldown ?? 0)) * 60 * 1000;
    if (latestAlert && cooldownMs > 0) {
      const elapsed = Date.now() - new Date((latestAlert as any).createdAt as Date).getTime();
      if (elapsed < cooldownMs) {
        return null;
      }
    }

    const created = await this.alertModel.create({
      tenantId: tenantObjectId,
      deviceId: deviceObjectId,
      alertRuleId: ruleObjectId,
      severity: rule.severity,
      status: AlertStatus.OPEN,
      title: payload.title,
      message: payload.message,
      triggeredValue: payload.triggeredValue ?? null,
      timeline: [
        this.buildTimelineEntry({
          type: 'created',
          message: payload.message,
          metadata: payload.metadata
        })
      ]
    });

    await this.notificationsService.notifyTenantUsers(tenantId, {
      type: NotificationType.ALERT_CREATED,
      title: `[${rule.severity.toUpperCase()}] ${payload.title}`,
      body: `${device.hostname} - ${payload.message}`,
      metadata: {
        alertId: String(created._id),
        deviceId: String(device._id),
        severity: rule.severity
      }
    });

    if (this.automationQueue) {
      await this.automationQueue.add(
        AUTOMATION_JOB_TRIGGER,
        {
          tenantId,
          trigger: 'alert_created',
          context: {
            alertId: String(created._id),
            alertRuleId: String(rule._id),
            deviceId: String(device._id),
            clientId: device.clientId ? String(device.clientId) : null,
            severity: created.severity,
            title: created.title,
            message: created.message
          }
        },
        {
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3
        }
      );
    }

    const shouldAutoCreateTicket = rule.autoCreateTicket || rule.severity === AlertSeverity.CRITICAL;
    if (shouldAutoCreateTicket) {
      try {
        const ticket = (await this.ticketsService.createFromAlert({
          tenantId,
          alertId: String(created._id),
          deviceId: String(device._id),
          clientId: device.clientId ? String(device.clientId) : null,
          severity: created.severity,
          source: TicketSource.AUTOMATION,
          subject: `Alert: ${created.title}`,
          description: created.message,
          actorUserId: null
        })) as any;
        const ticketId = String(ticket._id);

        created.ticketId = new Types.ObjectId(ticketId);
        created.timeline.push(
          this.buildTimelineEntry({
            type: 'ticket-created',
            message: 'Ticket automatically created from alert rule',
            metadata: {
              ticketId,
              source: 'automation'
            }
          }) as any
        );
        await created.save();
      } catch (error) {
        this.logger.warn(
          `Failed auto ticket creation for alert ${String(created._id)}: ${(error as Error).message}`
        );
      }
    }

    return created.toObject();
  }

  private async findAlertDocument(tenantId: string, alertId: string): Promise<AlertDocument> {
    const alert = await this.alertModel.findOne({
      _id: new Types.ObjectId(alertId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (!alert) {
      throw new NotFoundException('Alert not found');
    }

    return alert;
  }

  private ensureRuleConditions(
    targetType: AlertRuleTargetType,
    conditions: {
      metricType?: string | null;
      operator?: AlertConditionOperator | null;
      threshold?: number | null;
      status?: string | null;
    }
  ): void {
    if (targetType === AlertRuleTargetType.METRIC) {
      if (
        !conditions.metricType ||
        !conditions.operator ||
        conditions.threshold === null ||
        conditions.threshold === undefined
      ) {
        throw new BadRequestException(
          'Metric rules require conditions.metricType, conditions.operator, and conditions.threshold'
        );
      }
      return;
    }

    if (targetType === AlertRuleTargetType.DEVICE_STATUS && !conditions.status) {
      throw new BadRequestException('Device status rules require conditions.status');
    }
  }

  private matchesOperator(value: number, operator: AlertConditionOperator, threshold: number): boolean {
    switch (operator) {
      case AlertConditionOperator.GT:
        return value > threshold;
      case AlertConditionOperator.GTE:
        return value >= threshold;
      case AlertConditionOperator.LT:
        return value < threshold;
      case AlertConditionOperator.LTE:
        return value <= threshold;
      case AlertConditionOperator.EQ:
        return value === threshold;
      case AlertConditionOperator.NEQ:
        return value !== threshold;
      default:
        return false;
    }
  }

  private buildTimelineEntry(input: {
    type: string;
    message: string;
    actorId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    return {
      type: input.type,
      message: input.message,
      actorId: input.actorId ? new Types.ObjectId(input.actorId) : null,
      occurredAt: new Date(),
      metadata: input.metadata ?? {}
    };
  }
}
