import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument, TenantPlan, TenantStatus } from './tenant.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>
  ) {}

  async findById(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantModel.findById(tenantId).lean();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantModel.findOne({ slug: slug.toLowerCase() }).lean();
  }

  async createOrUpdateTenant(input: {
    name: string;
    slug: string;
    plan?: TenantPlan;
    status?: TenantStatus;
    settings?: Record<string, unknown>;
  }): Promise<TenantDocument> {
    return this.tenantModel.findOneAndUpdate(
      { slug: input.slug.toLowerCase() },
      {
        $set: {
          name: input.name,
          slug: input.slug.toLowerCase(),
          plan: input.plan ?? TenantPlan.PRO,
          status: input.status ?? TenantStatus.ACTIVE,
          settings: input.settings ?? {}
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }
}
