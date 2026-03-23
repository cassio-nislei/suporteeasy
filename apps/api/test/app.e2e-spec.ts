import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

process.env.DISABLE_QUEUES = 'true';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { MongoMemoryServer } = require('mongodb-memory-server');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { AppModule } = require('../src/app.module');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SeedService } = require('../src/seeds/seed.service');

describe('Auth and Tenant Foundation (e2e)', () => {
  jest.setTimeout(180000);

  let app: INestApplication | undefined;
  let mongoServer: { getUri(dbName?: string): string; stop(): Promise<void> } | undefined;
  const externalMongoUri = process.env.TEST_MONGODB_URI;
  let accessToken: string;
  let portalAccessToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';

    if (externalMongoUri) {
      process.env.MONGODB_URI = externalMongoUri;
    } else {
      mongoServer = await MongoMemoryServer.create();
      process.env.MONGODB_URI = mongoServer!.getUri('atera_phase1_test');
    }

    process.env.REDIS_HOST = '127.0.0.1';
    process.env.REDIS_PORT = '6379';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret';
    process.env.JWT_ACCESS_EXPIRES_IN = '15m';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret';
    process.env.JWT_REFRESH_EXPIRES_IN = '7d';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const seedService = app.get(SeedService);
    await seedService.run();
  });

  afterAll(async () => {
    if (app) {
      await app.close().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('MongoClientClosedError')) {
          throw error;
        }
      });
    }

    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('basic auth test: should login and return access/refresh tokens', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'owner@acme.local',
        password: 'ChangeMe@123'
      })
      .expect(201);

    expect(response.body.tokens.accessToken).toBeDefined();
    expect(response.body.tokens.refreshToken).toBeDefined();
    expect(response.body.user.email).toBe('owner@acme.local');

    accessToken = response.body.tokens.accessToken;
  });

  it('me endpoint test: should return current authenticated user', async () => {
    const response = await request(app!.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(response.body.email).toBe('owner@acme.local');
    expect(response.body.tenant).toBeDefined();
    expect(response.body.permissions).toContain('users:read');
  });

  it('tenant isolation test: should reject mismatched x-tenant-id header', async () => {
    await request(app!.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('x-tenant-id', '65c4ee27f0f2de58a5b10f30')
      .expect(403);
  });

  it('phase 4 script execution test: should create script and enqueue execution', async () => {
    const createScriptResponse = await request(app!.getHttpServer())
      .post('/api/v1/scripts')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `E2E Script ${Date.now()}`,
        description: 'E2E script from automated test',
        category: 'test',
        platform: 'powershell',
        body: "Write-Output 'E2E script test'",
        enabled: true
      })
      .expect(201);

    const scriptId = createScriptResponse.body._id as string;
    expect(scriptId).toBeDefined();

    const devicesResponse = await request(app!.getHttpServer())
      .get('/api/v1/devices?page=1&limit=1')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const deviceId = devicesResponse.body.items?.[0]?._id as string | undefined;
    expect(deviceId).toBeDefined();

    const executionResponse = await request(app!.getHttpServer())
      .post('/api/v1/script-executions/run')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        scriptId,
        deviceId
      })
      .expect(201);

    expect(executionResponse.body._id).toBeDefined();
    expect(['running', 'failed', 'queued']).toContain(executionResponse.body.status);
  });

  it('phase 5 api keys test: should create tenant api key', async () => {
    const response = await request(app!.getHttpServer())
      .post('/api/v1/api-keys')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: `E2E Key ${Date.now()}`,
        scopes: ['reports:read', 'devices:read']
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    expect(response.body.plainKey).toBeDefined();
    expect(response.body.scopes).toContain('reports:read');
  });

  it('phase 5 customer portal test: should login and create/list own ticket', async () => {
    const loginResponse = await request(app!.getHttpServer())
      .post('/api/v1/customer-portal/auth/login')
      .send({
        email: 'portal@acme.local',
        password: 'ChangeMe@123'
      })
      .expect(201);

    expect(loginResponse.body.user.email).toBe('portal@acme.local');
    expect(loginResponse.body.user.isPortalUser).toBe(true);
    portalAccessToken = loginResponse.body.tokens.accessToken;

    const createResponse = await request(app!.getHttpServer())
      .post('/api/v1/customer-portal/tickets')
      .set('Authorization', `Bearer ${portalAccessToken}`)
      .send({
        subject: `Portal issue ${Date.now()}`,
        description: 'E2E portal ticket flow validation',
        priority: 'medium'
      })
      .expect(201);

    expect(createResponse.body._id).toBeDefined();
    expect(createResponse.body.source).toBe('portal');

    const listResponse = await request(app!.getHttpServer())
      .get('/api/v1/customer-portal/tickets?page=1&limit=20')
      .set('Authorization', `Bearer ${portalAccessToken}`)
      .expect(200);

    const createdTicketId = createResponse.body._id as string;
    const found = (listResponse.body.items as Array<{ _id: string }>).some(
      (ticket) => ticket._id === createdTicketId
    );
    expect(found).toBe(true);
  });
});
