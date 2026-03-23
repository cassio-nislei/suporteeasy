import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { SubscriptionStatus } from '../subscription.schema';

export class CreateSubscriptionDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  planName!: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus, default: SubscriptionStatus.ACTIVE })
  @IsOptional()
  @IsIn(Object.values(SubscriptionStatus))
  status?: SubscriptionStatus = SubscriptionStatus.ACTIVE;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyPrice?: number = 0;

  @ApiProperty()
  @IsDateString()
  startedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  canceledAt?: string;
}
