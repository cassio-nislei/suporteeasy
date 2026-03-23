import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ApiKey, ApiKeySchema } from './api-key.schema';
import { ApiKeysController } from './api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: ApiKey.name, schema: ApiKeySchema }])],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService, MongooseModule]
})
export class ApiKeysModule {}
