import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesModule } from '../devices/devices.module';
import { PatchManagementController } from './patch-management.controller';
import { PatchManagementService } from './patch-management.service';
import { PatchPolicy, PatchPolicySchema } from './patch-policy.schema';
import { Patch, PatchSchema } from './patch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PatchPolicy.name, schema: PatchPolicySchema },
      { name: Patch.name, schema: PatchSchema }
    ]),
    forwardRef(() => DevicesModule)
  ],
  controllers: [PatchManagementController],
  providers: [PatchManagementService],
  exports: [PatchManagementService, MongooseModule]
})
export class PatchManagementModule {}
