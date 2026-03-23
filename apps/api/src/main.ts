import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

const bootstrapLogger = new Logger('Bootstrap');

function normalizeRoutePath(route: string): string {
  return route.replace(/^\/+|\/+$/g, '');
}

function assertProductionSecurity(configService: ConfigService): void {
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  if (nodeEnv !== 'production') {
    return;
  }

  const requiredSecrets = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET'
  ];

  const insecureDefaults = new Set([
    '',
    'change_me_access_secret',
    'change_me_refresh_secret',
    'dev_access_secret_change',
    'dev_refresh_secret_change'
  ]);

  const insecure = requiredSecrets.filter((key) => {
    const value = configService.get<string>(key, '');
    return insecureDefaults.has(value);
  });

  if (insecure.length > 0) {
    throw new Error(
      `Insecure production configuration. Configure strong values for: ${insecure.join(', ')}`
    );
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  assertProductionSecurity(configService);

  app.use(helmet());
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );

  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  app.setGlobalPrefix(apiPrefix);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Atera SaaS API')
    .setDescription('Phase 5 production-grade SaaS API')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  const docsPath = configService.get<string>('API_DOCS_PATH', 'api/docs');
  SwaggerModule.setup(docsPath, app, document);

  const port = configService.get<number>('PORT', 3001);
  const host = configService.get<string>('HOST', '0.0.0.0');
  await app.listen(port, host);

  const baseHost = host === '0.0.0.0' ? '127.0.0.1' : host;
  const baseUrl = `http://${baseHost}:${port}`;
  const healthUrl = `${baseUrl}/${normalizeRoutePath(apiPrefix)}/health`;
  const docsUrl = `${baseUrl}/${normalizeRoutePath(docsPath)}`;

  bootstrapLogger.log(`API listening on ${baseUrl}`);
  bootstrapLogger.log(`Health check available at ${healthUrl}`);
  bootstrapLogger.log(`Swagger docs available at ${docsUrl}`);
}

void bootstrap().catch((error: unknown) => {
  const stack = error instanceof Error ? error.stack : String(error);
  bootstrapLogger.error('Bootstrap failed', stack);
  process.exit(1);
});
