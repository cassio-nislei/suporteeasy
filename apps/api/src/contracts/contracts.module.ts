import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { Contract, ContractSchema } from './contract.schema';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }]),
    ClientsModule
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService, MongooseModule]
})
export class ContractsModule {}
