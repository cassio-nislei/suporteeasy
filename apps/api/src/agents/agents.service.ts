import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { DevicesService } from '../devices/devices.service';
import { Agent, AgentDocument, AgentStatus } from './agent.schema';
import { RegisterAgentDto } from './dto/register-agent.dto';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name)
    private readonly agentModel: Model<AgentDocument>,
    private readonly devicesService: DevicesService
  ) {}

  async register(tenantId: string, dto: RegisterAgentDto) {
    await this.devicesService.findById(tenantId, dto.deviceId);

    const plainToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(plainToken);

    const agent = await this.agentModel.findOneAndUpdate(
      {
        tenantId: new Types.ObjectId(tenantId),
        deviceId: new Types.ObjectId(dto.deviceId)
      },
      {
        $set: {
          tokenHash,
          version: dto.version ?? '1.0.0',
          status: AgentStatus.OFFLINE
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    return {
      agentId: String(agent._id),
      deviceId: String(agent.deviceId),
      token: plainToken,
      version: agent.version
    };
  }

  async findByToken(token: string): Promise<AgentDocument | null> {
    const tokenHash = this.hashToken(token);
    return this.agentModel.findOne({ tokenHash });
  }

  async heartbeat(
    agent: AgentDocument,
    status: AgentStatus,
    version?: string
  ): Promise<AgentDocument | null> {
    return this.agentModel.findByIdAndUpdate(
      agent._id,
      {
        $set: {
          status,
          lastHeartbeatAt: new Date(),
          ...(version ? { version } : {})
        }
      },
      { new: true }
    );
  }

  /**
   * Valida se agente está offline baseado no heartbeat
   * Threshold padrão: 30 segundos (agente envia heartbeat a cada 10s)
   */
  isAgentStale(agent: Agent, thresholdMs: number = 30000): boolean {
    if (!agent.lastHeartbeatAt) {
      return true;
    }
    const timeSinceLastHeartbeat = Date.now() - agent.lastHeartbeatAt.getTime();
    return timeSinceLastHeartbeat > thresholdMs;
  }

  async markOfflineByThreshold(thresholdDate: Date): Promise<Agent[]> {
    const staleAgents = await this.agentModel
      .find({
        status: AgentStatus.ONLINE,
        lastHeartbeatAt: { $lt: thresholdDate }
      })
      .lean();

    if (staleAgents.length) {
      await this.agentModel.updateMany(
        { _id: { $in: staleAgents.map((agent) => agent._id) } },
        { $set: { status: AgentStatus.OFFLINE } }
      );
    }

    return staleAgents;
  }

  async findByDevice(tenantId: string, deviceId: string) {
    return this.agentModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        deviceId: new Types.ObjectId(deviceId)
      })
      .lean();
  }

  async getById(agentId: string): Promise<AgentDocument> {
    const agent = await this.agentModel.findById(agentId);
    if (!agent) {
      throw new NotFoundException('Agent not found');
    }

    return agent;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
