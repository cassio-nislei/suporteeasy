import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class TestWebhookDto {
  @ApiProperty()
  @IsString()
  event!: string;

  @ApiProperty({ type: Object, required: false })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
