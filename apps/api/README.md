# API - NestJS (Phase 5)

## Swagger

- URL: `http://localhost:3001/api/docs`

## Core Modules

- auth
- tenants
- users
- roles
- permissions
- clients
- contacts
- devices
- device-groups
- agents
- monitoring
- dashboards
- alerts
- tickets
- sla
- notifications
- scripts
- script-executions
- automations
- jobs
- audit
- health
- seeds

## Phase 5 Modules

- knowledge-base
- contracts
- billing
- reports
- customer-portal
- patch-management
- remote-access
- integrations
- settings
- api-keys

## Key Phase 5 Endpoints

Knowledge base:

- `GET/POST /api/v1/knowledge-base/articles`
- `GET/PATCH/DELETE /api/v1/knowledge-base/articles/:articleId`

Contracts:

- `GET/POST /api/v1/contracts`
- `GET/PATCH/DELETE /api/v1/contracts/:contractId`

Billing:

- `GET/POST /api/v1/billing/invoices`
- `GET/PATCH /api/v1/billing/invoices/:invoiceId`
- `GET/POST /api/v1/billing/subscriptions`
- `GET/PATCH /api/v1/billing/subscriptions/:subscriptionId`
- `GET /api/v1/billing/summary/monthly`

Reports (JSON + CSV via `format=csv`):

- `GET /api/v1/reports/tickets-by-period`
- `GET /api/v1/reports/alerts-by-severity`
- `GET /api/v1/reports/assets-by-client`
- `GET /api/v1/reports/sla-compliance`
- `GET /api/v1/reports/script-execution-stats`
- `GET /api/v1/reports/revenue-summary`

Audit logs:

- `GET /api/v1/audit/logs`

Customer portal:

- `POST /api/v1/customer-portal/auth/login`
- `GET /api/v1/customer-portal/me`
- `GET/POST /api/v1/customer-portal/tickets`
- `GET /api/v1/customer-portal/tickets/:ticketId`
- `GET/POST /api/v1/customer-portal/tickets/:ticketId/comments`

Patch management:

- `GET/POST /api/v1/patch-management/policies`
- `PATCH/DELETE /api/v1/patch-management/policies/:policyId`
- `POST /api/v1/patch-management/patches/simulate-scan`
- `GET /api/v1/patch-management/patches`
- `GET /api/v1/patch-management/patches/:patchId`
- `POST /api/v1/patch-management/patches/:patchId/approve`
- `POST /api/v1/patch-management/patches/:patchId/schedule`
- `POST /api/v1/patch-management/patches/:patchId/execute`

Remote access:

- `GET/POST /api/v1/remote-access/sessions`
- `GET /api/v1/remote-access/sessions/:sessionId`
- `POST /api/v1/remote-access/sessions/:sessionId/start`
- `POST /api/v1/remote-access/sessions/:sessionId/end`

Integrations:

- `GET/POST /api/v1/integrations`
- `GET/PATCH/DELETE /api/v1/integrations/:integrationId`
- `POST /api/v1/integrations/test/webhook`
- `POST /api/v1/integrations/test/email`

Settings:

- `GET /api/v1/settings`
- `GET /api/v1/settings/:key`
- `POST /api/v1/settings`

API keys:

- `GET/POST /api/v1/api-keys`
- `POST /api/v1/api-keys/:keyId/revoke`

## Seed

```powershell
$env:MONGODB_URI='mongodb://admin:Ncm%40647534@104.234.173.105:27017/atera?authSource=admin'; $env:DISABLE_QUEUES='true'; npm run seed
```

Seed creates:

- users/roles/permissions (including portal role)
- clients/contacts/devices/agents/monitoring
- alerts/tickets/sla/notifications
- scripts/automations/executions/logs
- knowledge base articles
- contracts/invoices/subscriptions
- patch policies and patch samples
- remote sessions samples
- integrations/settings/api keys

## Build/Test

```powershell
npm run build
$env:TEST_MONGODB_URI='mongodb://admin:Ncm%40647534@104.234.173.105:27017/atera_phase5_test?authSource=admin'; npm run test:e2e
```

## Run Local

```powershell
Copy-Item .env.example .env -Force
npm install
$env:MONGODB_URI='mongodb://admin:Ncm%40647534@104.234.173.105:27017/atera?authSource=admin'; $env:DISABLE_QUEUES='false'; $env:REDIS_HOST='127.0.0.1'; $env:REDIS_PORT='6379'; npm run start:dev
```

## Environment

Required:

- `MONGODB_URI`
- `REDIS_HOST`
- `REDIS_PORT`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Optional:

- `DISABLE_QUEUES=true|false`
- `MONITORING_RECONCILE_ENABLED=true|false`
- `DEVICE_OFFLINE_THRESHOLD_SECONDS=90`
- `HEARTBEAT_TIMEOUT_CHECK_INTERVAL_MS=30000`
