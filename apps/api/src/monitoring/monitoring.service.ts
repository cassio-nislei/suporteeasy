import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  Optional,
  UnauthorizedException,
  forwardRef
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { AgentStatus } from '../agents/agent.schema';
import { AgentsService } from '../agents/agents.service';
import { AgentHeartbeatDto } from '../agents/dto/agent-heartbeat.dto';
import { AlertsService } from '../alerts/alerts.service';
import { Device, DeviceOnlineStatus } from '../devices/device.schema';
import { DevicesService } from '../devices/devices.service';
import { AUTOMATION_JOB_TRIGGER, AUTOMATION_QUEUE } from '../jobs/jobs.constants';
import { DeviceActivity, DeviceActivityDocument } from './device-activity.schema';
import { DeviceStatusGateway } from './device-status.gateway';
import { MonitoringIngestDto } from './dto/monitoring-ingest.dto';
import { Metric, MetricDocument } from './metric.schema';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly devicesService: DevicesService,
    private readonly agentsService: AgentsService,
    @Inject(forwardRef(() => AlertsService))
    private readonly alertsService: AlertsService,
    private readonly deviceStatusGateway: DeviceStatusGateway,
    @InjectModel(Metric.name)
    private readonly metricModel: Model<MetricDocument>,
    @InjectModel(DeviceActivity.name)
    private readonly deviceActivityModel: Model<DeviceActivityDocument>,
    @Optional()
    @InjectQueue(AUTOMATION_QUEUE)
    private readonly automationQueue?: Queue
  ) {}

  async processHeartbeat(dto: AgentHeartbeatDto) {
    const agent = await this.agentsService.findByToken(dto.agentToken);
    if (!agent) {
      throw new UnauthorizedException('Invalid agent token');
    }

    const tenantId = String(agent.tenantId);
    const deviceId = String(agent.deviceId);
    const status = dto.status === 'offline' ? DeviceOnlineStatus.OFFLINE : DeviceOnlineStatus.ONLINE;

    const deviceBefore = await this.devicesService.findByIdForAgent(deviceId);
    const updatedDevice = await this.devicesService.touchHeartbeat(
      tenantId,
      deviceId,
      status,
      dto.services?.map((service) => `${service.name}:${service.status}`)
    );

    await this.agentsService.heartbeat(
      agent,
      status === DeviceOnlineStatus.ONLINE ? AgentStatus.ONLINE : AgentStatus.OFFLINE
    );

    await this.recordDeviceActivity(tenantId, deviceId, {
      type: 'heartbeat',
      message:
        status === DeviceOnlineStatus.ONLINE
          ? 'Heartbeat received and device marked online'
          : 'Heartbeat received and device marked offline',
      metadata: {
        services: dto.services ?? []
      }
    });

    if (deviceBefore?.onlineStatus !== status && updatedDevice) {
      this.emitStatusUpdate(updatedDevice);
      await this.recordDeviceActivity(tenantId, deviceId, {
        type: 'status-change',
        message: `Device status changed from ${deviceBefore?.onlineStatus ?? 'unknown'} to ${status}`,
        metadata: {
          previous: deviceBefore?.onlineStatus ?? 'unknown',
          current: status
        }
      });
    }

    if (deviceBefore?.onlineStatus !== status) {
      try {
        await this.alertsService.evaluateDeviceStatus(tenantId, deviceId, status, 'heartbeat');
      } catch (error) {
        this.logger.warn(
          `Failed device status alert evaluation for ${deviceId}: ${(error as Error).message}`
        );
      }

      if (status === DeviceOnlineStatus.OFFLINE) {
        await this.enqueueAutomationTrigger(tenantId, {
          trigger: 'device_offline',
          context: {
            deviceId,
            source: 'heartbeat',
            onlineStatus: status
          }
        });
      }
    }

    return {
      ok: true,
      tenantId,
      deviceId,
      onlineStatus: status,
      lastHeartbeatAt: updatedDevice?.lastHeartbeatAt ?? null
    };
  }

  async ingestMetrics(dto: MonitoringIngestDto) {
    const agent = await this.agentsService.findByToken(dto.agentToken);
    if (!agent) {
      throw new UnauthorizedException('Invalid agent token');
    }

    const tenantId = String(agent.tenantId);
    const deviceId = String(agent.deviceId);

    const now = new Date();
    const documents = dto.metrics.map((metric) => ({
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(deviceId),
      type: metric.type,
      value: metric.value,
      unit: metric.unit,
      timestamp: metric.timestamp ? new Date(metric.timestamp) : now
    }));

    if (documents.length > 0) {
      await this.metricModel.insertMany(documents);
    }

    const updatedDevice = await this.devicesService.touchHeartbeat(
      tenantId,
      deviceId,
      DeviceOnlineStatus.ONLINE
    );
    await this.agentsService.heartbeat(agent, AgentStatus.ONLINE);

    await this.recordDeviceActivity(tenantId, deviceId, {
      type: 'metric-ingest',
      message: `${documents.length} metric(s) ingested`,
      metadata: {
        metricTypes: [...new Set(documents.map((item) => item.type))]
      }
    });

    if (updatedDevice && updatedDevice.onlineStatus === DeviceOnlineStatus.ONLINE) {
      this.emitStatusUpdate(updatedDevice);
    }

    try {
      await this.alertsService.evaluateMetrics(
        tenantId,
        deviceId,
        documents.map((metric) => ({
          type: metric.type,
          value: metric.value,
          unit: metric.unit,
          timestamp: metric.timestamp
        }))
      );
    } catch (error) {
      this.logger.warn(`Failed metric alert evaluation for ${deviceId}: ${(error as Error).message}`);
    }

    return {
      accepted: documents.length,
      tenantId,
      deviceId
    };
  }

  async listDeviceMetrics(
    tenantId: string,
    deviceId: string,
    query: { type?: string; page: number; limit: number }
  ) {
    await this.devicesService.findById(tenantId, deviceId);

    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(deviceId)
    };

    if (query.type) {
      filter.type = query.type;
    }

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.metricModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      this.metricModel.countDocuments(filter)
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

  async getLatestMetricsForDevice(tenantId: string, deviceId: string) {
    const tenantObjectId = new Types.ObjectId(tenantId);
    const deviceObjectId = new Types.ObjectId(deviceId);

    const latest = await this.metricModel.aggregate([
      { $match: { tenantId: tenantObjectId, deviceId: deviceObjectId } },
      { $sort: { timestamp: -1 } },
      {
        $group: {
          _id: '$type',
          type: { $first: '$type' },
          value: { $first: '$value' },
          unit: { $first: '$unit' },
          timestamp: { $first: '$timestamp' }
        }
      }
    ]);

    return latest;
  }

  async getDeviceActivity(
    tenantId: string,
    deviceId: string,
    query: {
      page: number;
      limit: number;
    }
  ) {
    await this.devicesService.findById(tenantId, deviceId);

    const page = query.page;
    const limit = query.limit;
    const skip = (page - 1) * limit;

    const filter = {
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(deviceId)
    };

    const [items, total] = await Promise.all([
      this.deviceActivityModel.find(filter).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
      this.deviceActivityModel.countDocuments(filter)
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

  async getAgentByDevice(tenantId: string, deviceId: string) {
    return this.agentsService.findByDevice(tenantId, deviceId);
  }

  async recordDeviceActivity(
    tenantId: string,
    deviceId: string,
    input: {
      type: string;
      message: string;
      metadata?: Record<string, unknown>;
      occurredAt?: Date;
    }
  ) {
    await this.deviceActivityModel.create({
      tenantId: new Types.ObjectId(tenantId),
      deviceId: new Types.ObjectId(deviceId),
      type: input.type,
      message: input.message,
      metadata: input.metadata ?? {},
      occurredAt: input.occurredAt ?? new Date()
    });
  }

  async runHeartbeatTimeoutCheck(): Promise<void> {
    if ((process.env.MONITORING_RECONCILE_ENABLED ?? 'true') === 'false') {
      return;
    }

    const thresholdSeconds = Number(process.env.DEVICE_OFFLINE_THRESHOLD_SECONDS ?? '90');
    const thresholdDate = new Date(Date.now() - thresholdSeconds * 1000);

    const staleDevices = await this.devicesService.markStaleDevicesOffline(thresholdDate);
    await this.agentsService.markOfflineByThreshold(thresholdDate);

    for (const device of staleDevices) {
      await this.recordDeviceActivity(String(device.tenantId), String(device._id), {
        type: 'status-change',
        message: 'Device automatically marked offline by reconciliation',
        metadata: {
          previous: DeviceOnlineStatus.ONLINE,
          current: DeviceOnlineStatus.OFFLINE,
          thresholdSeconds
        }
      });

      this.deviceStatusGateway.emitDeviceStatus({
        tenantId: String(device.tenantId),
        deviceId: String(device._id),
        hostname: device.hostname,
        onlineStatus: DeviceOnlineStatus.OFFLINE,
        lastHeartbeatAt: device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt).toISOString() : null
      });

      try {
        await this.alertsService.evaluateDeviceStatus(
          String(device.tenantId),
          String(device._id),
          DeviceOnlineStatus.OFFLINE,
          'reconcile'
        );
      } catch (error) {
        this.logger.warn(
          `Failed reconcile alert evaluation for ${String(device._id)}: ${(error as Error).message}`
        );
      }

      await this.enqueueAutomationTrigger(String(device.tenantId), {
        trigger: 'device_offline',
        context: {
          deviceId: String(device._id),
          source: 'reconcile',
          onlineStatus: DeviceOnlineStatus.OFFLINE
        }
      });
    }

    if (staleDevices.length > 0) {
      this.logger.log(`Reconciliation marked ${staleDevices.length} device(s) offline`);
    }
  }

  private emitStatusUpdate(device: Device | { [key: string]: unknown }) {
    this.deviceStatusGateway.emitDeviceStatus({
      tenantId: String(device.tenantId),
      deviceId: String(device._id),
      hostname: String(device.hostname),
      onlineStatus: device.onlineStatus as 'online' | 'offline' | 'unknown',
      lastHeartbeatAt: device.lastHeartbeatAt ? new Date(device.lastHeartbeatAt as Date).toISOString() : null
    });
  }

  private async enqueueAutomationTrigger(
    tenantId: string,
    payload: {
      trigger: 'device_offline';
      context: Record<string, unknown>;
    }
  ) {
    if (!this.automationQueue) {
      return;
    }

    await this.automationQueue.add(
      AUTOMATION_JOB_TRIGGER,
      {
        tenantId,
        trigger: payload.trigger,
        context: payload.context
      },
      {
        removeOnComplete: true,
        removeOnFail: 50,
        attempts: 3
      }
    );
  }
}
