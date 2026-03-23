import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeedService } from './seed.service';

async function runSeed() {
  const logger = new Logger('SeedScript');
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const seedService = app.get(SeedService);
    await seedService.run();
    logger.log('Seed script completed');
  } catch (error) {
    logger.error('Seed script failed', error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void runSeed();
