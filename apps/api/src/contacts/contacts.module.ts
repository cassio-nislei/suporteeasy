import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClientsModule } from '../clients/clients.module';
import { Contact, ContactSchema } from './contact.schema';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contact.name, schema: ContactSchema }]),
    ClientsModule
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService, MongooseModule]
})
export class ContactsModule {}
