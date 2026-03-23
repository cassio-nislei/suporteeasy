import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { ContractsService } from '../contracts/contracts.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';
import { ListSubscriptionsDto } from './dto/list-subscriptions.dto';
import { MonthlySummaryDto } from './dto/monthly-summary.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Invoice, InvoiceDocument, InvoiceStatus } from './invoice.schema';
import { Subscription, SubscriptionDocument, SubscriptionStatus } from './subscription.schema';

@Injectable()
export class BillingService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Subscription.name)
    private readonly subscriptionModel: Model<SubscriptionDocument>,
    private readonly clientsService: ClientsService,
    private readonly contractsService: ContractsService
  ) {}

  async createInvoice(tenantId: string, dto: CreateInvoiceDto) {
    await this.clientsService.findById(tenantId, dto.clientId);
    const contractId = await this.resolveContractObjectId(tenantId, dto.contractId);

    const subtotal = dto.subtotal ?? 0;
    const tax = dto.tax ?? 0;
    const total = dto.total ?? subtotal + tax;

    const created = await this.invoiceModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(dto.clientId),
      contractId,
      number: dto.number.trim(),
      status: dto.status ?? InvoiceStatus.DRAFT,
      issueDate: new Date(dto.issueDate),
      dueDate: new Date(dto.dueDate),
      currency: dto.currency ?? 'USD',
      subtotal,
      tax,
      total,
      paidAt: dto.paidAt ? new Date(dto.paidAt) : null
    });

    return this.findInvoiceById(tenantId, String(created._id));
  }

  async listInvoices(tenantId: string, query: ListInvoicesDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'issueDate';

    const filter: FilterQuery<InvoiceDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      filter.$or = [{ number: { $regex: query.search, $options: 'i' } }];
    }

    const [items, total] = await Promise.all([
      this.invoiceModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .populate({ path: 'contractId', select: 'name status type monthlyValue' })
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.invoiceModel.countDocuments(filter)
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

  async findInvoiceById(tenantId: string, invoiceId: string) {
    const invoice = await this.invoiceModel
      .findOne({
        _id: new Types.ObjectId(invoiceId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'contractId', select: 'name status type monthlyValue' })
      .lean();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice;
  }

  async updateInvoice(tenantId: string, invoiceId: string, dto: UpdateInvoiceDto) {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const contractId =
      dto.contractId !== undefined
        ? await this.resolveContractObjectId(tenantId, dto.contractId)
        : undefined;

    const updated = await this.invoiceModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(invoiceId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.clientId !== undefined ? { clientId: new Types.ObjectId(dto.clientId) } : {}),
            ...(dto.contractId !== undefined ? { contractId } : {}),
            ...(dto.number !== undefined ? { number: dto.number.trim() } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.issueDate !== undefined ? { issueDate: new Date(dto.issueDate) } : {}),
            ...(dto.dueDate !== undefined ? { dueDate: new Date(dto.dueDate) } : {}),
            ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
            ...(dto.subtotal !== undefined ? { subtotal: dto.subtotal } : {}),
            ...(dto.tax !== undefined ? { tax: dto.tax } : {}),
            ...(dto.total !== undefined ? { total: dto.total } : {}),
            ...(dto.paidAt !== undefined ? { paidAt: dto.paidAt ? new Date(dto.paidAt) : null } : {})
          }
        },
        { new: true }
      )
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'contractId', select: 'name status type monthlyValue' })
      .lean();

    if (!updated) {
      throw new NotFoundException('Invoice not found');
    }

    return updated;
  }

  async createSubscription(tenantId: string, dto: CreateSubscriptionDto) {
    await this.clientsService.findById(tenantId, dto.clientId);
    const contractId = await this.resolveContractObjectId(tenantId, dto.contractId);

    const created = await this.subscriptionModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(dto.clientId),
      contractId,
      planName: dto.planName.trim(),
      status: dto.status ?? SubscriptionStatus.ACTIVE,
      monthlyPrice: dto.monthlyPrice ?? 0,
      startedAt: new Date(dto.startedAt),
      canceledAt: dto.canceledAt ? new Date(dto.canceledAt) : null
    });

    return this.findSubscriptionById(tenantId, String(created._id));
  }

  async listSubscriptions(tenantId: string, query: ListSubscriptionsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<SubscriptionDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.status) {
      filter.status = query.status;
    }

    const [items, total] = await Promise.all([
      this.subscriptionModel
        .find(filter)
        .populate({ path: 'clientId', select: 'name status' })
        .populate({ path: 'contractId', select: 'name status type monthlyValue' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.subscriptionModel.countDocuments(filter)
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

  async findSubscriptionById(tenantId: string, subscriptionId: string) {
    const subscription = await this.subscriptionModel
      .findOne({
        _id: new Types.ObjectId(subscriptionId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'contractId', select: 'name status type monthlyValue' })
      .lean();

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async updateSubscription(tenantId: string, subscriptionId: string, dto: UpdateSubscriptionDto) {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const contractId =
      dto.contractId !== undefined
        ? await this.resolveContractObjectId(tenantId, dto.contractId)
        : undefined;

    const updated = await this.subscriptionModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(subscriptionId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.clientId !== undefined ? { clientId: new Types.ObjectId(dto.clientId) } : {}),
            ...(dto.contractId !== undefined ? { contractId } : {}),
            ...(dto.planName !== undefined ? { planName: dto.planName.trim() } : {}),
            ...(dto.status !== undefined ? { status: dto.status } : {}),
            ...(dto.monthlyPrice !== undefined ? { monthlyPrice: dto.monthlyPrice } : {}),
            ...(dto.startedAt !== undefined ? { startedAt: new Date(dto.startedAt) } : {}),
            ...(dto.canceledAt !== undefined
              ? { canceledAt: dto.canceledAt ? new Date(dto.canceledAt) : null }
              : {})
          }
        },
        { new: true }
      )
      .populate({ path: 'clientId', select: 'name status' })
      .populate({ path: 'contractId', select: 'name status type monthlyValue' })
      .lean();

    if (!updated) {
      throw new NotFoundException('Subscription not found');
    }

    return updated;
  }

  async monthlySummary(tenantId: string, query: MonthlySummaryDto) {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const filter = {
      tenantId: new Types.ObjectId(tenantId),
      issueDate: {
        $gte: monthStart,
        $lt: monthEnd
      }
    };

    const [invoices, activeSubscriptions] = await Promise.all([
      this.invoiceModel.find(filter).lean(),
      this.subscriptionModel
        .find({
          tenantId: new Types.ObjectId(tenantId),
          status: SubscriptionStatus.ACTIVE
        })
        .lean()
    ]);

    const totals = invoices.reduce(
      (acc, invoice) => {
        acc.total += invoice.total;
        if (invoice.status === InvoiceStatus.PAID) {
          acc.paid += invoice.total;
        } else if (invoice.status !== InvoiceStatus.VOID) {
          acc.outstanding += invoice.total;
        }
        return acc;
      },
      { total: 0, paid: 0, outstanding: 0 }
    );

    const recurringMonthly = activeSubscriptions.reduce((acc, subscription) => {
      return acc + subscription.monthlyPrice;
    }, 0);

    return {
      period: {
        year,
        month,
        start: monthStart.toISOString(),
        end: monthEnd.toISOString()
      },
      invoices: {
        count: invoices.length,
        totalBilled: Number(totals.total.toFixed(2)),
        paid: Number(totals.paid.toFixed(2)),
        outstanding: Number(totals.outstanding.toFixed(2))
      },
      subscriptions: {
        active: activeSubscriptions.length,
        recurringMonthly: Number(recurringMonthly.toFixed(2))
      },
      revenue: {
        recognized: Number(totals.paid.toFixed(2)),
        projected: Number((totals.total + recurringMonthly).toFixed(2))
      }
    };
  }

  private async resolveContractObjectId(
    tenantId: string,
    contractId?: string
  ): Promise<Types.ObjectId | null> {
    if (!contractId) {
      return null;
    }

    await this.contractsService.findById(tenantId, contractId);
    return new Types.ObjectId(contractId);
  }
}
