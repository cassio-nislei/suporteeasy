import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Queue } from 'bullmq';
import { AgentsService } from '../agents/agents.service';
import { DeviceGroupsService } from '../device-groups/device-groups.service';
import { DevicesService } from '../devices/devices.service';
import {
  AUTOMATION_JOB_TRIGGER,
  AUTOMATION_QUEUE,
  SCRIPT_EXECUTION_JOB_PROCESS,
  SCRIPT_EXECUTION_JOB_SCHEDULE,
  SCRIPT_EXECUTION_QUEUE
} from '../jobs/jobs.constants';
import { MonitoringService } from '../monitoring/monitoring.service';
import { NotificationType } from '../notifications/notification.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { ScriptsService } from '../scripts/scripts.service';
import { PullAgentCommandsDto } from './dto/pull-agent-commands.dto';
import { ReportScriptResultDto } from './dto/report-script-result.dto';
import { RunScriptOnDeviceDto } from './dto/run-script-on-device.dto';
import { RunScriptOnGroupDto } from './dto/run-script-on-group.dto';
import { ScheduleScriptDto } from './dto/schedule-script.dto';
import { AgentCommand, AgentCommandDocument, AgentCommandStatus } from './agent-command.schema';
import {
  ScheduledJob,
  ScheduledJobDocument,
  ScheduledJobStatus,
  ScheduledJobType
} from './scheduled-job.schema';
import { ScriptExecutionGateway } from './script-execution.gateway';
import {
  ScriptExecution,
  ScriptExecutionDocument,
  ScriptExecutionStatus
} from './script-execution.schema';
import { ListScriptExecutionsDto } from './dto/list-script-executions.dto';

interface ProcessScriptExecutionJobData {
  executionId: string;
}

interface ProcessScheduledJobData {
  scheduledJobId: string;
}

@Injectable()
export class ScriptExecutionsService {
  constructor(
    @InjectModel(ScriptExecution.name)
    private readonly scriptExecutionModel: Model<ScriptExecutionDocument>,
    @InjectModel(ScheduledJob.name)
    private readonly scheduledJobModel: Model<ScheduledJobDocument>,
    @InjectModel(AgentCommand.name)
    private readonly agentCommandModel: Model<AgentCommandDocument>,
    private readonly scriptsService: ScriptsService,
    private readonly devicesService: DevicesService,
    private readonly deviceGroupsService: DeviceGroupsService,
    private readonly agentsService: AgentsService,
    private readonly monitoringService: MonitoringService,
    private readonly notificationsService: NotificationsService,
    private readonly scriptExecutionGateway: ScriptExecutionGateway,
    @Optional()
    @InjectQueue(SCRIPT_EXECUTION_QUEUE)
    private readonly scriptExecutionQueue?: Queue,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue?: Queue
  ) {}

  async runOnDevice(tenantId: string, actorUserId: string | null, dto: RunScriptOnDeviceDto) {
    await this.devicesService.findById(tenantId, dto.deviceId);
    const script = await this.scriptsService.findById(tenantId, dto.scriptId);

    if (!script.enabled) {
      throw new BadRequestException('Script is disabled');
    }

    const created = await this.scriptExecutionModel.create({
      tenantId: new Types.ObjectId(tenantId),
      scriptId: new Types.ObjectId(dto.scriptId),
      deviceId: new Types.ObjectId(dto.deviceId),
      status: ScriptExecutionStatus.QUEUED,
      startedAt: null,
      finishedAt: null,
      logs: [{ message: 'Execution queued', createdAt: new Date() }],
      result: {
        parameters: dto.parameters ?? {}
      },
      scriptSnapshot: {
        name: script.name,
        category: script.category,
        platform: script.platform,
        body: script.body,
        parameterNames: script.parameters.map((parameter) => parameter.name)
      },
      requestedBy: actorUserId ? new Types.ObjectId(actorUserId) : null,
      source: actorUserId ? 'manual' : 'automation'
    });

    await this.enqueueExecution(created);
    return this.findById(tenantId, String(created._id));
  }

  async runOnGroup(tenantId: string, actorUserId: string | null, dto: RunScriptOnGroupDto) {
    const group = await this.deviceGroupsService.findById(tenantId, dto.groupId);
    const deviceIds = (group.deviceIds ?? []).map((deviceId) => String(deviceId));

    if (deviceIds.length === 0) {
      throw new BadRequestException('Device group has no devices');
    }

    const executions = [];
    for (const deviceId of deviceIds) {
      const execution = await this.runOnDevice(tenantId, actorUserId, {
        scriptId: dto.scriptId,
        deviceId,
        parameters: dto.parameters
      });
      executions.push(execution);
    }

    return {
      total: executions.length,
      items: executions
    };
  }

  async schedule(tenantId: string, actorUserId: string | null, dto: ScheduleScriptDto) {
    const runAt = new Date(dto.runAt);
    if (Number.isNaN(runAt.getTime())) {
      throw new BadRequestException('Invalid schedule date');
    }

    if (!dto.deviceId && !dto.groupId) {
      throw new BadRequestException('Provide either deviceId or groupId');
    }

    if (dto.deviceId && dto.groupId) {
      throw new BadRequestException('Provide only one target: deviceId or groupId');
    }

    await this.scriptsService.findById(tenantId, dto.scriptId);

    if (dto.deviceId) {
      await this.devicesService.findById(tenantId, dto.deviceId);
    }

    if (dto.groupId) {
      await this.deviceGroupsService.findById(tenantId, dto.groupId);
    }

    const scheduledJob = await this.scheduledJobModel.create({
      tenantId: new Types.ObjectId(tenantId),
      type: ScheduledJobType.SCRIPT,
      payload: {
        scriptId: dto.scriptId,
        deviceId: dto.deviceId ?? null,
        groupId: dto.groupId ?? null,
        parameters: dto.parameters ?? {},
        actorUserId
      },
      runAt,
      status: ScheduledJobStatus.PENDING
    });

    if (!this.scriptExecutionQueue || runAt.getTime() <= Date.now()) {
      await this.processScheduledJob({ scheduledJobId: String(scheduledJob._id) });
      return this.findScheduledById(tenantId, String(scheduledJob._id));
    }

    await this.scriptExecutionQueue.add(
      SCRIPT_EXECUTION_JOB_SCHEDULE,
      { scheduledJobId: String(scheduledJob._id) } satisfies ProcessScheduledJobData,
      {
        delay: Math.max(0, runAt.getTime() - Date.now()),
        removeOnComplete: true,
        removeOnFail: 50
      }
    );

    scheduledJob.status = ScheduledJobStatus.QUEUED;
    await scheduledJob.save();

    return this.findScheduledById(tenantId, String(scheduledJob._id));
  }

  async list(tenantId: string, query: ListScriptExecutionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ScriptExecutionDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.scriptId) {
      filter.scriptId = new Types.ObjectId(query.scriptId);
    }

    if (query.deviceId) {
      filter.deviceId = new Types.ObjectId(query.deviceId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.scriptExecutionModel
        .find(filter)
        .populate({ path: 'scriptId', select: 'name category platform enabled' })
        .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.scriptExecutionModel.countDocuments(filter)
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

  async findById(tenantId: string, executionId: string) {
    const execution = await this.scriptExecutionModel
      .findOne({
        _id: new Types.ObjectId(executionId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'scriptId', select: 'name category platform enabled body parameters' })
      .populate({ path: 'deviceId', select: 'hostname ipAddress onlineStatus clientId' })
      .lean();

    if (!execution) {
      throw new NotFoundException('Script execution not found');
    }

    return execution;
  }

  async listScheduledJobs(tenantId: string, page = 1, limit = 20) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, Math.min(100, limit));
    const skip = (safePage - 1) * safeLimit;

    const filter = { tenantId: new Types.ObjectId(tenantId) };
    const [items, total] = await Promise.all([
      this.scheduledJobModel.find(filter).sort({ runAt: -1 }).skip(skip).limit(safeLimit).lean(),
      this.scheduledJobModel.countDocuments(filter)
    ]);

    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.max(1, Math.ceil(total / safeLimit))
      }
    };
  }

  async findScheduledById(tenantId: string, scheduledJobId: string) {
    const job = await this.scheduledJobModel
      .findOne({
        _id: new Types.ObjectId(scheduledJobId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!job) {
      throw new NotFoundException('Scheduled job not found');
    }

    return job;
  }

  async pullAgentCommands(dto: PullAgentCommandsDto) {
    const agent = await this.agentsService.findByToken(dto.agentToken);
    if (!agent) {
      throw new UnauthorizedException('Invalid agent token');
    }

    const pendingCommands = await this.agentCommandModel
      .find({
        tenantId: agent.tenantId,
        deviceId: agent.deviceId,
        agentId: agent._id,
        status: AgentCommandStatus.PENDING
      })
      .sort({ createdAt: 1 })
      .limit(10);

    if (pendingCommands.length === 0) {
      return { commands: [] };
    }

    const commandIds = pendingCommands.map((command) => command._id);
    await this.agentCommandModel.updateMany(
      {
        _id: { $in: commandIds }
      },
      {
        $set: {
          status: AgentCommandStatus.DISPATCHED,
          dispatchedAt: new Date()
        }
      }
    );

    return {
      commands: pendingCommands.map((command) => ({
        commandId: String(command._id),
        executionId: String(command.scriptExecutionId),
        scriptId: String(command.scriptId),
        scriptName: command.scriptName,
        platform: command.platform,
        body: command.body,
        parameters: command.parameters,
        issuedAt: command.createdAt.toISOString()
      }))
    };
  }

  async reportResult(dto: ReportScriptResultDto) {
    const agent = await this.agentsService.findByToken(dto.agentToken);
    if (!agent) {
      throw new UnauthorizedException('Invalid agent token');
    }

    const execution = await this.scriptExecutionModel.findOne({
      _id: new Types.ObjectId(dto.executionId),
      tenantId: agent.tenantId,
      deviceId: agent.deviceId
    });

    if (!execution) {
      throw new NotFoundException('Script execution not found for this agent/device');
    }

    if (
      execution.status === ScriptExecutionStatus.SUCCESS ||
      execution.status === ScriptExecutionStatus.FAILED
    ) {
      return execution.toObject();
    }

    const finalStatus =
      dto.status === 'success' ? ScriptExecutionStatus.SUCCESS : ScriptExecutionStatus.FAILED;

    execution.status = finalStatus;
    execution.finishedAt = new Date();
    execution.logs.push(
      ...(dto.logs ?? ['Agent reported result']).map((message) => ({
        message,
        createdAt: new Date()
      }))
    );
    execution.result = dto.result ?? null;
    await execution.save();

    await this.agentCommandModel.updateMany(
      {
        scriptExecutionId: execution._id,
        agentId: agent._id,
        status: { $in: [AgentCommandStatus.PENDING, AgentCommandStatus.DISPATCHED] }
      },
      {
        $set: {
          status:
            finalStatus === ScriptExecutionStatus.SUCCESS
              ? AgentCommandStatus.COMPLETED
              : AgentCommandStatus.FAILED,
          completedAt: new Date(),
          result: dto.result ?? null
        }
      }
    );

    this.emitExecutionStatus(execution);
    await this.monitoringService.recordDeviceActivity(String(agent.tenantId), String(agent.deviceId), {
      type: 'script-execution',
      message: `Script execution ${finalStatus}`,
      metadata: {
        executionId: String(execution._id),
        scriptId: String(execution.scriptId)
      }
    });

    if (finalStatus === ScriptExecutionStatus.FAILED) {
      await this.notificationsService.notifyTenantUsers(String(agent.tenantId), {
        type: NotificationType.SCRIPT_EXECUTION,
        title: `Script failed: ${execution.scriptSnapshot.name}`,
        body: `Execution ${String(execution._id)} failed on device ${String(agent.deviceId)}`,
        metadata: {
          executionId: String(execution._id),
          scriptId: String(execution.scriptId),
          deviceId: String(agent.deviceId)
        }
      });

      if (this.automationQueue) {
        await this.automationQueue.add(
          AUTOMATION_JOB_TRIGGER,
          {
            tenantId: String(agent.tenantId),
            trigger: 'script_failed',
            context: {
              executionId: String(execution._id),
              scriptId: String(execution.scriptId),
              deviceId: String(agent.deviceId),
              result: dto.result ?? null
            }
          },
          {
            removeOnComplete: true,
            removeOnFail: 50,
            attempts: 3
          }
        );
      }
    }

    return this.findById(String(agent.tenantId), String(execution._id));
  }

  async processExecutionJob(data: ProcessScriptExecutionJobData): Promise<void> {
    const execution = await this.scriptExecutionModel.findById(new Types.ObjectId(data.executionId));
    if (!execution) {
      return;
    }

    if (execution.status !== ScriptExecutionStatus.QUEUED) {
      return;
    }

    execution.status = ScriptExecutionStatus.RUNNING;
    execution.startedAt = new Date();
    execution.logs.push({
      message: 'Worker picked execution and dispatched command',
      createdAt: new Date()
    });
    await execution.save();
    this.emitExecutionStatus(execution);

    const agent = await this.agentsService.findByDevice(
      String(execution.tenantId),
      String(execution.deviceId)
    );

    if (!agent) {
      execution.status = ScriptExecutionStatus.FAILED;
      execution.finishedAt = new Date();
      execution.logs.push({
        message: 'No agent registered for target device',
        createdAt: new Date()
      });
      execution.result = { reason: 'agent_not_found' };
      await execution.save();
      this.emitExecutionStatus(execution);
      return;
    }

    const parameters =
      execution.result && typeof execution.result === 'object' && 'parameters' in execution.result
        ? ((execution.result as Record<string, unknown>).parameters as Record<
            string,
            string | number | boolean
          >)
        : {};

    await this.agentCommandModel.create({
      tenantId: execution.tenantId,
      deviceId: execution.deviceId,
      agentId: agent._id,
      scriptExecutionId: execution._id,
      scriptId: execution.scriptId,
      status: AgentCommandStatus.PENDING,
      scriptName: execution.scriptSnapshot.name,
      platform: execution.scriptSnapshot.platform,
      body: execution.scriptSnapshot.body,
      parameters,
      dispatchedAt: null,
      completedAt: null,
      result: null
    });

    await this.monitoringService.recordDeviceActivity(
      String(execution.tenantId),
      String(execution.deviceId),
      {
        type: 'script-execution',
        message: `Script ${execution.scriptSnapshot.name} dispatched to agent`,
        metadata: {
          executionId: String(execution._id),
          scriptId: String(execution.scriptId)
        }
      }
    );
  }

  async processScheduledJob(data: ProcessScheduledJobData): Promise<void> {
    const scheduledJob = await this.scheduledJobModel.findById(new Types.ObjectId(data.scheduledJobId));
    if (!scheduledJob) {
      return;
    }

    if (
      scheduledJob.status === ScheduledJobStatus.COMPLETED ||
      scheduledJob.status === ScheduledJobStatus.FAILED
    ) {
      return;
    }

    scheduledJob.status = ScheduledJobStatus.RUNNING;
    await scheduledJob.save();

    try {
      const payload = scheduledJob.payload as {
        scriptId: string;
        deviceId?: string | null;
        groupId?: string | null;
        parameters?: Record<string, string | number | boolean>;
        actorUserId?: string | null;
      };

      if (payload.deviceId) {
        await this.runOnDevice(String(scheduledJob.tenantId), payload.actorUserId ?? null, {
          scriptId: payload.scriptId,
          deviceId: payload.deviceId,
          parameters: payload.parameters ?? {}
        });
      } else if (payload.groupId) {
        await this.runOnGroup(String(scheduledJob.tenantId), payload.actorUserId ?? null, {
          scriptId: payload.scriptId,
          groupId: payload.groupId,
          parameters: payload.parameters ?? {}
        });
      }

      scheduledJob.status = ScheduledJobStatus.COMPLETED;
      await scheduledJob.save();
    } catch (error) {
      scheduledJob.status = ScheduledJobStatus.FAILED;
      await scheduledJob.save();
      throw error;
    }
  }

  async runFromAutomation(input: {
    tenantId: string;
    scriptId: string;
    deviceId: string;
    parameters?: Record<string, string | number | boolean>;
  }) {
    return this.runOnDevice(input.tenantId, null, {
      scriptId: input.scriptId,
      deviceId: input.deviceId,
      parameters: input.parameters
    });
  }

  private async enqueueExecution(execution: ScriptExecutionDocument): Promise<void> {
    if (this.scriptExecutionQueue) {
      await this.scriptExecutionQueue.add(
        SCRIPT_EXECUTION_JOB_PROCESS,
        { executionId: String(execution._id) } satisfies ProcessScriptExecutionJobData,
        {
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3
        }
      );
      return;
    }

    await this.processExecutionJob({ executionId: String(execution._id) });
  }

  private emitExecutionStatus(execution: ScriptExecutionDocument): void {
    this.scriptExecutionGateway.emitExecutionUpdate({
      tenantId: String(execution.tenantId),
      executionId: String(execution._id),
      scriptId: String(execution.scriptId),
      deviceId: String(execution.deviceId),
      status: execution.status,
      startedAt: execution.startedAt ? execution.startedAt.toISOString() : null,
      finishedAt: execution.finishedAt ? execution.finishedAt.toISOString() : null
    });
  }
}
