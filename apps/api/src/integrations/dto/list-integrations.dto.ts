import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { IntegrationType } from '../integration.schema';

export class ListIntegrationsDto {
  @ApiPropertyOptional({ enum: IntegrationType })
  @IsOptional()
  @IsIn(Object.values(IntegrationType))
  type?: IntegrationType;
}
