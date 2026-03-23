import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Script, ScriptSchema } from './script.schema';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';

@Module({
  imports: [MongooseModule.forFeature([{ name: Script.name, schema: ScriptSchema }])],
  controllers: [ScriptsController],
  providers: [ScriptsService],
  exports: [ScriptsService, MongooseModule]
})
export class ScriptsModule {}
