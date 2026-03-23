import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface CreatedApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  plainKey: string;
}

interface ApiKeyListItem {
  _id: Types.ObjectId;
  tenantId: Types.ObjectId;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: Types.ObjectId | null;
}

@Injectable()
export class ApiKeysService {
  constructor(
    @InjectModel(ApiKey.name)
    private readonly apiKeyModel: Model<ApiKeyDocument>
  ) {}

  async create(tenantId: string, userId: string, dto: CreateApiKeyDto): Promise<CreatedApiKeyResponse> {
    const plainKey = `at_${randomBytes(20).toString('hex')}`;
    const hashedKey = this.hashKey(plainKey);
    const keyPrefix = plainKey.substring(0, 12);

    const created = await this.apiKeyModel.create({
      tenantId: new Types.ObjectId(tenantId),
      name: dto.name.trim(),
      keyPrefix,
      hashedKey,
      scopes: dto.scopes ?? [],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      createdBy: new Types.ObjectId(userId),
      revokedAt: null
    });

    return {
      id: String(created._id),
      name: created.name,
      keyPrefix: created.keyPrefix,
      scopes: created.scopes,
      expiresAt: created.expiresAt,
      plainKey
    };
  }

  async list(tenantId: string): Promise<ApiKeyListItem[]> {
    const items = await this.apiKeyModel
      .find({
        tenantId: new Types.ObjectId(tenantId)
      })
      .sort({ createdAt: -1 })
      .lean();

    return items.map((item) => ({
      _id: item._id,
      tenantId: item.tenantId,
      name: item.name,
      keyPrefix: item.keyPrefix,
      scopes: item.scopes ?? [],
      lastUsedAt: item.lastUsedAt ?? null,
      expiresAt: item.expiresAt ?? null,
      revokedAt: item.revokedAt ?? null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      createdBy: item.createdBy ?? null
    }));
  }

  async revoke(tenantId: string, keyId: string): Promise<{ revoked: boolean; key: ApiKeyListItem }> {
    const updated = await this.apiKeyModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(keyId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            revokedAt: new Date()
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('API key not found');
    }

    const key: ApiKeyListItem = {
      _id: updated._id,
      tenantId: updated.tenantId,
      name: updated.name,
      keyPrefix: updated.keyPrefix,
      scopes: updated.scopes ?? [],
      lastUsedAt: updated.lastUsedAt ?? null,
      expiresAt: updated.expiresAt ?? null,
      revokedAt: updated.revokedAt ?? null,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      createdBy: updated.createdBy ?? null
    };

    return {
      revoked: true,
      key
    };
  }

  async authenticate(plainKey: string): Promise<{ tenantId: string; scopes: string[]; keyId: string }> {
    const hashedKey = this.hashKey(plainKey);
    const now = new Date();

    const apiKey = await this.apiKeyModel.findOne({
      hashedKey,
      revokedAt: null,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    apiKey.lastUsedAt = now;
    await apiKey.save();

    return {
      tenantId: String(apiKey.tenantId),
      scopes: apiKey.scopes,
      keyId: String(apiKey._id)
    };
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }
}
