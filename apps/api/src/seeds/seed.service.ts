import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcryptjs';
import { Model, Types } from 'mongoose';
import { ApiKeysService } from '../api-keys/api-keys.service';
import { AgentsService } from '../agents/agents.service';
import { AlertsService } from '../alerts/alerts.service';
import {
  AlertConditionOperator,
  AlertDeviceStatus,
  AlertRuleTargetType,
  AlertSeverity
} from '../alerts/alert-rule.schema';
import { AlertStatus } from '../alerts/alert.schema';
import { BillingService } from '../billing/billing.service';
import { InvoiceStatus } from '../billing/invoice.schema';
import { SubscriptionStatus } from '../billing/subscription.schema';
import { AutomationLog, AutomationLogDocument, AutomationLogStatus } from '../automations/automation-log.schema';
import { AutomationActionType, AutomationTrigger } from '../automations/automation.schema';
import { AutomationsService } from '../automations/automations.service';
import { ClientStatus } from '../clients/client.schema';
import { ClientsService } from '../clients/clients.service';
import { ContactsService } from '../contacts/contacts.service';
import { ContractStatus } from '../contracts/contract.schema';
import { ContractsService } from '../contracts/contracts.service';
import { DeviceOnlineStatus } from '../devices/device.schema';
import { DevicesService } from '../devices/devices.service';
import { IntegrationType } from '../integrations/integration.schema';
import { IntegrationsService } from '../integrations/integrations.service';
import { ArticleVisibility } from '../knowledge-base/knowledge-base-article.schema';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { Metric, MetricDocument } from '../monitoring/metric.schema';
import { MonitoringService } from '../monitoring/monitoring.service';
import { PatchManagementService } from '../patch-management/patch-management.service';
import { Permission } from '../permissions/permission.schema';
import { PermissionsService } from '../permissions/permissions.service';
import { RemoteAccessService } from '../remote-access/remote-access.service';
import { RolesService } from '../roles/roles.service';
import {
  ScriptExecution,
  ScriptExecutionDocument,
  ScriptExecutionStatus
} from '../script-executions/script-execution.schema';
import { ScriptPlatform } from '../scripts/script.schema';
import { ScriptsService } from '../scripts/scripts.service';
import { SettingsService } from '../settings/settings.service';
import { SlaEscalationTrigger } from '../sla/sla-policy.schema';
import { SlaService } from '../sla/sla.service';
import { TicketCommentVisibility } from '../tickets/ticket-comment.schema';
import { TicketPriority, TicketSource, TicketStatus } from '../tickets/ticket.schema';
import { TicketsService } from '../tickets/tickets.service';
import { TenantsService } from '../tenants/tenants.service';
import { TenantPlan, TenantStatus } from '../tenants/tenant.schema';
import { UserStatus } from '../users/user.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly rolesService: RolesService,
    private readonly tenantsService: TenantsService,
    private readonly usersService: UsersService,
    private readonly clientsService: ClientsService,
    private readonly contactsService: ContactsService,
    private readonly devicesService: DevicesService,
    private readonly agentsService: AgentsService,
    private readonly monitoringService: MonitoringService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly contractsService: ContractsService,
    private readonly billingService: BillingService,
    private readonly patchManagementService: PatchManagementService,
    private readonly remoteAccessService: RemoteAccessService,
    private readonly integrationsService: IntegrationsService,
    private readonly settingsService: SettingsService,
    private readonly apiKeysService: ApiKeysService,
    private readonly slaService: SlaService,
    private readonly alertsService: AlertsService,
    private readonly ticketsService: TicketsService,
    private readonly scriptsService: ScriptsService,
    private readonly automationsService: AutomationsService,
    @InjectModel(Metric.name)
    private readonly metricModel: Model<MetricDocument>,
    @InjectModel(ScriptExecution.name)
    private readonly scriptExecutionModel: Model<ScriptExecutionDocument>,
    @InjectModel(AutomationLog.name)
    private readonly automationLogModel: Model<AutomationLogDocument>
  ) {}

  async run(): Promise<void> {
    this.logger.log('Starting seed process');

    await this.permissionsService.upsertMany(this.permissionSeedData());
    const permissions = await this.permissionsService.findAll();
    const permissionByKey = new Map(permissions.map((permission) => [permission.key, permission]));

    const tenant = await this.tenantsService.createOrUpdateTenant({
      name: 'Acme Managed Services',
      slug: 'acme-demo',
      plan: TenantPlan.PRO,
      status: TenantStatus.ACTIVE,
      settings: {
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR'
      }
    });

    const superAdminRole = await this.rolesService.upsertRole({
      tenantId: null,
      slug: 'super-admin',
      name: 'Super Admin',
      description: 'Platform-wide super administrator',
      permissionIds: [permissionByKey.get('*')!._id],
      isSystem: true
    });

    const ownerRole = await this.rolesService.upsertRole({
      tenantId: tenant._id,
      slug: 'tenant-owner',
      name: 'Tenant Owner',
      description: 'Tenant owner with full tenant access',
      permissionIds: this.mapPermissionIds(permissionByKey, [
        'dashboard:read',
        'users:read',
        'users:write',
        'roles:read',
        'roles:write',
        'permissions:read',
        'tenants:read',
        'clients:read',
        'clients:write',
        'contacts:read',
        'contacts:write',
        'devices:read',
        'devices:write',
        'agents:write',
        'monitoring:ingest',
        'device-groups:read',
        'device-groups:write',
        'alerts:read',
        'alerts:write',
        'tickets:read',
        'tickets:write',
        'sla:read',
        'sla:write',
        'notifications:read',
        'scripts:read',
        'scripts:write',
        'automations:read',
        'automations:write',
        'knowledge-base:read',
        'knowledge-base:write',
        'contracts:read',
        'contracts:write',
        'billing:read',
        'billing:write',
        'reports:read',
        'audit:read',
        'patch-management:read',
        'patch-management:write',
        'remote-access:read',
        'remote-access:write',
        'integrations:read',
        'integrations:write',
        'settings:read',
        'settings:write',
        'api-keys:read',
        'api-keys:write'
      ]),
      isSystem: true
    });

    const adminRole = await this.rolesService.upsertRole({
      tenantId: tenant._id,
      slug: 'tenant-admin',
      name: 'Tenant Admin',
      description: 'Tenant administrator',
      permissionIds: this.mapPermissionIds(permissionByKey, [
        'dashboard:read',
        'users:read',
        'roles:read',
        'permissions:read',
        'clients:read',
        'clients:write',
        'contacts:read',
        'contacts:write',
        'devices:read',
        'devices:write',
        'agents:write',
        'device-groups:read',
        'alerts:read',
        'alerts:write',
        'tickets:read',
        'tickets:write',
        'sla:read',
        'notifications:read',
        'scripts:read',
        'scripts:write',
        'automations:read',
        'automations:write',
        'knowledge-base:read',
        'knowledge-base:write',
        'contracts:read',
        'contracts:write',
        'billing:read',
        'billing:write',
        'reports:read',
        'audit:read',
        'patch-management:read',
        'patch-management:write',
        'remote-access:read',
        'remote-access:write',
        'integrations:read',
        'integrations:write',
        'settings:read',
        'settings:write',
        'api-keys:read',
        'api-keys:write'
      ]),
      isSystem: true
    });

    const technicianRole = await this.rolesService.upsertRole({
      tenantId: tenant._id,
      slug: 'technician',
      name: 'Technician',
      description: 'Operational technician role',
      permissionIds: this.mapPermissionIds(permissionByKey, [
        'dashboard:read',
        'clients:read',
        'contacts:read',
        'devices:read',
        'monitoring:ingest',
        'device-groups:read',
        'alerts:read',
        'alerts:write',
        'tickets:read',
        'tickets:write',
        'notifications:read',
        'scripts:read',
        'scripts:write',
        'automations:read',
        'knowledge-base:read',
        'contracts:read',
        'billing:read',
        'reports:read',
        'patch-management:read',
        'patch-management:write',
        'remote-access:read',
        'remote-access:write'
      ]),
      isSystem: true
    });

    const portalCustomerRole = await this.rolesService.upsertRole({
      tenantId: tenant._id,
      slug: 'portal-customer',
      name: 'Portal Customer',
      description: 'Customer portal user with limited ticket access',
      permissionIds: this.mapPermissionIds(permissionByKey, [
        'portal:access',
        'portal:tickets:read',
        'portal:tickets:write',
        'knowledge-base:read'
      ]),
      isSystem: true
    });

    const tenantId = String(tenant._id);

    const clients = await this.seedClients(tenantId);
    await this.createDemoUsers({
      tenantId: tenant._id,
      superAdminRoleId: superAdminRole._id,
      ownerRoleId: ownerRole._id,
      adminRoleId: adminRole._id,
      technicianRoleId: technicianRole._id,
      portalRoleId: portalCustomerRole._id,
      portalClientId: clients[0]?._id ? String(clients[0]._id) : null
    });
    await this.seedContacts(tenantId, clients.map((client) => String(client._id)));
    const devices = await this.seedDevices(tenantId, clients.map((client) => String(client._id)));
    await this.seedAgentsAndMonitoring(tenantId, devices.map((device) => String(device._id)));

    await this.seedSlaPolicies(tenantId, clients.map((client) => String(client._id)));
    await this.seedAlertsAndTickets(tenantId, devices.map((device) => String(device._id)));
    await this.seedScriptsAndAutomations(tenantId, devices.map((device) => String(device._id)));
    await this.seedKnowledgeBase(tenantId);
    await this.seedContractsAndBilling(tenantId, clients.map((client) => String(client._id)));
    await this.seedPatchManagement(tenantId, devices.map((device) => String(device._id)));
    await this.seedRemoteAccess(tenantId, devices.map((device) => String(device._id)));
    await this.seedIntegrationsSettingsAndApiKeys(tenantId);

    this.logger.log('Seed completed successfully');
  }

  private async seedClients(tenantId: string) {
    const clients = [
      'Contoso Finance',
      'Globex Health',
      'Initech Retail',
      'Umbrella Logistics',
      'Wayne Manufacturing'
    ];

    const result = [];

    for (const [index, name] of clients.entries()) {
      const created = await this.clientsService.create(tenantId, {
        name,
        status: index === 4 ? ClientStatus.INACTIVE : ClientStatus.ACTIVE,
        tags: ['seed', index % 2 === 0 ? 'priority' : 'standard'],
        notes: `Seeded client ${name}`
      });

      result.push(created);
    }

    return result;
  }

  private async seedContacts(tenantId: string, clientIds: string[]) {
    const contacts = [
      { name: 'Ana Martins', title: 'IT Manager' },
      { name: 'Bruno Costa', title: 'Operations Lead' },
      { name: 'Carla Souza', title: 'CFO' },
      { name: 'Daniel Lima', title: 'Security Officer' },
      { name: 'Eduarda Nunes', title: 'Support Coordinator' },
      { name: 'Felipe Rocha', title: 'Infrastructure Analyst' },
      { name: 'Gabriela Alves', title: 'Procurement' },
      { name: 'Henrique Melo', title: 'Regional Director' },
      { name: 'Isabela Freitas', title: 'Service Desk Manager' },
      { name: 'Joao Pires', title: 'Technical Specialist' }
    ];

    for (let index = 0; index < contacts.length; index++) {
      const contact = contacts[index];
      const clientId = clientIds[index % clientIds.length];

      await this.contactsService.create(tenantId, {
        clientId,
        name: contact.name,
        email: `contact${index + 1}@acme.local`,
        phone: `+55 11 4000-${String(1000 + index)}`,
        title: contact.title
      });
    }
  }

  private async seedDevices(tenantId: string, clientIds: string[]) {
    const devices = [];

    for (let index = 0; index < 50; index++) {
      const device = await this.devicesService.create(tenantId, {
        clientId: clientIds[index % clientIds.length],
        hostname: `acme-device-${String(index + 1).padStart(3, '0')}`,
        ipAddress: `10.20.${Math.floor(index / 10)}.${(index % 10) + 10}`,
        os: index % 3 === 0 ? 'Windows Server 2022' : index % 3 === 1 ? 'Ubuntu 22.04' : 'Windows 11 Pro',
        tags: [index % 2 === 0 ? 'production' : 'office', index % 5 === 0 ? 'critical' : 'normal'],
        notes: `Seeded device #${index + 1}`,
        inventory: {
          cpuModel: index % 2 === 0 ? 'Intel Xeon Silver' : 'AMD EPYC',
          cpuCores: index % 4 === 0 ? 16 : 8,
          ramGb: index % 4 === 0 ? 64 : 32,
          diskGb: index % 3 === 0 ? 1000 : 512,
          serialNumber: `SN-ACME-${String(index + 1).padStart(6, '0')}`,
          services: ['nginx', 'backup-agent', 'security-agent']
        }
      });

      devices.push(device);
    }

    return devices;
  }

  private async seedAgentsAndMonitoring(tenantId: string, deviceIds: string[]) {
    const now = Date.now();
    const metricsToInsert: Array<{
      tenantId: Types.ObjectId;
      deviceId: Types.ObjectId;
      type: string;
      value: number;
      unit: string;
      timestamp: Date;
    }> = [];

    for (let index = 0; index < deviceIds.length; index++) {
      const deviceId = deviceIds[index];
      const isOnline = index < 28;
      const heartbeatAgoMs = isOnline
        ? Math.floor(Math.random() * 45_000)
        : 2 * 60 * 60 * 1000 + Math.floor(Math.random() * 2 * 60 * 60 * 1000);

      await this.devicesService.setOnlineStatus(
        tenantId,
        deviceId,
        isOnline ? DeviceOnlineStatus.ONLINE : DeviceOnlineStatus.OFFLINE,
        new Date(now - heartbeatAgoMs)
      );

      const registration = await this.agentsService.register(tenantId, {
        deviceId,
        version: isOnline ? '2.1.0' : '2.0.5'
      });

      if (isOnline) {
        await this.monitoringService.processHeartbeat({
          agentToken: registration.token,
          status: 'online',
          services: [
            { name: 'backup-agent', status: 'running' },
            { name: 'security-agent', status: index % 7 === 0 ? 'degraded' : 'running' }
          ]
        });
      } else {
        await this.monitoringService.processHeartbeat({
          agentToken: registration.token,
          status: 'offline',
          services: [
            { name: 'backup-agent', status: 'stopped' },
            { name: 'security-agent', status: 'stopped' }
          ]
        });
      }

      for (let point = 0; point < 24; point++) {
        const timestamp = new Date(now - (24 - point) * 15 * 60 * 1000);
        metricsToInsert.push(
          {
            tenantId: new Types.ObjectId(tenantId),
            deviceId: new Types.ObjectId(deviceId),
            type: 'cpu',
            value: this.randomBetween(isOnline ? 25 : 5, isOnline ? 90 : 20),
            unit: '%',
            timestamp
          },
          {
            tenantId: new Types.ObjectId(tenantId),
            deviceId: new Types.ObjectId(deviceId),
            type: 'ram',
            value: this.randomBetween(isOnline ? 35 : 10, isOnline ? 92 : 40),
            unit: '%',
            timestamp
          },
          {
            tenantId: new Types.ObjectId(tenantId),
            deviceId: new Types.ObjectId(deviceId),
            type: 'disk',
            value: this.randomBetween(40, 88),
            unit: '%',
            timestamp
          }
        );
      }

      await this.monitoringService.recordDeviceActivity(tenantId, deviceId, {
        type: 'seed',
        message: isOnline ? 'Seed initialized as online' : 'Seed initialized as offline',
        metadata: {
          seededAt: new Date().toISOString()
        }
      });
    }

    if (metricsToInsert.length > 0) {
      await this.metricModel.insertMany(metricsToInsert, { ordered: false });
    }
  }

  private async seedSlaPolicies(tenantId: string, clientIds: string[]) {
    await this.slaService.create(tenantId, {
      name: 'Default Standard SLA',
      firstResponseMinutes: 60,
      resolutionMinutes: 480,
      escalationRules: [
        {
          trigger: SlaEscalationTrigger.FIRST_RESPONSE,
          afterMinutes: 30,
          action: 'notify-oncall',
          targetRoleSlug: 'tenant-admin'
        },
        {
          trigger: SlaEscalationTrigger.RESOLUTION,
          afterMinutes: 240,
          action: 'escalate-manager',
          targetRoleSlug: 'tenant-owner'
        }
      ],
      enabled: true
    });

    if (clientIds[0]) {
      await this.slaService.create(tenantId, {
        name: 'VIP Fast SLA',
        clientId: clientIds[0],
        firstResponseMinutes: 15,
        resolutionMinutes: 5,
        escalationRules: [
          {
            trigger: SlaEscalationTrigger.FIRST_RESPONSE,
            afterMinutes: 10,
            action: 'pagerduty',
            targetRoleSlug: 'tenant-admin'
          }
        ],
        enabled: true
      });
    }
  }

  private async seedAlertsAndTickets(tenantId: string, deviceIds: string[]) {
    if (deviceIds.length < 3) {
      return;
    }

    await this.upsertAlertRule(tenantId, {
      name: 'CPU Critical > 90',
      targetType: AlertRuleTargetType.METRIC,
      conditions: {
        metricType: 'cpu',
        operator: AlertConditionOperator.GT,
        threshold: 90
      },
      severity: AlertSeverity.CRITICAL,
      cooldown: 5,
      enabled: true,
      autoCreateTicket: true
    });

    await this.upsertAlertRule(tenantId, {
      name: 'Disk Free < 10',
      targetType: AlertRuleTargetType.METRIC,
      conditions: {
        metricType: 'disk',
        operator: AlertConditionOperator.LT,
        threshold: 10
      },
      severity: AlertSeverity.HIGH,
      cooldown: 10,
      enabled: true,
      autoCreateTicket: false
    });

    await this.upsertAlertRule(tenantId, {
      name: 'Device Offline',
      targetType: AlertRuleTargetType.DEVICE_STATUS,
      conditions: {
        status: AlertDeviceStatus.OFFLINE
      },
      severity: AlertSeverity.MEDIUM,
      cooldown: 15,
      enabled: true,
      autoCreateTicket: false
    });

    await this.upsertAlertRule(tenantId, {
      name: 'RAM Warning > 80',
      targetType: AlertRuleTargetType.METRIC,
      conditions: {
        metricType: 'ram',
        operator: AlertConditionOperator.GT,
        threshold: 80
      },
      severity: AlertSeverity.LOW,
      cooldown: 15,
      enabled: true,
      autoCreateTicket: false
    });

    await this.alertsService.evaluateMetrics(tenantId, deviceIds[0], [
      { type: 'cpu', value: 95, unit: '%', timestamp: new Date() },
      { type: 'ram', value: 88, unit: '%', timestamp: new Date() }
    ]);

    await this.alertsService.evaluateMetrics(tenantId, deviceIds[1], [
      { type: 'disk', value: 7, unit: '%', timestamp: new Date() }
    ]);

    await this.alertsService.evaluateDeviceStatus(tenantId, deviceIds[2], DeviceOnlineStatus.OFFLINE, 'heartbeat');

    const alertList = await this.alertsService.listAlerts(tenantId, {
      page: 1,
      limit: 100
    });

    const highAlert = alertList.items.find(
      (alert) => alert.severity === AlertSeverity.HIGH && alert.status !== AlertStatus.RESOLVED
    );

    const owner = (await this.usersService.listByTenant(tenantId)).find(
      (user) => user.email === 'owner@acme.local'
    );
    const tech1 = (await this.usersService.listByTenant(tenantId)).find(
      (user) => user.email === 'tech1@acme.local'
    );

    const ownerId = owner ? String(owner._id) : (tech1 ? String(tech1._id) : '');
    const tech1Id = tech1 ? String(tech1._id) : undefined;

    if (!ownerId) {
      return;
    }

    const manualOpen = (await this.ticketsService.createManual(tenantId, ownerId, {
      deviceId: deviceIds[0],
      source: TicketSource.MANUAL,
      subject: 'Patch baseline validation pending',
      description: 'Validate patch baseline and missing updates for pilot group.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      assigneeId: tech1Id
    })) as any;

    const manualInProgress = (await this.ticketsService.createManual(tenantId, ownerId, {
      deviceId: deviceIds[1],
      source: TicketSource.MANUAL,
      subject: 'Endpoint protection hardening',
      description: 'Review endpoint protection policy drift and remediate.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      assigneeId: tech1Id
    })) as any;

    await this.ticketsService.addComment(tenantId, String(manualInProgress._id), ownerId, {
      body: 'Please prioritize this before end of shift.',
      visibility: TicketCommentVisibility.INTERNAL
    });

    if (tech1Id) {
      await this.ticketsService.addComment(
        tenantId,
        String(manualInProgress._id),
        tech1Id,
        {
          body: 'Investigating now. Initial findings point to policy version mismatch.',
          visibility: TicketCommentVisibility.PUBLIC
        }
      );
    }

    await this.ticketsService.createManual(tenantId, ownerId, {
      deviceId: deviceIds[2],
      source: TicketSource.MANUAL,
      subject: 'Completed antivirus signature rollout',
      description: 'Signatures were rolled out and validated successfully.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      assigneeId: tech1Id
    });

    const closedTicket = (await this.ticketsService.createManual(tenantId, ownerId, {
      deviceId: deviceIds[3] ?? deviceIds[0],
      source: TicketSource.MANUAL,
      subject: 'Closed incident sample',
      description: 'Closed ticket sample for dashboard and list views.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.MEDIUM,
      assigneeId: tech1Id
    })) as any;

    await this.ticketsService.reopen(tenantId, String(closedTicket._id));

    if (highAlert) {
      await this.alertsService.createTicketFromAlert(tenantId, String(highAlert._id), ownerId);
      await this.alertsService.acknowledgeAlert(tenantId, String(highAlert._id), ownerId);
    }

    const lowSeverityAlert = alertList.items.find((alert) => alert.severity === AlertSeverity.LOW);
    if (lowSeverityAlert) {
      await this.alertsService.resolveAlert(tenantId, String(lowSeverityAlert._id), ownerId);
    }

    await this.ticketsService.assign(
      tenantId,
      String(manualOpen._id),
      { assigneeId: tech1Id ?? null },
      ownerId
    );
  }

  private async seedScriptsAndAutomations(tenantId: string, deviceIds: string[]) {
    if (deviceIds.length === 0) {
      return;
    }

    const restartScript = await this.upsertScript(tenantId, {
      name: 'Restart Monitoring Agent',
      description: 'Restart local monitoring service stack on the endpoint.',
      category: 'maintenance',
      platform: ScriptPlatform.POWERSHELL,
      body: "Write-Output 'Restarting monitoring stack'; Start-Sleep -Seconds 1; Write-Output 'Done'",
      parameters: [
        { name: 'serviceName', type: 'string', description: 'Service to restart', required: false }
      ]
    });

    const diagnosticsScript = await this.upsertScript(tenantId, {
      name: 'Collect Diagnostics Bundle',
      description: 'Collect CPU/RAM/disk and service metadata for troubleshooting.',
      category: 'diagnostics',
      platform: ScriptPlatform.BASH,
      body: "echo 'collecting diagnostics'; uname -a; df -h; free -m",
      parameters: [{ name: 'includeProcesses', type: 'boolean', required: false }]
    });

    const cleanupScript = await this.upsertScript(tenantId, {
      name: 'Cleanup Temp Files',
      description: 'Delete temporary files and report reclaimed space.',
      category: 'maintenance',
      platform: ScriptPlatform.SHELL,
      body: "echo 'cleaning temp files'; echo 'reclaimed=256MB'",
      parameters: [{ name: 'path', type: 'string', required: false }]
    });

    const tenantUsers = await this.usersService.listByTenant(tenantId);
    const tech1 = tenantUsers.find((user) => user.email === 'tech1@acme.local');

    await this.upsertAutomation(tenantId, {
      name: 'Critical Alert Auto Ticket',
      trigger: AutomationTrigger.ALERT_CREATED,
      conditions: {
        severities: ['critical']
      },
      actions: [
        {
          type: AutomationActionType.CREATE_TICKET,
          config: {
            subject: 'Critical alert auto-ticket for {{deviceId}}',
            description: 'Automation created ticket from alert {{alertId}}',
            priority: TicketPriority.URGENT
          }
        },
        {
          type: AutomationActionType.SEND_NOTIFICATION,
          config: {
            title: 'Critical alert automation fired',
            body: 'Alert {{alertId}} generated a ticket automatically.',
            type: 'automation'
          }
        },
        {
          type: AutomationActionType.WRITE_ACTIVITY_LOG,
          config: {
            activityType: 'automation',
            message: 'Critical alert automation executed for device {{deviceId}}'
          }
        }
      ],
      enabled: true,
      retryPolicy: {
        maxAttempts: 2,
        backoffMs: 500
      }
    });

    await this.upsertAutomation(tenantId, {
      name: 'Offline Device Remediation',
      trigger: AutomationTrigger.DEVICE_OFFLINE,
      conditions: {},
      actions: [
        {
          type: AutomationActionType.EXECUTE_SCRIPT,
          config: {
            scriptId: String(restartScript._id),
            deviceId: '{{deviceId}}'
          }
        },
        {
          type: AutomationActionType.SEND_NOTIFICATION,
          config: {
            title: 'Offline remediation started',
            body: 'Script started for offline device {{deviceId}}',
            type: 'automation'
          }
        }
      ],
      enabled: true
    });

    await this.upsertAutomation(tenantId, {
      name: 'Script Failure Escalation',
      trigger: AutomationTrigger.SCRIPT_FAILED,
      conditions: {},
      actions: [
        {
          type: AutomationActionType.CREATE_TICKET,
          config: {
            subject: 'Script failure on device {{deviceId}}',
            description: 'Execution {{executionId}} failed and needs manual remediation.',
            priority: TicketPriority.HIGH
          }
        },
        {
          type: AutomationActionType.SEND_NOTIFICATION,
          config: {
            title: 'Script execution failed',
            body: 'Execution {{executionId}} failed for device {{deviceId}}.',
            type: 'script_execution'
          }
        }
      ],
      enabled: true
    });

    if (tech1) {
      await this.upsertAutomation(tenantId, {
        name: 'Auto-Assign New Tickets',
        trigger: AutomationTrigger.TICKET_CREATED,
        conditions: {},
        actions: [
          {
            type: AutomationActionType.ASSIGN_TECHNICIAN,
            config: {
              assigneeId: String(tech1._id),
              ticketId: '{{ticketId}}'
            }
          }
        ],
        enabled: true
      });
    }

    await this.scriptExecutionModel.deleteMany({
      tenantId: new Types.ObjectId(tenantId),
      source: 'seed'
    });

    const scripts = [restartScript, diagnosticsScript, cleanupScript];
    const now = Date.now();
    const executionDocs = [];

    for (let index = 0; index < 15; index++) {
      const script = scripts[index % scripts.length];
      const statusCycle = [
        ScriptExecutionStatus.SUCCESS,
        ScriptExecutionStatus.SUCCESS,
        ScriptExecutionStatus.RUNNING,
        ScriptExecutionStatus.FAILED,
        ScriptExecutionStatus.QUEUED
      ];
      const status = statusCycle[index % statusCycle.length];
      const createdAt = new Date(now - index * 20 * 60 * 1000);
      const startedAt =
        status === ScriptExecutionStatus.QUEUED ? null : new Date(createdAt.getTime() + 15_000);
      const finishedAt =
        status === ScriptExecutionStatus.SUCCESS || status === ScriptExecutionStatus.FAILED
          ? new Date(createdAt.getTime() + 180_000)
          : null;

      executionDocs.push({
        tenantId: new Types.ObjectId(tenantId),
        scriptId: script._id,
        deviceId: new Types.ObjectId(deviceIds[index % deviceIds.length]),
        status,
        startedAt,
        finishedAt,
        logs: [
          { message: 'Seeded execution queued', createdAt },
          ...(startedAt ? [{ message: 'Seeded execution started', createdAt: startedAt }] : []),
          ...(finishedAt
            ? [
                {
                  message:
                    status === ScriptExecutionStatus.SUCCESS
                      ? 'Seeded execution completed successfully'
                      : 'Seeded execution failed',
                  createdAt: finishedAt
                }
              ]
            : [])
        ],
        result:
          status === ScriptExecutionStatus.SUCCESS
            ? { output: 'seed-success', exitCode: 0 }
            : status === ScriptExecutionStatus.FAILED
              ? { output: 'seed-failed', exitCode: 1, reason: 'simulated_error' }
              : null,
        scriptSnapshot: {
          name: script.name,
          category: script.category,
          platform: script.platform,
          body: script.body,
          parameterNames: (script.parameters ?? []).map((parameter) => parameter.name)
        },
        requestedBy: null,
        source: 'seed',
        createdAt,
        updatedAt: finishedAt ?? startedAt ?? createdAt
      });
    }

    if (executionDocs.length > 0) {
      await this.scriptExecutionModel.insertMany(executionDocs, { ordered: false });
    }

    const automations = await this.automationsService.list(tenantId, { page: 1, limit: 50 });
    if (automations.items.length > 0) {
      await this.automationLogModel.insertMany(
        automations.items.slice(0, 3).map((automation, index) => {
          const createdAt = new Date(now - index * 30 * 60 * 1000);
          const status = index === 2 ? AutomationLogStatus.FAILED : AutomationLogStatus.SUCCESS;
          return {
            tenantId: new Types.ObjectId(tenantId),
            automationId: automation._id,
            trigger: automation.trigger,
            status,
            startedAt: createdAt,
            finishedAt: new Date(createdAt.getTime() + 60_000),
            entries: [
              { message: 'Seed automation log start', level: 'info', createdAt },
              {
                message:
                  status === AutomationLogStatus.SUCCESS
                    ? 'Seed automation log success'
                    : 'Seed automation log failure',
                level: status === AutomationLogStatus.SUCCESS ? 'info' : 'error',
                createdAt: new Date(createdAt.getTime() + 60_000)
              }
            ],
            context: {
              deviceId: deviceIds[index % deviceIds.length]
            },
            error: status === AutomationLogStatus.FAILED ? 'Simulated automation failure' : null,
            createdAt,
            updatedAt: new Date(createdAt.getTime() + 60_000)
          };
        }),
        { ordered: false }
      );
    }
  }

  private async seedKnowledgeBase(tenantId: string) {
    const owner = (await this.usersService.listByTenant(tenantId)).find((user) => user.email === 'owner@acme.local');
    if (!owner) {
      return;
    }

    const existing = await this.knowledgeBaseService.list(tenantId, {
      page: 1,
      limit: 100
    });

    const articles = [
      {
        title: 'How to onboard a new endpoint',
        slug: 'onboard-new-endpoint',
        summary: 'Checklist for onboarding Windows and Linux devices.',
        visibility: ArticleVisibility.INTERNAL,
        tags: ['onboarding', 'devices'],
        contentMarkdown:
          '# Endpoint onboarding\n\n1. Install agent\n2. Verify heartbeat\n3. Attach baseline script profile\n4. Confirm alert rules'
      },
      {
        title: 'Portal FAQ for clients',
        slug: 'portal-faq-clients',
        summary: 'Frequently asked questions for customer portal users.',
        visibility: ArticleVisibility.PUBLIC,
        tags: ['portal', 'faq'],
        contentMarkdown:
          '# Customer Portal FAQ\n\n- Open tickets from the portal\n- Track assignee and SLA\n- Add follow-up comments'
      },
      {
        title: 'Patch window policy rationale',
        slug: 'patch-window-policy-rationale',
        summary: 'Why weekly maintenance windows are enforced.',
        visibility: ArticleVisibility.INTERNAL,
        tags: ['patching', 'policy'],
        contentMarkdown:
          '# Patch policy rationale\n\nMaintenance windows reduce operational risk and keep a consistent remediation cadence.'
      }
    ];

    for (const article of articles) {
      const found = existing.items.find((item) => item.slug === article.slug);
      if (found) {
        await this.knowledgeBaseService.update(tenantId, String(found._id), article);
      } else {
        await this.knowledgeBaseService.create(tenantId, String(owner._id), article);
      }
    }
  }

  private async seedContractsAndBilling(tenantId: string, clientIds: string[]) {
    const owner = (await this.usersService.listByTenant(tenantId)).find((user) => user.email === 'owner@acme.local');
    if (!owner || clientIds.length === 0) {
      return;
    }

    const contractsToSeed = clientIds.slice(0, 3).map((clientId, index) => ({
      clientId,
      name: `Managed Services Contract ${index + 1}`,
      type: 'managed-services',
      status: ContractStatus.ACTIVE,
      startDate: new Date(Date.now() - (120 - index * 30) * 24 * 60 * 60 * 1000).toISOString(),
      monthlyValue: 1800 + index * 700,
      termsMarkdown:
        '## Managed Services Terms\n\nIncludes monitoring, patching, and help desk operations.\n\nRenewal: monthly.',
      autoRenew: true
    }));

    for (const contractInput of contractsToSeed) {
      const existing = await this.contractsService.list(tenantId, {
        page: 1,
        limit: 100,
        search: contractInput.name
      });

      const found = existing.items.find((item) => item.name === contractInput.name);
      if (found) {
        await this.contractsService.update(tenantId, String(found._id), contractInput);
      } else {
        await this.contractsService.create(tenantId, contractInput);
      }
    }

    const contracts = await this.contractsService.list(tenantId, { page: 1, limit: 100 });
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');

    for (const [index, contract] of contracts.items.slice(0, 3).entries()) {
      const contractId = String(contract._id);
      const clientId =
        contract.clientId && typeof contract.clientId === 'object' && '_id' in contract.clientId
          ? String(contract.clientId._id)
          : null;
      if (!clientId) {
        continue;
      }

      const invoiceNumber = `INV-${year}${month}-${String(index + 1).padStart(3, '0')}`;
      const invoiceCheck = await this.billingService.listInvoices(tenantId, {
        page: 1,
        limit: 20,
        search: invoiceNumber
      });
      const existingInvoice = invoiceCheck.items.find((item) => item.number === invoiceNumber);
      const total = Number((contract.monthlyValue as number) || 0);

      const invoicePayload = {
        clientId,
        contractId,
        number: invoiceNumber,
        status: index === 0 ? InvoiceStatus.PAID : index === 1 ? InvoiceStatus.SENT : InvoiceStatus.OVERDUE,
        issueDate: new Date(Date.UTC(year, now.getUTCMonth(), 1)).toISOString(),
        dueDate: new Date(Date.UTC(year, now.getUTCMonth(), 10)).toISOString(),
        currency: 'USD',
        subtotal: total,
        tax: Number((total * 0.08).toFixed(2)),
        total: Number((total * 1.08).toFixed(2)),
        paidAt: index === 0 ? new Date(Date.UTC(year, now.getUTCMonth(), 5)).toISOString() : undefined
      };

      if (existingInvoice) {
        await this.billingService.updateInvoice(tenantId, String(existingInvoice._id), invoicePayload);
      } else {
        await this.billingService.createInvoice(tenantId, invoicePayload);
      }

      const existingSubscriptions = await this.billingService.listSubscriptions(tenantId, {
        page: 1,
        limit: 100,
        clientId
      });
      const hasPlan = existingSubscriptions.items.some(
        (subscription) => subscription.planName === `MSP Plan ${index + 1}`
      );
      if (!hasPlan) {
        await this.billingService.createSubscription(tenantId, {
          clientId,
          contractId,
          planName: `MSP Plan ${index + 1}`,
          status: SubscriptionStatus.ACTIVE,
          monthlyPrice: Number((total * 0.95).toFixed(2)),
          startedAt: new Date(Date.UTC(year, now.getUTCMonth() - 3, 1)).toISOString()
        });
      }
    }
  }

  private async seedPatchManagement(tenantId: string, deviceIds: string[]) {
    if (deviceIds.length === 0) {
      return;
    }

    const existingPolicies = await this.patchManagementService.listPolicies(tenantId);
    const policyName = 'Weekly Baseline Patch Policy';
    const policyFound = existingPolicies.find((policy) => policy.name === policyName);
    const policy = policyFound
      ? await this.patchManagementService.updatePolicy(tenantId, String(policyFound._id), {
          description: 'Simulated weekly maintenance policy',
          targetTags: ['production', 'critical'],
          maintenanceWindow: 'Sundays 02:00-04:00 UTC',
          autoApprove: false,
          enabled: true
        })
      : await this.patchManagementService.createPolicy(tenantId, {
          name: policyName,
          description: 'Simulated weekly maintenance policy',
          targetTags: ['production', 'critical'],
          maintenanceWindow: 'Sundays 02:00-04:00 UTC',
          autoApprove: false,
          enabled: true
        });

    const existingPatches = await this.patchManagementService.listPatches(tenantId, { page: 1, limit: 10 });
    if (existingPatches.meta.total > 0) {
      return;
    }

    for (let index = 0; index < Math.min(6, deviceIds.length); index++) {
      const patch = await this.patchManagementService.simulatePatchScan(tenantId, {
        deviceId: deviceIds[index],
        kbId: `KB50${200 + index}`,
        title: `Security Rollup ${2026}-${String(index + 1).padStart(2, '0')}`,
        severity: index % 2 === 0 ? 'high' : 'medium',
        policyId: String(policy._id)
      });

      if (index % 3 === 0) {
        await this.patchManagementService.approvePatch(tenantId, String(patch._id));
        await this.patchManagementService.schedulePatch(tenantId, String(patch._id), {
          scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        });
      }
      if (index % 4 === 0) {
        await this.patchManagementService.executePatch(tenantId, String(patch._id));
      }
    }
  }

  private async seedRemoteAccess(tenantId: string, deviceIds: string[]) {
    if (deviceIds.length === 0) {
      return;
    }

    const owner = (await this.usersService.listByTenant(tenantId)).find((user) => user.email === 'owner@acme.local');
    if (!owner) {
      return;
    }

    const existing = await this.remoteAccessService.list(tenantId, { page: 1, limit: 5 });
    if (existing.meta.total > 0) {
      return;
    }

    const session1 = await this.remoteAccessService.requestSession(tenantId, String(owner._id), {
      deviceId: deviceIds[0],
      provider: 'builtin-sim',
      metadata: { reason: 'Seed remote diagnostics' }
    });
    await this.remoteAccessService.startSession(tenantId, String(session1._id));

    const session2 = await this.remoteAccessService.requestSession(tenantId, String(owner._id), {
      deviceId: deviceIds[1] ?? deviceIds[0],
      provider: 'builtin-sim',
      metadata: { reason: 'Seed remote verification' }
    });
    await this.remoteAccessService.startSession(tenantId, String(session2._id));
    await this.remoteAccessService.endSession(tenantId, String(session2._id));
  }

  private async seedIntegrationsSettingsAndApiKeys(tenantId: string) {
    const owner = (await this.usersService.listByTenant(tenantId)).find((user) => user.email === 'owner@acme.local');
    if (!owner) {
      return;
    }

    const existingIntegrations = await this.integrationsService.list(tenantId, {});
    if (!existingIntegrations.some((integration) => integration.name === 'Primary Webhook')) {
      await this.integrationsService.create(tenantId, String(owner._id), {
        name: 'Primary Webhook',
        type: IntegrationType.WEBHOOK,
        enabled: false,
        config: {
          url: 'https://example.invalid/webhook',
          secret: 'seed-secret'
        }
      });
    }

    if (!existingIntegrations.some((integration) => integration.name === 'SMTP Relay')) {
      await this.integrationsService.create(tenantId, String(owner._id), {
        name: 'SMTP Relay',
        type: IntegrationType.SMTP,
        enabled: true,
        config: {
          host: 'smtp.seed.local',
          port: 2525,
          from: 'noreply@acme.local'
        }
      });
    }

    await this.settingsService.upsert(tenantId, String(owner._id), {
      key: 'general',
      value: {
        companyName: 'Acme Managed Services',
        timezone: 'America/Sao_Paulo',
        locale: 'pt-BR'
      }
    });

    await this.settingsService.upsert(tenantId, String(owner._id), {
      key: 'customer-portal',
      value: {
        enabled: true,
        allowTicketCreation: true
      }
    });

    const apiKeys = await this.apiKeysService.list(tenantId);
    if (apiKeys.length === 0) {
      await this.apiKeysService.create(tenantId, String(owner._id), {
        name: 'Seed Integration Key',
        scopes: ['reports:read', 'devices:read']
      });
    }
  }

  private async upsertAlertRule(
    tenantId: string,
    input: {
      name: string;
      targetType: AlertRuleTargetType;
      conditions: {
        metricType?: string;
        operator?: AlertConditionOperator;
        threshold?: number;
        status?: AlertDeviceStatus;
      };
      severity: AlertSeverity;
      cooldown: number;
      enabled: boolean;
      autoCreateTicket: boolean;
    }
  ) {
    const existingRules = await this.alertsService.listRules(tenantId, {
      page: 1,
      limit: 100,
      search: input.name
    });

    const existing = existingRules.items.find((rule) => rule.name === input.name);
    if (existing) {
      await this.alertsService.updateRule(tenantId, String(existing._id), input);
      return;
    }

    await this.alertsService.createRule(tenantId, input);
  }

  private async upsertScript(
    tenantId: string,
    input: {
      name: string;
      description: string;
      category: string;
      platform: ScriptPlatform;
      body: string;
      parameters: Array<{
        name: string;
        type?: string;
        description?: string;
        required?: boolean;
      }>;
    }
  ) {
    const existing = await this.scriptsService.list(tenantId, {
      page: 1,
      limit: 100,
      search: input.name
    });
    const found = existing.items.find((script) => script.name === input.name);
    if (found) {
      return this.scriptsService.update(tenantId, String(found._id), input);
    }

    return this.scriptsService.create(tenantId, {
      ...input,
      enabled: true
    });
  }

  private async upsertAutomation(
    tenantId: string,
    input: {
      name: string;
      trigger: AutomationTrigger;
      conditions: Record<string, unknown>;
      actions: Array<{
        type: AutomationActionType;
        config: Record<string, unknown>;
      }>;
      enabled: boolean;
      retryPolicy?: {
        maxAttempts: number;
        backoffMs: number;
      };
    }
  ) {
    const existing = await this.automationsService.list(tenantId, {
      page: 1,
      limit: 100,
      search: input.name
    });

    const found = existing.items.find((automation) => automation.name === input.name);
    if (found) {
      return this.automationsService.update(tenantId, String(found._id), input);
    }

    return this.automationsService.create(tenantId, input);
  }

  private async createDemoUsers(input: {
    tenantId: Types.ObjectId;
    superAdminRoleId: Types.ObjectId;
    ownerRoleId: Types.ObjectId;
    adminRoleId: Types.ObjectId;
    technicianRoleId: Types.ObjectId;
    portalRoleId: Types.ObjectId;
    portalClientId: string | null;
  }) {
    const sharedPasswordHash = await bcrypt.hash('ChangeMe@123', 10);
    const superAdminPasswordHash = await bcrypt.hash('SuperAdmin@123', 10);

    await this.usersService.createOrUpdateByEmail({
      tenantId: null,
      email: 'superadmin@atera.local',
      passwordHash: superAdminPasswordHash,
      roleIds: [input.superAdminRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'owner@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.ownerRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'admin@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.adminRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'tech1@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.technicianRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'tech2@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.technicianRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'tech3@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.technicianRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date()
    });

    await this.usersService.createOrUpdateByEmail({
      tenantId: input.tenantId,
      email: 'portal@acme.local',
      passwordHash: sharedPasswordHash,
      roleIds: [input.portalRoleId],
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      isPortalUser: true,
      portalClientIds: input.portalClientId ? [new Types.ObjectId(input.portalClientId)] : []
    });
  }

  private mapPermissionIds(permissionByKey: Map<string, Permission>, keys: string[]): Types.ObjectId[] {
    return keys
      .map((key) => permissionByKey.get(key)?._id)
      .filter((id): id is Types.ObjectId => Boolean(id));
  }

  private randomBetween(min: number, max: number): number {
    return Number((Math.random() * (max - min) + min).toFixed(2));
  }

  private permissionSeedData() {
    return [
      { key: '*', description: 'Full platform access', module: 'global' },
      { key: 'dashboard:read', description: 'View dashboard', module: 'dashboard' },
      { key: 'users:read', description: 'Read users', module: 'users' },
      { key: 'users:write', description: 'Manage users', module: 'users' },
      { key: 'roles:read', description: 'Read roles', module: 'roles' },
      { key: 'roles:write', description: 'Manage roles', module: 'roles' },
      { key: 'permissions:read', description: 'Read permissions', module: 'roles' },
      { key: 'tenants:read', description: 'Read tenant information', module: 'tenants' },
      { key: 'clients:read', description: 'Read clients', module: 'clients' },
      { key: 'clients:write', description: 'Manage clients', module: 'clients' },
      { key: 'contacts:read', description: 'Read contacts', module: 'contacts' },
      { key: 'contacts:write', description: 'Manage contacts', module: 'contacts' },
      { key: 'devices:read', description: 'Read devices', module: 'devices' },
      { key: 'devices:write', description: 'Manage devices', module: 'devices' },
      { key: 'device-groups:read', description: 'Read device groups', module: 'device-groups' },
      { key: 'device-groups:write', description: 'Manage device groups', module: 'device-groups' },
      { key: 'agents:write', description: 'Register and manage agents', module: 'agents' },
      { key: 'monitoring:ingest', description: 'Ingest monitoring metrics', module: 'monitoring' },
      { key: 'alerts:read', description: 'Read alerts and alert rules', module: 'alerts' },
      { key: 'alerts:write', description: 'Manage alerts and alert rules', module: 'alerts' },
      { key: 'tickets:read', description: 'Read tickets and comments', module: 'tickets' },
      { key: 'tickets:write', description: 'Manage tickets and comments', module: 'tickets' },
      { key: 'sla:read', description: 'Read SLA policies', module: 'sla' },
      { key: 'sla:write', description: 'Manage SLA policies', module: 'sla' },
      { key: 'notifications:read', description: 'Read notifications', module: 'notifications' },
      { key: 'scripts:read', description: 'Read scripts and execution history', module: 'scripts' },
      { key: 'scripts:write', description: 'Manage scripts and script executions', module: 'scripts' },
      {
        key: 'automations:read',
        description: 'Read automations and automation logs',
        module: 'automations'
      },
      {
        key: 'automations:write',
        description: 'Manage automations',
        module: 'automations'
      },
      {
        key: 'knowledge-base:read',
        description: 'Read knowledge base articles',
        module: 'knowledge-base'
      },
      {
        key: 'knowledge-base:write',
        description: 'Manage knowledge base articles',
        module: 'knowledge-base'
      },
      { key: 'contracts:read', description: 'Read contracts', module: 'contracts' },
      { key: 'contracts:write', description: 'Manage contracts', module: 'contracts' },
      { key: 'billing:read', description: 'Read billing data', module: 'billing' },
      { key: 'billing:write', description: 'Manage invoices and subscriptions', module: 'billing' },
      { key: 'reports:read', description: 'Read and export reports', module: 'reports' },
      { key: 'audit:read', description: 'Read audit logs', module: 'audit' },
      {
        key: 'patch-management:read',
        description: 'Read patch policies and patches',
        module: 'patch-management'
      },
      {
        key: 'patch-management:write',
        description: 'Manage patch workflows',
        module: 'patch-management'
      },
      {
        key: 'remote-access:read',
        description: 'Read remote access sessions',
        module: 'remote-access'
      },
      {
        key: 'remote-access:write',
        description: 'Manage remote access sessions',
        module: 'remote-access'
      },
      {
        key: 'integrations:read',
        description: 'Read integrations',
        module: 'integrations'
      },
      {
        key: 'integrations:write',
        description: 'Manage integrations',
        module: 'integrations'
      },
      { key: 'settings:read', description: 'Read tenant settings', module: 'settings' },
      { key: 'settings:write', description: 'Manage tenant settings', module: 'settings' },
      { key: 'api-keys:read', description: 'Read API keys', module: 'api-keys' },
      { key: 'api-keys:write', description: 'Manage API keys', module: 'api-keys' },
      {
        key: 'portal:access',
        description: 'Access customer portal',
        module: 'customer-portal'
      },
      {
        key: 'portal:tickets:read',
        description: 'Read own portal tickets',
        module: 'customer-portal'
      },
      {
        key: 'portal:tickets:write',
        description: 'Create and comment own portal tickets',
        module: 'customer-portal'
      }
    ];
  }
}
