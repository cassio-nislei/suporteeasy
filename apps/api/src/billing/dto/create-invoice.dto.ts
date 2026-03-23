import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { InvoiceStatus } from '../invoice.schema';

export class CreateInvoiceDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contractId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  number!: string;

  @ApiPropertyOptional({ enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus = InvoiceStatus.DRAFT;

  @ApiProperty()
  @IsDateString()
  issueDate!: string;

  @ApiProperty()
  @IsDateString()
  dueDate!: string;

  @ApiPropertyOptional({ default: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  currency?: string = 'USD';

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  subtotal?: number = 0;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  total?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
