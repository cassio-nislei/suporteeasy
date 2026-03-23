import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { InvoiceStatus } from '../invoice.schema';

export class ListInvoicesDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  clientId?: string;

  @ApiPropertyOptional({ enum: InvoiceStatus })
  @IsOptional()
  @IsIn(Object.values(InvoiceStatus))
  status?: InvoiceStatus;

  @ApiPropertyOptional({ default: 'issueDate', enum: ['issueDate', 'dueDate', 'createdAt', 'total'] })
  @IsOptional()
  @IsIn(['issueDate', 'dueDate', 'createdAt', 'total'])
  sortBy?: 'issueDate' | 'dueDate' | 'createdAt' | 'total' = 'issueDate';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
