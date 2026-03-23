import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { ListIntegrationsDto } from './dto/list-integrations.dto';
import { TestEmailDto } from './dto/test-email.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { Integration, IntegrationDocument, IntegrationType } from './integration.schema';
import { ConsoleEmailProvider } from './providers/console-email.provider';
import { EmailProvider } from './providers/email-provider.interface';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectModel(Integration.name)
    private readonly integrationModel: Model<IntegrationDocument>,
    private readonly auditService: AuditService
  ) {}

  async create(tenantId: string, userId: string, dto: CreateIntegrationDto) {
    const created = await this.integrationModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name.trim(),
      type: dto.type,
      config: dto.config ?? {},
      enabled: dto.enabled ?? true
    });

    await this.auditService.logSystemAction({
      action: 'integration.created',
      tenantId,
      userId,
      entityType: 'integration',
      entityId: String(created._id),
      metadata: {
        type: dto.type,
        name: dto.name
      }
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListIntegrationsDto) {
    const filter: Record<string, unknown> = {
      tenantId: new Types.ObjectId(tenantId)
    };
    if (query.type) {
      filter.type = query.type;
    }

    return this.integrationModel.find(filter).sort({ type: 1, name: 1 }).lean();
  }

  async findById(tenantId: string, integrationId: string) {
    const integration = await this.integrationModel
      .findOne({
        _id: new Types.ObjectId(integrationId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  async update(tenantId: string, userId: string, integrationId: string, dto: UpdateIntegrationDto) {
    const updated = await this.integrationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(integrationId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
            ...(dto.type !== undefined ? { type: dto.type } : {}),
            ...(dto.config !== undefined ? { config: dto.config } : {}),
            ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Integration not found');
    }

    await this.auditService.logSystemAction({
      action: 'integration.updated',
      tenantId,
      userId,
      entityType: 'integration',
      entityId: integrationId
    });

    return updated;
  }

  async remove(tenantId: string, userId: string, integrationId: string) {
    const result = await this.integrationModel.deleteOne({
      _id: new Types.ObjectId(integrationId),
      tenantId: new Types.ObjectId(tenantId)
    });

    if (result.deletedCount > 0) {
      await this.auditService.logSystemAction({
        action: 'integration.deleted',
        tenantId,
        userId,
        entityType: 'integration',
        entityId: integrationId
      });
    }

    return {
      deleted: result.deletedCount > 0
    };
  }

  async testWebhook(tenantId: string, dto: TestWebhookDto) {
    return this.dispatchWebhooks(tenantId, dto.event, dto.payload ?? {});
  }

  async testEmail(tenantId: string, dto: TestEmailDto) {
    return this.sendEmail(tenantId, dto.to, dto.subject, dto.html);
  }

  async dispatchWebhooks(
    tenantId: string,
    event: string,
    payload: Record<string, unknown>
  ): Promise<{
    delivered: number;
    failed: number;
    results: Array<{ integrationId: string; success: boolean; message: string }>;
  }> {
    const hooks = await this.integrationModel
      .find({
        tenantId: new Types.ObjectId(tenantId),
        type: IntegrationType.WEBHOOK,
        enabled: true
      })
      .lean();

    const results: Array<{ integrationId: string; success: boolean; message: string }> = [];
    let delivered = 0;
    let failed = 0;

    for (const hook of hooks) {
      const url = String(hook.config?.url ?? '').trim();
      if (!url) {
        results.push({
          integrationId: String(hook._id),
          success: false,
          message: 'Missing webhook URL'
        });
        failed += 1;
        continue;
      }

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event,
            payload,
            timestamp: new Date().toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`Webhook returned status ${response.status}`);
        }

        delivered += 1;
        results.push({
          integrationId: String(hook._id),
          success: true,
          message: `Delivered with status ${response.status}`
        });

        await this.integrationModel.updateOne(
          { _id: hook._id },
          {
            $set: {
              lastDeliveryAt: new Date(),
              lastError: null
            }
          }
        );
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : 'Webhook delivery failed';
        results.push({
          integrationId: String(hook._id),
          success: false,
          message
        });

        await this.integrationModel.updateOne(
          { _id: hook._id },
          {
            $set: {
              lastError: message
            }
          }
        );
      }
    }

    return {
      delivered,
      failed,
      results
    };
  }

  async sendEmail(tenantId: string, to: string, subject: string, html: string) {
    const smtpIntegration = await this.integrationModel
      .findOne({
        tenantId: new Types.ObjectId(tenantId),
        type: IntegrationType.SMTP,
        enabled: true
      })
      .lean();

    const provider = this.resolveEmailProvider(smtpIntegration?.config);
    const result = await provider.send({ to, subject, html });

    if (smtpIntegration) {
      await this.integrationModel.updateOne(
        {
          _id: smtpIntegration._id
        },
        {
          $set: {
            lastDeliveryAt: result.accepted ? new Date() : null,
            lastError: result.accepted ? null : result.message
          }
        }
      );
    }

    return {
      provider: smtpIntegration ? 'smtp' : 'console',
      ...result
    };
  }

  private resolveEmailProvider(config?: Record<string, unknown>): EmailProvider {
    if (config && typeof config.host === 'string' && config.host.trim() !== '') {
      return new SmtpEmailProvider({
        host: String(config.host),
        port: Number(config.port ?? 25),
        username: typeof config.username === 'string' ? config.username : undefined,
        password: typeof config.password === 'string' ? config.password : undefined,
        from: typeof config.from === 'string' ? config.from : undefined
      });
    }

    return new ConsoleEmailProvider();
  }
}
