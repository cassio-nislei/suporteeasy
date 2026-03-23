import { PartialType } from '@nestjs/swagger';
import { CreatePatchPolicyDto } from './create-patch-policy.dto';

export class UpdatePatchPolicyDto extends PartialType(CreatePatchPolicyDto) {}
