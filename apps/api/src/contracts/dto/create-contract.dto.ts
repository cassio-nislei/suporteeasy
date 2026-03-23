import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ContractStatus } from '../contract.schema';

export class CreateContractDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(180)
  name!: string;

  @ApiPropertyOptional({ default: 'managed-services' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string = 'managed-services';

  @ApiPropertyOptional({ enum: ContractStatus, default: ContractStatus.DRAFT })
  @IsOptional()
  @IsIn(Object.values(ContractStatus))
  status?: ContractStatus = ContractStatus.DRAFT;

  @ApiProperty()
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyValue?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  termsMarkdown?: string = '';

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean = true;
}
