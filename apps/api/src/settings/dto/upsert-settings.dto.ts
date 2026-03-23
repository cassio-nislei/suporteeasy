import { ApiProperty } from '@nestjs/swagger';
import { IsObject, IsString, MaxLength } from 'class-validator';

export class UpsertSettingsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  key!: string;

  @ApiProperty({
    type: Object
  })
  @IsObject()
  value!: Record<string, unknown>;
}
