import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Queue } from 'bullmq';
import { FilterQuery, Model, Types } from 'mongoose';
import { IntegrationsService } from '../integrations/integrations.service';
import { NOTIFICATION_JOB_CREATE, NOTIFICATION_QUEUE } from '../jobs/jobs.constants';
import { UsersService } from '../users/users.service';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { Notification, NotificationDocument, NotificationType } from './notification.schema';

interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    private readonly usersService: UsersService,
    @Optional()
    private readonly integrationsService?: IntegrationsService,
    @Optional()
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue?: Queue
  ) {}

  async notifyTenantUsers(tenantId: string, input: CreateNotificationInput): Promise<number> {
    const users = await this.usersService.listByTenant(tenantId);
    const userIds = users.map((user) => String(user._id));
    if (userIds.length === 0) {
      return 0;
    }

    return this.createForUsers(tenantId, userIds, input);
  }

  async notifyUser(tenantId: string, userId: string, input: CreateNotificationInput): Promise<void> {
    await this.createForUsers(tenantId, [userId], input);
  }

  async createForUsers(
    tenantId: string,
    userIds: string[],
    input: CreateNotificationInput
  ): Promise<number> {
    if (userIds.length === 0) {
      return 0;
    }

    if (this.notificationQueue) {
      await this.notificationQueue.add(
        NOTIFICATION_JOB_CREATE,
        {
          tenantId,
          userIds,
          input
        },
        {
          removeOnComplete: true,
          removeOnFail: 50,
          attempts: 3
        }
      );
      return userIds.length;
    }

    return this.createForUsersNow(tenantId, userIds, input);
  }

  async createForUsersNow(
    tenantId: string,
    userIds: string[],
    input: CreateNotificationInput
  ): Promise<number> {
    if (userIds.length === 0) {
      return 0;
    }

    const tenantObjectId = new Types.ObjectId(tenantId);
    const documents = userIds.map((userId) => ({
      tenantId: tenantObjectId,
      userId: new Types.ObjectId(userId),
      type: input.type,
      title: input.title,
      body: input.body,
      readAt: null,
      metadata: input.metadata ?? {}
    }));

    await this.notificationModel.insertMany(documents, { ordered: false });

    if (this.integrationsService) {
      void this.integrationsService.dispatchWebhooks(tenantId, 'notification.created', {
        users: userIds.length,
        type: input.type,
        title: input.title
      });
    }

    return documents.length;
  }

  async listForUser(tenantId: string, userId: string, query: ListNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<NotificationDocument> = {
      tenantId: new Types.ObjectId(tenantId),
      userId: new Types.ObjectId(userId)
    };

    if (query.unreadOnly) {
      filter.readAt = null;
    }

    const [items, total, unread] = await Promise.all([
      this.notificationModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      this.notificationModel.countDocuments(filter),
      this.notificationModel.countDocuments({
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(userId),
        readAt: null
      })
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        unread
      }
    };
  }

  async markRead(tenantId: string, userId: string, notificationId: string) {
    const updated = await this.notificationModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(notificationId),
          tenantId: new Types.ObjectId(tenantId),
          userId: new Types.ObjectId(userId)
        },
        {
          $set: {
            readAt: new Date()
          }
        },
        {
          new: true
        }
      )
      .lean();

    return {
      updated: Boolean(updated),
      notification: updated
    };
  }

  async markAllRead(tenantId: string, userId: string) {
    const result = await this.notificationModel.updateMany(
      {
        tenantId: new Types.ObjectId(tenantId),
        userId: new Types.ObjectId(userId),
        readAt: null
      },
      {
        $set: {
          readAt: new Date()
        }
      }
    );

    return {
      updated: result.modifiedCount
    };
  }
}
