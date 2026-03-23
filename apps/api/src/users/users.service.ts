import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserStatus } from './user.schema';

export interface CreateUserInput {
  tenantId: Types.ObjectId | null;
  email: string;
  passwordHash: string;
  roleIds: Types.ObjectId[];
  status?: UserStatus;
  emailVerifiedAt?: Date | null;
  isPortalUser?: boolean;
  portalClientIds?: Types.ObjectId[];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  async createOrUpdateByEmail(input: CreateUserInput): Promise<UserDocument> {
    return this.userModel.findOneAndUpdate(
      { email: input.email.toLowerCase() },
      {
        $set: {
          tenantId: input.tenantId,
          email: input.email.toLowerCase(),
          passwordHash: input.passwordHash,
          roleIds: input.roleIds,
          status: input.status ?? UserStatus.ACTIVE,
          emailVerifiedAt: input.emailVerifiedAt ?? null,
          isPortalUser: input.isPortalUser ?? false,
          portalClientIds: input.portalClientIds ?? []
        }
      },
      {
        upsert: true,
        new: true
      }
    );
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId);
  }

  async findLeanById(userId: string): Promise<User | null> {
    return this.userModel.findById(userId).lean();
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return this.userModel.find({ tenantId: new Types.ObjectId(tenantId) }).sort({ email: 1 }).lean();
  }

  async updateLastLoginAt(userId: string): Promise<void> {
    await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { lastLoginAt: new Date() } });
  }

  async storeRefreshTokenHash(userId: string, refreshTokenHash: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          refreshTokenHash
        }
      }
    );
  }

  async clearRefreshTokenHash(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          refreshTokenHash: null
        }
      }
    );
  }

  async setResetPasswordToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          resetPasswordTokenHash: tokenHash,
          resetPasswordExpiresAt: expiresAt
        }
      }
    );
  }

  async resetPasswordByTokenHash(tokenHash: string, newPasswordHash: string): Promise<boolean> {
    const now = new Date();

    const result = await this.userModel.updateOne(
      {
        resetPasswordTokenHash: tokenHash,
        resetPasswordExpiresAt: { $gt: now }
      },
      {
        $set: {
          passwordHash: newPasswordHash,
          resetPasswordTokenHash: null,
          resetPasswordExpiresAt: null,
          status: UserStatus.ACTIVE
        }
      }
    );

    return result.modifiedCount > 0;
  }

  async setEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.userModel.updateOne(
      { _id: new Types.ObjectId(userId) },
      {
        $set: {
          emailVerificationTokenHash: tokenHash,
          emailVerificationExpiresAt: expiresAt
        }
      }
    );
  }

  async verifyEmailByTokenHash(tokenHash: string): Promise<UserDocument | null> {
    const now = new Date();

    return this.userModel.findOneAndUpdate(
      {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: { $gt: now }
      },
      {
        $set: {
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
          emailVerifiedAt: new Date(),
          status: UserStatus.ACTIVE
        }
      },
      {
        new: true
      }
    );
  }

  async ensureExists(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
