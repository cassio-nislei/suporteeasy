import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { ClientsService } from '../clients/clients.service';
import { Contact, ContactDocument } from './contact.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { ListContactsDto } from './dto/list-contacts.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Injectable()
export class ContactsService {
  constructor(
    @InjectModel(Contact.name)
    private readonly contactModel: Model<ContactDocument>,
    private readonly clientsService: ClientsService
  ) {}

  async create(tenantId: string, dto: CreateContactDto): Promise<Contact> {
    await this.clientsService.findById(tenantId, dto.clientId);

    const created = await this.contactModel.create({
      tenantId: new Types.ObjectId(tenantId),
      clientId: new Types.ObjectId(dto.clientId),
      name: dto.name,
      email: dto.email,
      phone: dto.phone ?? '',
      title: dto.title ?? ''
    });

    return created.toObject();
  }

  async list(tenantId: string, query: ListContactsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<ContactDocument> = {
      tenantId: new Types.ObjectId(tenantId)
    };

    if (query.clientId) {
      filter.clientId = new Types.ObjectId(query.clientId);
    }

    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
        { title: { $regex: query.search, $options: 'i' } }
      ];
    }

    const sortDirection = query.sortOrder === 'asc' ? 1 : -1;
    const sortBy = query.sortBy ?? 'createdAt';

    const [items, total] = await Promise.all([
      this.contactModel
        .find(filter)
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.contactModel.countDocuments(filter)
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

  async findById(tenantId: string, contactId: string): Promise<Contact> {
    const contact = await this.contactModel
      .findOne({
        _id: new Types.ObjectId(contactId),
        tenantId: new Types.ObjectId(tenantId)
      })
      .lean();

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return contact;
  }

  async update(tenantId: string, contactId: string, dto: UpdateContactDto): Promise<Contact> {
    if (dto.clientId) {
      await this.clientsService.findById(tenantId, dto.clientId);
    }

    const updated = await this.contactModel
      .findOneAndUpdate(
        {
          _id: new Types.ObjectId(contactId),
          tenantId: new Types.ObjectId(tenantId)
        },
        {
          $set: {
            ...(dto.clientId !== undefined ? { clientId: new Types.ObjectId(dto.clientId) } : {}),
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.email !== undefined ? { email: dto.email } : {}),
            ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
            ...(dto.title !== undefined ? { title: dto.title } : {})
          }
        },
        { new: true }
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Contact not found');
    }

    return updated;
  }

  async remove(tenantId: string, contactId: string): Promise<{ deleted: boolean }> {
    const result = await this.contactModel.deleteOne({
      _id: new Types.ObjectId(contactId),
      tenantId: new Types.ObjectId(tenantId)
    });

    return { deleted: result.deletedCount > 0 };
  }
}
