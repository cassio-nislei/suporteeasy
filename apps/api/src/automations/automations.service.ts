import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { DevicesService } from '../devices/devices.service';
import { MonitoringService } from '../monitoring/monitoring.service';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ScriptExecutionsService } from '../script-executions/script-executions.service';
import { TicketPriority, TicketSource } from '../tickets/ticket.schema';
import { TicketsService } from '../tickets/tickets.service';
import {
  Automation,
  AutomationActionType,
  AutomationDocument,
  AutomationTrigger
} from './automation.schema';
import {
  AutomationLog,
  AutomationLogDocument,
  AutomationLogStatus
} from './automation-log.schema';
import { CreateAutomationDto } from './dto/create-automation.dto';
import { ListAutomationLogsDto } from './dto/list-automation-logs.dto';
import { ListAutomationsDto } from './dto/list-automations.dto';
import { UpdateAutomationDto } from './dto/update-automation.dto';

export interface AutomationTriggerJobPayload {
  tenantId: string;
  trigger: AutomationTrigger;
  context: Record<string, unknown>;
}

@Injectable()
export class AutomationsService {
  constructor(
    @InjectModel(Automation.name)
    private readonly automationModel: Model<AutomationDocument>,
    @InjectModel(AutomationLog.name)
    private readonly automationLogModel: Model<AutomationLogDocument>,
    private readonly ticketsService: TicketsService,
    private readonly notificationsService: NotificationsService,
    private readonly scriptExecutionsService: ScriptExecutionsService,
    private readonly devicesService: DevicesService,
    private readonly monitoringService: MonitoringService,
    private readonly auditService: AuditService
  ) {}

  async create(tenantId: string, dto: CreateAutomationDto): Promise<Automation> {
    const created = await this.automationModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name,
      trigger: dto.trigger,
      conditions: dto.conditions ?? {},
      actions: dto.actions.map((action) => ({
        type: action.type,
        config: action.config ?? {}
      })),
      enabled: dto.enabled ?? true,
      retryPolicy: {
        maxAttempts: Math.max(1, Number(dto.retryPolicy?.maxAttempts ?? 1)),
        backoffMs: Math.max(0, Number(dto.retryPolicy?.backoffMs ?? 0))
      }
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListAutomationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<AutomationDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.search) {
      filter.$or = [{ name: { $regex: query.search, $options: 'i' } }];
    }

    if (query.trigger) {
      filter.trigger = query.trigger;
    }

    if (query.enabled !== undefined) {
      filter.enabled = query.enabled;
    }

    const [items, total] = await Promise.all([
      this.automationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.automationModel.countDocuments(filter)
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

  async findById(tenantId: string, automationId: string): Promise<Automation> {
    const automation = await this.automationModel
      .findOne({
        _id: new Types.ObjectId(automationId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!automation) {
      throw new NotFoundException('Automation not found');
    }

    return automation;
  }

  async update(tenantId: string, automationId: string, dto: UpdateAutomationDto): Promise<Automation> {
    const updated = await this.automationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(automationId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.trigger !== undefined ? { trigger: dto.trigger } : {}),
            ...(dto.conditions !== undefined ? { conditions: dto.conditions } : {}),
            ...(dto.actions !== undefined
              ? {
                  actions: dto.actions.map((action) => ({
                    type: action.type,
                    config: action.config ?? {}
                  }))
                }
              : {}),
            ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
            ...(dto.retryPolicy !== undefined
              ? {
                  retryPolicy: {
                    maxAttempts: Math.max(1, Number(dto.retryPolicy.maxAttempts ?? 1)),
                    backoffMs: Math.max(0, Number(dto.retryPolicy.backoffMs ?? 0))
                  }
                }
              : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Automation not found');
    }

    return updated;
  }

  async remove(tenantId: string, automationId: string): Promise<{ deleted: boolean }> {
    const result = await this.automationModel.deleteOne({
      _id: new Types.ObjectId(automationId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return {
      deleted: result.deletedCount > 0
    };
  }

  async listLogs(tenantId: string, query: ListAutomationLogsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<AutomationLogDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.automationId) {
      filter.automationId = new Types.ObjectId(query.automationId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.automationLogModel
        .find(filter)
        .populate({ path: 'automationId', select: 'name trigger enabled' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.automationLogModel.countDocuments(filter)
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

  async handleTrigger(payload: AutomationTriggerJobPayload): Promise<void> {
    const tenantObjectId = new Types.ObjectId(payload.tenantId);

    const automations = await this.automationModel.find({
      tenantId: tenantObjectId,
      trigger: payload.trigger,
      enabled: true
    });

    for (const automation of automations) {
      await this.executeAutomation(payload, automation);
    }
  }

  private async executeAutomation(
    payload: AutomationTriggerJobPayload,
    automation: AutomationDocument
  ): Promise<void> {
    const context = payload.context ?? {};
    const log = await this.automationLogModel.create({
      tenantId: automation.tenantId,
      automationId: automation._id,
      trigger: payload.trigger,
      status: AutomationLogStatus.RUNNING,
      startedAt: new Date(),
      finishedAt: null,
      entries: [
        {
          message: `Automation triggered: ${automation.name}`,
          level: 'info',
          createdAt: new Date()
        }
      ],
      context,
      error: null
    });

    if (!this.matchesConditions(automation.conditions ?? {}, context)) {
      log.status = AutomationLogStatus.SKIPPED;
      log.finishedAt = new Date();
      log.entries.push({
        message: 'Conditions did not match context',
        level: 'info',
        createdAt: new Date()
      });
      await log.save();
      return;
    }

    const runtimeState: Record<string, unknown> = {
      ...context,
      trigger: payload.trigger
    };

    const maxAttempts = Math.max(1, Number(automation.retryPolicy?.maxAttempts ?? 1));
    const backoffMs = Math.max(0, Number(automation.retryPolicy?.backoffMs ?? 0));

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        log.entries.push({
          message: `Execution attempt ${attempt}/${maxAttempts}`,
          level: 'info',
          createdAt: new Date()
        });

        for (const action of automation.actions ?? []) {
          await this.executeAction(String(automation.tenantId), action.type, action.config ?? {}, runtimeState);
          log.entries.push({
            message: `Action executed: ${action.type}`,
            level: 'info',
            createdAt: new Date()
          });
        }

        log.status = AutomationLogStatus.SUCCESS;
        log.finishedAt = new Date();
        await log.save();

        await this.notificationsService.notifyTenantUsers(String(automation.tenantId), {
          type: NotificationType.AUTOMATION,
          title: `Automation executed: ${automation.name}`,
          body: `Trigger ${payload.trigger} processed successfully.`,
          metadata: {
            automationId: String(automation._id),
            trigger: payload.trigger
          }
        });
        return;
      } catch (error) {
        lastError = error as Error;
        log.entries.push({
          message: `Attempt ${attempt} failed: ${lastError.message}`,
          level: 'error',
          createdAt: new Date()
        });

        if (attempt < maxAttempts && backoffMs > 0) {
          await this.sleep(backoffMs);
        }
      }
    }

    log.status = AutomationLogStatus.FAILED;
    log.finishedAt = new Date();
    log.error = lastError?.message ?? 'Unknown automation failure';
    await log.save();
  }

  private async executeAction(
    tenantId: string,
    actionType: AutomationActionType,
    config: Record<string, unknown>,
    runtimeState: Record<string, unknown>
  ): Promise<void> {
    if (actionType === AutomationActionType.CREATE_TICKET) {
      if (this.asString(runtimeState.trigger) === AutomationTrigger.TICKET_CREATED) {
        throw new Error('create_ticket action cannot be used with ticket_created trigger');
      }

      const deviceId =
        this.interpolate(this.asString(config.deviceId), runtimeState) ??
        this.asString(runtimeState.deviceId);
      const subject =
        this.interpolate(this.asString(config.subject) ?? 'Automation ticket', runtimeState) ??
        'Automation ticket';
      const description =
        this.interpolate(this.asString(config.description) ?? 'Created by automation', runtimeState) ??
        'Created by automation';

      const ticket = (await this.ticketsService.createManual(tenantId, null, {
        source: TicketSource.AUTOMATION,
        subject,
        description,
        clientId: this.interpolate(this.asString(config.clientId), runtimeState) ?? undefined,
        deviceId: deviceId ?? undefined,
        priority:
          (this.asString(config.priority) as TicketPriority | null) ?? TicketPriority.MEDIUM,
        assigneeId: this.interpolate(this.asString(config.assigneeId), runtimeState) ?? undefined,
        slaPolicyId: this.interpolate(this.asString(config.slaPolicyId), runtimeState) ?? undefined
      })) as any;

      runtimeState.ticketId = String(ticket._id);
      return;
    }

    if (actionType === AutomationActionType.SEND_NOTIFICATION) {
      const notificationType =
        (this.asString(config.type) as NotificationType | null) ?? NotificationType.AUTOMATION;
      const title =
        this.interpolate(this.asString(config.title) ?? 'Automation notification', runtimeState) ??
        'Automation notification';
      const body =
        this.interpolate(this.asString(config.body) ?? 'Automation action executed.', runtimeState) ??
        'Automation action executed.';
      const userId = this.interpolate(this.asString(config.userId), runtimeState);

      if (userId) {
        await this.notificationsService.notifyUser(tenantId, userId, {
          type: notificationType,
          title,
          body,
          metadata: {
            automation: true
          }
        });
      } else {
        await this.notificationsService.notifyTenantUsers(tenantId, {
          type: notificationType,
          title,
          body,
          metadata: {
            automation: true
          }
        });
      }
      return;
    }

    if (actionType === AutomationActionType.EXECUTE_SCRIPT) {
      const scriptId = this.interpolate(this.asString(config.scriptId), runtimeState);
      const deviceId =
        this.interpolate(this.asString(config.deviceId), runtimeState) ??
        this.asString(runtimeState.deviceId);
      if (!scriptId || !deviceId) {
        throw new Error('execute_script action requires scriptId and deviceId');
      }

      const execution = (await this.scriptExecutionsService.runFromAutomation({
        tenantId,
        scriptId,
        deviceId,
        parameters: this.asObject(config.parameters) ?? {}
      })) as any;
      runtimeState.executionId = execution?._id ? String(execution._id) : null;
      return;
    }

    if (actionType === AutomationActionType.ASSIGN_TECHNICIAN) {
      const ticketId =
        this.interpolate(this.asString(config.ticketId), runtimeState) ??
        this.asString(runtimeState.ticketId);
      const assigneeId = this.interpolate(this.asString(config.assigneeId), runtimeState);

      if (!ticketId || !assigneeId) {
        throw new Error('assign_technician action requires ticketId and assigneeId');
      }

      await this.ticketsService.assign(
        tenantId,
        ticketId,
        {
          assigneeId
        },
        null
      );
      return;
    }

    if (actionType === AutomationActionType.TAG_DEVICE) {
      const deviceId =
        this.interpolate(this.asString(config.deviceId), runtimeState) ??
        this.asString(runtimeState.deviceId);
      const tags = this.asArrayOfStrings(config.tags);
      if (!deviceId || tags.length === 0) {
        throw new Error('tag_device action requires deviceId and tags');
      }

      await this.devicesService.addTags(tenantId, deviceId, tags);
      return;
    }

    if (actionType === AutomationActionType.WRITE_ACTIVITY_LOG) {
      const deviceId =
        this.interpolate(this.asString(config.deviceId), runtimeState) ??
        this.asString(runtimeState.deviceId);
      const message =
        this.interpolate(
          this.asString(config.message) ?? 'Automation activity log entry',
          runtimeState
        ) ?? 'Automation activity log entry';
      const activityType = this.asString(config.activityType) ?? 'automation';

      if (deviceId) {
        await this.monitoringService.recordDeviceActivity(tenantId, deviceId, {
          type: activityType,
          message,
          metadata: {
            automation: true,
            runtimeState
          }
        });
      }

      await this.auditService.logSystemAction({
        tenantId,
        action: 'automation.activity_log',
        metadata: {
          message,
          activityType,
          deviceId
        }
      });
      return;
    }

    throw new Error(`Unsupported action type: ${actionType}`);
  }

  private matchesConditions(
    conditions: Record<string, unknown>,
    context: Record<string, unknown>
  ): boolean {
    const deviceIdCondition = this.asString(conditions.deviceId);
    if (deviceIdCondition && deviceIdCondition !== this.asString(context.deviceId)) {
      return false;
    }

    const severityCondition = this.asArrayOfStrings(conditions.severities);
    if (
      severityCondition.length > 0 &&
      !severityCondition
        .map((item) => item.toLowerCase())
        .includes((this.asString(context.severity) ?? '').toLowerCase())
    ) {
      return false;
    }

    const scriptIdCondition = this.asString(conditions.scriptId);
    if (scriptIdCondition && scriptIdCondition !== this.asString(context.scriptId)) {
      return false;
    }

    const ticketRequired = Boolean(conditions.requiresTicket ?? false);
    if (ticketRequired && !this.asString(context.ticketId)) {
      return false;
    }

    return true;
  }

  private asString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private asObject(value: unknown): Record<string, string | number | boolean> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, string | number | boolean>;
  }

  private asArrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }

  private interpolate(template: string | null, context: Record<string, unknown>): string | null {
    if (!template) {
      return null;
    }

    return template.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
      const value = this.getPathValue(context, key.trim());
      if (value === null || value === undefined) {
        return '';
      }

      return String(value);
    });
  }

  private getPathValue(context: Record<string, unknown>, path: string): unknown {
    const keys = path.split('.').filter(Boolean);
    let current: unknown = context;

    for (const key of keys) {
      if (!current || typeof current !== 'object' || !(key in (current as Record<string, unknown>))) {
        return null;
      }
      current = (current as Record<string, unknown>)[key];
    }

    return current;
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
