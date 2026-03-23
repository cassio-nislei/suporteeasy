import {
  apiRequest,
  authorizedApiRequest,
  authorizedApiTextRequest,
  type PaginatedResponse,
  API_URL,
  type MeResponse
} from '@/lib/auth/client';
import { clearAuthSession, setAuthSession } from '@/lib/auth/storage';

export interface ClientRecord {
  _id: string;
  tenantId: string;
  name: string;
  status: 'active' | 'inactive';
  tags: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ContactRecord {
  _id: string;
  tenantId: string;
  clientId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      }
    | null;
  hostname: string;
  ipAddress: string;
  os: string;
  onlineStatus: 'online' | 'offline' | 'unknown';
  tags: string[];
  notes: string;
  inventory: {
    cpuModel: string;
    cpuCores: number;
    ramGb: number;
    diskGb: number;
    serialNumber: string;
    services: string[];
  };
  lastHeartbeatAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceDetailResponse extends DeviceRecord {
  latestMetrics: Array<{
    _id: string;
    type: string;
    value: number;
    unit: string;
    timestamp: string;
  }>;
  agent: {
    _id: string;
    version: string;
    status: string;
    lastHeartbeatAt: string | null;
  } | null;
  recentActivity: PaginatedResponse<{
    _id: string;
    type: string;
    message: string;
    metadata: Record<string, unknown>;
    occurredAt: string;
  }>;
}

export interface AlertRuleConditions {
  metricType?: string;
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq';
  threshold?: number;
  status?: 'online' | 'offline' | 'unknown';
}

export interface AlertRuleRecord {
  _id: string;
  tenantId: string;
  name: string;
  targetType: 'metric' | 'device_status';
  conditions: AlertRuleConditions;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cooldown: number;
  enabled: boolean;
  autoCreateTicket: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRecord {
  _id: string;
  tenantId: string;
  deviceId:
    | string
    | {
        _id: string;
        hostname: string;
        ipAddress: string;
        onlineStatus: string;
      };
  alertRuleId:
    | string
    | {
        _id: string;
        name: string;
        targetType: string;
        severity: string;
      };
  ticketId:
    | string
    | {
        _id: string;
        subject: string;
        status: string;
        priority: string;
      }
    | null;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'acknowledged' | 'resolved';
  title: string;
  message: string;
  triggeredValue: number | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  timeline: Array<{
    type: string;
    message: string;
    actorId: string | null;
    occurredAt: string;
    metadata: Record<string, unknown>;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SlaIndicator {
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  firstResponseState: 'none' | 'on_track' | 'at_risk' | 'breached' | 'met';
  firstResponseRemainingMinutes: number | null;
  resolutionState: 'none' | 'on_track' | 'at_risk' | 'breached' | 'met';
  resolutionRemainingMinutes: number | null;
  overallState: 'none' | 'on_track' | 'at_risk' | 'breached' | 'met';
}

export interface TicketRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      }
    | null;
  deviceId:
    | string
    | {
        _id: string;
        hostname: string;
        ipAddress: string;
        onlineStatus: string;
      }
    | null;
  alertId: string | null;
  source: 'manual' | 'alert' | 'automation' | 'portal';
  subject: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId:
    | string
    | {
        _id: string;
        email: string;
        status: string;
      }
    | null;
  slaPolicyId:
    | string
    | {
        _id: string;
        name: string;
        firstResponseMinutes: number;
        resolutionMinutes: number;
      }
    | null;
  firstResponseDueAt: string | null;
  resolutionDueAt: string | null;
  firstRespondedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  sla: SlaIndicator;
  createdAt: string;
  updatedAt: string;
}

export interface TicketCommentRecord {
  _id: string;
  tenantId: string;
  ticketId: string;
  authorId:
    | string
    | {
        _id: string;
        email: string;
      };
  visibility: 'public' | 'internal';
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface SlaPolicyRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      }
    | null;
  name: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationRules: Array<{
    trigger: 'first_response' | 'resolution';
    afterMinutes: number;
    action: string;
    targetRoleSlug: string | null;
  }>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationRecord {
  _id: string;
  tenantId: string;
  userId: string;
  type: 'alert_created' | 'ticket_created' | 'ticket_assigned' | 'script_execution' | 'automation';
  title: string;
  body: string;
  readAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserOption {
  id: string;
  tenantId: string;
  email: string;
  status: string;
  roleIds: string[];
  lastLoginAt: string | null;
}

export interface DashboardOverviewResponse {
  counts: {
    clients: number;
    contacts: number;
    devices: {
      total: number;
      online: number;
      offline: number;
      unknown: number;
    };
    tickets: {
      open: number;
    };
    alerts: {
      criticalOpen: number;
    };
    sla: {
      atRisk: number;
      breached: number;
    };
    scripts: {
      queued: number;
      running: number;
      failed: number;
      last24h: number;
    };
    automations: {
      runsLast24h: number;
      failedLast24h: number;
    };
  };
  latestMetrics: Array<{
    _id: string;
    deviceId: string;
    type: string;
    value: number;
    unit: string;
    timestamp: string;
  }>;
}

export interface DeviceStatusEvent {
  tenantId: string;
  deviceId: string;
  hostname: string;
  onlineStatus: 'online' | 'offline' | 'unknown';
  lastHeartbeatAt: string | null;
}

export interface DeviceGroupRecord {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  deviceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ScriptParameterRecord {
  name: string;
  type: string;
  description: string;
  required: boolean;
  defaultValue: string | null;
}

export interface ScriptRecord {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  category: string;
  platform: 'powershell' | 'bash' | 'python' | 'shell';
  body: string;
  parameters: ScriptParameterRecord[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptExecutionRecord {
  _id: string;
  tenantId: string;
  scriptId:
    | string
    | {
        _id: string;
        name: string;
        category: string;
        platform: string;
      };
  deviceId:
    | string
    | {
        _id: string;
        hostname: string;
        ipAddress: string;
        onlineStatus: string;
      };
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
  logs: Array<{
    message: string;
    createdAt: string;
  }>;
  result: Record<string, unknown> | null;
  scriptSnapshot: {
    name: string;
    category: string;
    platform: string;
    body: string;
    parameterNames: string[];
  };
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledScriptJobRecord {
  _id: string;
  tenantId: string;
  type: 'script';
  payload: Record<string, unknown>;
  runAt: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface ScriptExecutionStatusEvent {
  tenantId: string;
  executionId: string;
  scriptId: string;
  deviceId: string;
  status: 'queued' | 'running' | 'success' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
}

export interface AutomationRecord {
  _id: string;
  tenantId: string;
  name: string;
  trigger: 'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created';
  conditions: Record<string, unknown>;
  actions: Array<{
    type:
      | 'create_ticket'
      | 'send_notification'
      | 'execute_script'
      | 'assign_technician'
      | 'tag_device'
      | 'write_activity_log';
    config: Record<string, unknown>;
  }>;
  enabled: boolean;
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AutomationLogRecord {
  _id: string;
  tenantId: string;
  automationId:
    | string
    | {
        _id: string;
        name: string;
        trigger: string;
        enabled: boolean;
      };
  trigger: string;
  status: 'running' | 'success' | 'failed' | 'skipped';
  startedAt: string | null;
  finishedAt: string | null;
  entries: Array<{
    message: string;
    level: 'info' | 'warn' | 'error';
    createdAt: string;
  }>;
  context: Record<string, unknown>;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

function toQuery<T extends object>(params: T): string {
  const searchParams = new URLSearchParams();

  Object.entries(params as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export async function listClients(query: ListQuery & { status?: string } = {}) {
  return authorizedApiRequest<PaginatedResponse<ClientRecord>>(`/clients${toQuery(query)}`);
}

export async function getClient(clientId: string) {
  return authorizedApiRequest<ClientRecord>(`/clients/${clientId}`);
}

export async function createClient(payload: {
  name: string;
  status: 'active' | 'inactive';
  tags: string[];
  notes: string;
}) {
  return authorizedApiRequest<ClientRecord>('/clients', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateClient(
  clientId: string,
  payload: Partial<{
    name: string;
    status: 'active' | 'inactive';
    tags: string[];
    notes: string;
  }>
) {
  return authorizedApiRequest<ClientRecord>(`/clients/${clientId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listContacts(query: ListQuery & { clientId?: string } = {}) {
  return authorizedApiRequest<PaginatedResponse<ContactRecord>>(`/contacts${toQuery(query)}`);
}

export async function createContact(payload: {
  clientId: string;
  name: string;
  email: string;
  phone: string;
  title: string;
}) {
  return authorizedApiRequest<ContactRecord>('/contacts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateContact(
  contactId: string,
  payload: Partial<{
    clientId: string;
    name: string;
    email: string;
    phone: string;
    title: string;
  }>
) {
  return authorizedApiRequest<ContactRecord>(`/contacts/${contactId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteContact(contactId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/contacts/${contactId}`, {
    method: 'DELETE'
  });
}

export async function listDevices(
  query: ListQuery & {
    clientId?: string;
    onlineStatus?: 'online' | 'offline' | 'unknown';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<DeviceRecord>>(`/devices${toQuery(query)}`);
}

export async function getDevice(deviceId: string) {
  return authorizedApiRequest<DeviceDetailResponse>(`/devices/${deviceId}`);
}

export async function getDeviceMetrics(
  deviceId: string,
  query: {
    page?: number;
    limit?: number;
    type?: string;
  }
) {
  return authorizedApiRequest<
    PaginatedResponse<{
      _id: string;
      type: string;
      value: number;
      unit: string;
      timestamp: string;
    }>
  >(`/devices/${deviceId}/metrics${toQuery(query)}`);
}

export async function createDevice(payload: {
  clientId?: string;
  hostname: string;
  ipAddress: string;
  os: string;
  tags: string[];
  notes: string;
  inventory: {
    cpuModel: string;
    cpuCores: number;
    ramGb: number;
    diskGb: number;
    serialNumber: string;
    services: string[];
  };
}) {
  return authorizedApiRequest<DeviceRecord>('/devices', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateDevice(
  deviceId: string,
  payload: Partial<{
    clientId: string | null;
    hostname: string;
    ipAddress: string;
    os: string;
    tags: string[];
    notes: string;
    inventory: {
      cpuModel: string;
      cpuCores: number;
      ramGb: number;
      diskGb: number;
      serialNumber: string;
      services: string[];
    };
  }>
) {
  return authorizedApiRequest<DeviceRecord>(`/devices/${deviceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listDeviceGroups() {
  return authorizedApiRequest<DeviceGroupRecord[]>('/device-groups');
}

export async function listAlertRules(
  query: ListQuery & { enabled?: boolean; targetType?: 'metric' | 'device_status' } = {}
) {
  return authorizedApiRequest<PaginatedResponse<AlertRuleRecord>>(`/alerts/rules${toQuery(query)}`);
}

export async function createAlertRule(payload: {
  name: string;
  targetType: 'metric' | 'device_status';
  conditions: AlertRuleConditions;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cooldown?: number;
  enabled?: boolean;
  autoCreateTicket?: boolean;
}) {
  return authorizedApiRequest<AlertRuleRecord>('/alerts/rules', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAlertRule(
  ruleId: string,
  payload: Partial<{
    name: string;
    targetType: 'metric' | 'device_status';
    conditions: AlertRuleConditions;
    severity: 'critical' | 'high' | 'medium' | 'low';
    cooldown: number;
    enabled: boolean;
    autoCreateTicket: boolean;
  }>
) {
  return authorizedApiRequest<AlertRuleRecord>(`/alerts/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAlertRule(ruleId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/alerts/rules/${ruleId}`, {
    method: 'DELETE'
  });
}

export async function listAlerts(
  query: ListQuery & {
    severity?: 'critical' | 'high' | 'medium' | 'low';
    status?: 'open' | 'acknowledged' | 'resolved';
    deviceId?: string;
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<AlertRecord>>(`/alerts${toQuery(query)}`);
}

export async function getAlert(alertId: string) {
  return authorizedApiRequest<AlertRecord>(`/alerts/${alertId}`);
}

export async function acknowledgeAlert(alertId: string) {
  return authorizedApiRequest<AlertRecord>(`/alerts/${alertId}/acknowledge`, {
    method: 'POST'
  });
}

export async function resolveAlert(alertId: string) {
  return authorizedApiRequest<AlertRecord>(`/alerts/${alertId}/resolve`, {
    method: 'POST'
  });
}

export async function createTicketFromAlert(alertId: string) {
  return authorizedApiRequest<{
    created: boolean;
    ticket: TicketRecord;
  }>(`/alerts/${alertId}/create-ticket`, {
    method: 'POST'
  });
}

export async function listTickets(
  query: ListQuery & {
    status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId?: string;
    clientId?: string;
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<TicketRecord>>(`/tickets${toQuery(query)}`);
}

export async function getTicket(ticketId: string) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}`);
}

export async function createTicket(payload: {
  clientId?: string;
  deviceId?: string;
  source?: 'manual' | 'alert' | 'automation';
  subject: string;
  description: string;
  status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assigneeId?: string;
  slaPolicyId?: string;
}) {
  return authorizedApiRequest<TicketRecord>('/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateTicket(
  ticketId: string,
  payload: Partial<{
    clientId: string | null;
    deviceId: string | null;
    subject: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assigneeId: string | null;
    slaPolicyId: string | null;
  }>
) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function assignTicket(ticketId: string, assigneeId: string | null) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ assigneeId })
  });
}

export async function resolveTicket(ticketId: string) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}/resolve`, {
    method: 'POST'
  });
}

export async function closeTicket(ticketId: string) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}/close`, {
    method: 'POST'
  });
}

export async function reopenTicket(ticketId: string) {
  return authorizedApiRequest<TicketRecord>(`/tickets/${ticketId}/reopen`, {
    method: 'POST'
  });
}

export async function listTicketComments(ticketId: string) {
  return authorizedApiRequest<TicketCommentRecord[]>(`/tickets/${ticketId}/comments`);
}

export async function addTicketComment(
  ticketId: string,
  payload: {
    body: string;
    visibility?: 'public' | 'internal';
  }
) {
  return authorizedApiRequest<TicketCommentRecord>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function listSlaPolicies(
  query: ListQuery & {
    clientId?: string;
    enabled?: boolean;
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<SlaPolicyRecord>>(`/sla/policies${toQuery(query)}`);
}

export async function createSlaPolicy(payload: {
  name: string;
  clientId?: string;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  escalationRules?: Array<{
    trigger: 'first_response' | 'resolution';
    afterMinutes: number;
    action: string;
    targetRoleSlug?: string;
  }>;
  enabled?: boolean;
}) {
  return authorizedApiRequest<SlaPolicyRecord>('/sla/policies', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateSlaPolicy(
  policyId: string,
  payload: Partial<{
    name: string;
    clientId: string | null;
    firstResponseMinutes: number;
    resolutionMinutes: number;
    escalationRules: Array<{
      trigger: 'first_response' | 'resolution';
      afterMinutes: number;
      action: string;
      targetRoleSlug?: string;
    }>;
    enabled: boolean;
  }>
) {
  return authorizedApiRequest<SlaPolicyRecord>(`/sla/policies/${policyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteSlaPolicy(policyId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/sla/policies/${policyId}`, {
    method: 'DELETE'
  });
}

export async function listNotifications(query: { page?: number; limit?: number; unreadOnly?: boolean } = {}) {
  return authorizedApiRequest<
    PaginatedResponse<NotificationRecord> & {
      meta: PaginatedResponse<NotificationRecord>['meta'] & { unread: number };
    }
  >(`/notifications${toQuery(query)}`);
}

export async function markNotificationRead(notificationId: string) {
  return authorizedApiRequest<{ updated: boolean; notification: NotificationRecord | null }>(
    `/notifications/${notificationId}/read`,
    {
      method: 'POST'
    }
  );
}

export async function markAllNotificationsRead() {
  return authorizedApiRequest<{ updated: number }>('/notifications/read-all', {
    method: 'POST'
  });
}

export async function listScripts(
  query: ListQuery & {
    category?: string;
    platform?: 'powershell' | 'bash' | 'python' | 'shell';
    enabled?: boolean;
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<ScriptRecord>>(`/scripts${toQuery(query)}`);
}

export async function getScript(scriptId: string) {
  return authorizedApiRequest<ScriptRecord>(`/scripts/${scriptId}`);
}

export async function createScript(payload: {
  name: string;
  description?: string;
  category?: string;
  platform: 'powershell' | 'bash' | 'python' | 'shell';
  body: string;
  parameters?: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
    defaultValue?: string;
  }>;
  enabled?: boolean;
}) {
  return authorizedApiRequest<ScriptRecord>('/scripts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateScript(
  scriptId: string,
  payload: Partial<{
    name: string;
    description: string;
    category: string;
    platform: 'powershell' | 'bash' | 'python' | 'shell';
    body: string;
    parameters: Array<{
      name: string;
      type?: string;
      description?: string;
      required?: boolean;
      defaultValue?: string;
    }>;
    enabled: boolean;
  }>
) {
  return authorizedApiRequest<ScriptRecord>(`/scripts/${scriptId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteScript(scriptId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/scripts/${scriptId}`, {
    method: 'DELETE'
  });
}

export async function runScriptOnDevice(payload: {
  scriptId: string;
  deviceId: string;
  parameters?: Record<string, string | number | boolean>;
}) {
  return authorizedApiRequest<ScriptExecutionRecord>('/script-executions/run', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function runScriptOnGroup(payload: {
  scriptId: string;
  groupId: string;
  parameters?: Record<string, string | number | boolean>;
}) {
  return authorizedApiRequest<{
    total: number;
    items: ScriptExecutionRecord[];
  }>('/script-executions/run-group', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function scheduleScript(payload: {
  scriptId: string;
  deviceId?: string;
  groupId?: string;
  runAt: string;
  parameters?: Record<string, string | number | boolean>;
}) {
  return authorizedApiRequest<ScheduledScriptJobRecord>('/script-executions/schedule', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function listScriptExecutions(
  query: ListQuery & {
    scriptId?: string;
    deviceId?: string;
    status?: 'queued' | 'running' | 'success' | 'failed';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<ScriptExecutionRecord>>(
    `/script-executions${toQuery(query)}`
  );
}

export async function getScriptExecution(executionId: string) {
  return authorizedApiRequest<ScriptExecutionRecord>(`/script-executions/${executionId}`);
}

export async function listScheduledScriptJobs(query: { page?: number; limit?: number } = {}) {
  return authorizedApiRequest<PaginatedResponse<ScheduledScriptJobRecord>>(
    `/script-executions/scheduled${toQuery(query)}`
  );
}

export async function listAutomations(
  query: ListQuery & {
    trigger?: 'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created';
    enabled?: boolean;
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<AutomationRecord>>(`/automations${toQuery(query)}`);
}

export async function createAutomation(payload: {
  name: string;
  trigger: 'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created';
  conditions?: Record<string, unknown>;
  actions: Array<{
    type:
      | 'create_ticket'
      | 'send_notification'
      | 'execute_script'
      | 'assign_technician'
      | 'tag_device'
      | 'write_activity_log';
    config?: Record<string, unknown>;
  }>;
  enabled?: boolean;
  retryPolicy?: {
    maxAttempts?: number;
    backoffMs?: number;
  };
}) {
  return authorizedApiRequest<AutomationRecord>('/automations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateAutomation(
  automationId: string,
  payload: Partial<{
    name: string;
    trigger: 'alert_created' | 'device_offline' | 'script_failed' | 'ticket_created';
    conditions: Record<string, unknown>;
    actions: Array<{
      type:
        | 'create_ticket'
        | 'send_notification'
        | 'execute_script'
        | 'assign_technician'
        | 'tag_device'
        | 'write_activity_log';
      config?: Record<string, unknown>;
    }>;
    enabled: boolean;
    retryPolicy: {
      maxAttempts?: number;
      backoffMs?: number;
    };
  }>
) {
  return authorizedApiRequest<AutomationRecord>(`/automations/${automationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteAutomation(automationId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/automations/${automationId}`, {
    method: 'DELETE'
  });
}

export async function listAutomationLogs(
  query: {
    page?: number;
    limit?: number;
    automationId?: string;
    status?: 'running' | 'success' | 'failed' | 'skipped';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<AutomationLogRecord>>(
    `/automations/logs${toQuery(query)}`
  );
}

export async function listUsers() {
  return authorizedApiRequest<UserOption[]>('/users');
}

export async function getDashboardOverview() {
  return authorizedApiRequest<DashboardOverviewResponse>('/dashboards/overview');
}

export function getSocketBaseUrl() {
  const explicitSocketUrl = process.env.NEXT_PUBLIC_WS_URL;

  if (explicitSocketUrl) {
    return explicitSocketUrl.replace(/\/api\/v1$/, '').replace(/\/$/, '');
  }

  if (/^https?:\/\//.test(API_URL)) {
    return API_URL.replace(/\/api\/v1$/, '').replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return 'http://127.0.0.1:3001';
}

export async function getCurrentSessionUser() {
  return authorizedApiRequest<MeResponse>('/auth/me');
}

export interface KnowledgeBaseArticleRecord {
  _id: string;
  tenantId: string;
  title: string;
  slug: string;
  summary: string;
  contentMarkdown: string;
  visibility: 'public' | 'internal';
  tags: string[];
  publishedAt: string | null;
  authorId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContractRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      };
  name: string;
  type: string;
  status: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated';
  startDate: string;
  endDate: string | null;
  monthlyValue: number;
  termsMarkdown: string;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      };
  contractId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
        type: string;
        monthlyValue: number;
      }
    | null;
  number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  issueDate: string;
  dueDate: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionRecord {
  _id: string;
  tenantId: string;
  clientId:
    | string
    | {
        _id: string;
        name: string;
        status: string;
      };
  contractId:
    | string
    | {
        _id: string;
        name: string;
      }
    | null;
  planName: string;
  status: 'active' | 'paused' | 'canceled';
  monthlyPrice: number;
  startedAt: string;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  _id: string;
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatchPolicyRecord {
  _id: string;
  tenantId: string;
  name: string;
  description: string;
  targetTags: string[];
  maintenanceWindow: string;
  autoApprove: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatchRecord {
  _id: string;
  tenantId: string;
  deviceId:
    | string
    | {
        _id: string;
        hostname: string;
        ipAddress: string;
        onlineStatus: string;
      };
  policyId:
    | string
    | {
        _id: string;
        name: string;
        enabled: boolean;
        autoApprove: boolean;
      }
    | null;
  kbId: string;
  title: string;
  severity: string;
  status: 'available' | 'approved' | 'scheduled' | 'installing' | 'installed' | 'failed';
  releasedAt: string | null;
  scheduledAt: string | null;
  installedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export type RemoteAccessProvider =
  | 'easyli-agent'
  | 'builtin-sim'
  | 'rustdesk'
  | 'anydesk'
  | 'teamviewer'
  | 'browser-link';
export type RemoteInteractionMode = 'view-only' | 'shared-control' | 'remote-only';

export interface RemoteSessionMetadata {
  reason?: string;
  operatorNote?: string | null;
  connectionCode?: string;
  passcode?: string;
  launchUrl?: string | null;
  launchLabel?: string | null;
  providerLabel?: string;
  providerMode?: 'embedded-agent' | 'simulated' | 'external-app' | 'browser-link';
  viewerEmbedded?: boolean;
  requiresAgent?: boolean;
  requiresExternalApp?: boolean;
  consentRequired?: boolean;
  interactionMode?: RemoteInteractionMode;
  signalNamespace?: string | null;
  supportsKeyboard?: boolean;
  supportsPointer?: boolean;
  supportsClipboard?: boolean;
  supportsFileTransfer?: boolean;
  instructions?: string[];
  [key: string]: unknown;
}

export interface RemoteSessionRecord {
  _id: string;
  tenantId: string;
  deviceId:
    | string
    | {
        _id: string;
        hostname: string;
        ipAddress: string;
        onlineStatus: string;
      };
  requestedBy:
    | string
    | {
        _id: string;
        email: string;
        status: string;
      }
    | null;
  status: 'requested' | 'active' | 'ended' | 'failed';
  provider: RemoteAccessProvider;
  startedAt: string | null;
  endedAt: string | null;
  metadata: RemoteSessionMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationRecord {
  _id: string;
  tenantId: string;
  name: string;
  type: 'webhook' | 'smtp';
  config: Record<string, unknown>;
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyRecord {
  _id: string;
  tenantId: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SettingRecord {
  _id: string;
  tenantId: string;
  key: string;
  value: Record<string, unknown>;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function listKnowledgeBaseArticles(
  query: ListQuery & { visibility?: 'public' | 'internal' } = {}
) {
  return authorizedApiRequest<PaginatedResponse<KnowledgeBaseArticleRecord>>(
    `/knowledge-base/articles${toQuery(query)}`
  );
}

export async function getKnowledgeBaseArticle(articleId: string) {
  return authorizedApiRequest<KnowledgeBaseArticleRecord>(`/knowledge-base/articles/${articleId}`);
}

export async function createKnowledgeBaseArticle(payload: {
  title: string;
  slug?: string;
  summary?: string;
  contentMarkdown: string;
  visibility?: 'public' | 'internal';
  tags?: string[];
  publishedAt?: string;
}) {
  return authorizedApiRequest<KnowledgeBaseArticleRecord>('/knowledge-base/articles', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateKnowledgeBaseArticle(
  articleId: string,
  payload: Partial<{
    title: string;
    slug: string;
    summary: string;
    contentMarkdown: string;
    visibility: 'public' | 'internal';
    tags: string[];
    publishedAt: string | null;
  }>
) {
  return authorizedApiRequest<KnowledgeBaseArticleRecord>(`/knowledge-base/articles/${articleId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteKnowledgeBaseArticle(articleId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/knowledge-base/articles/${articleId}`, {
    method: 'DELETE'
  });
}

export async function listContracts(
  query: ListQuery & {
    clientId?: string;
    status?: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<ContractRecord>>(`/contracts${toQuery(query)}`);
}

export async function createContract(payload: {
  clientId: string;
  name: string;
  type?: string;
  status?: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated';
  startDate: string;
  endDate?: string;
  monthlyValue?: number;
  termsMarkdown?: string;
  autoRenew?: boolean;
}) {
  return authorizedApiRequest<ContractRecord>('/contracts', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateContract(
  contractId: string,
  payload: Partial<{
    clientId: string;
    name: string;
    type: string;
    status: 'draft' | 'active' | 'suspended' | 'expired' | 'terminated';
    startDate: string;
    endDate: string;
    monthlyValue: number;
    termsMarkdown: string;
    autoRenew: boolean;
  }>
) {
  return authorizedApiRequest<ContractRecord>(`/contracts/${contractId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listInvoices(
  query: ListQuery & {
    clientId?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<InvoiceRecord>>(`/billing/invoices${toQuery(query)}`);
}

export async function createInvoice(payload: {
  clientId: string;
  contractId?: string;
  number: string;
  status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
  issueDate: string;
  dueDate: string;
  currency?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  paidAt?: string;
}) {
  return authorizedApiRequest<InvoiceRecord>('/billing/invoices', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateInvoice(
  invoiceId: string,
  payload: Partial<{
    clientId: string;
    contractId: string;
    number: string;
    status: 'draft' | 'sent' | 'paid' | 'overdue' | 'void';
    issueDate: string;
    dueDate: string;
    currency: string;
    subtotal: number;
    tax: number;
    total: number;
    paidAt: string | null;
  }>
) {
  return authorizedApiRequest<InvoiceRecord>(`/billing/invoices/${invoiceId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listSubscriptions(
  query: {
    page?: number;
    limit?: number;
    clientId?: string;
    status?: 'active' | 'paused' | 'canceled';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<SubscriptionRecord>>(
    `/billing/subscriptions${toQuery(query)}`
  );
}

export async function createSubscription(payload: {
  clientId: string;
  contractId?: string;
  planName: string;
  status?: 'active' | 'paused' | 'canceled';
  monthlyPrice?: number;
  startedAt: string;
  canceledAt?: string;
}) {
  return authorizedApiRequest<SubscriptionRecord>('/billing/subscriptions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function billingMonthlySummary(query: { year?: number; month?: number } = {}) {
  return authorizedApiRequest<{
    period: { year: number; month: number; start: string; end: string };
    invoices: { count: number; totalBilled: number; paid: number; outstanding: number };
    subscriptions: { active: number; recurringMonthly: number };
    revenue: { recognized: number; projected: number };
  }>(`/billing/summary/monthly${toQuery(query)}`);
}

export async function listAuditLogs(
  query: { page?: number; limit?: number; action?: string; entityType?: string; userId?: string } = {}
) {
  return authorizedApiRequest<PaginatedResponse<AuditLogRecord>>(`/audit/logs${toQuery(query)}`);
}

export async function listPatchPolicies() {
  return authorizedApiRequest<PatchPolicyRecord[]>('/patch-management/policies');
}

export async function createPatchPolicy(payload: {
  name: string;
  description?: string;
  targetTags?: string[];
  maintenanceWindow?: string;
  autoApprove?: boolean;
  enabled?: boolean;
}) {
  return authorizedApiRequest<PatchPolicyRecord>('/patch-management/policies', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updatePatchPolicy(
  policyId: string,
  payload: Partial<{
    name: string;
    description: string;
    targetTags: string[];
    maintenanceWindow: string;
    autoApprove: boolean;
    enabled: boolean;
  }>
) {
  return authorizedApiRequest<PatchPolicyRecord>(`/patch-management/policies/${policyId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function listPatches(
  query: {
    page?: number;
    limit?: number;
    deviceId?: string;
    severity?: string;
    status?: 'available' | 'approved' | 'scheduled' | 'installing' | 'installed' | 'failed';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<PatchRecord>>(`/patch-management/patches${toQuery(query)}`);
}

export async function simulatePatchScan(payload: {
  deviceId: string;
  kbId: string;
  title: string;
  severity?: string;
  policyId?: string;
}) {
  return authorizedApiRequest<PatchRecord>('/patch-management/patches/simulate-scan', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function approvePatch(patchId: string) {
  return authorizedApiRequest<PatchRecord>(`/patch-management/patches/${patchId}/approve`, {
    method: 'POST'
  });
}

export async function schedulePatch(patchId: string, scheduledAt: string) {
  return authorizedApiRequest<PatchRecord>(`/patch-management/patches/${patchId}/schedule`, {
    method: 'POST',
    body: JSON.stringify({ scheduledAt })
  });
}

export async function executePatch(patchId: string) {
  return authorizedApiRequest<PatchRecord>(`/patch-management/patches/${patchId}/execute`, {
    method: 'POST'
  });
}

export async function listRemoteSessions(
  query: {
    page?: number;
    limit?: number;
    deviceId?: string;
    status?: 'requested' | 'active' | 'ended' | 'failed';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<RemoteSessionRecord>>(`/remote-access/sessions${toQuery(query)}`);
}

export async function createRemoteSession(payload: {
  deviceId: string;
  provider?: RemoteAccessProvider;
  metadata?: RemoteSessionMetadata;
}) {
  return authorizedApiRequest<RemoteSessionRecord>('/remote-access/sessions', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function getRemoteSession(sessionId: string) {
  return authorizedApiRequest<RemoteSessionRecord>(`/remote-access/sessions/${sessionId}`);
}

export async function startRemoteSession(sessionId: string) {
  return authorizedApiRequest<RemoteSessionRecord>(`/remote-access/sessions/${sessionId}/start`, {
    method: 'POST'
  });
}

export async function endRemoteSession(sessionId: string) {
  return authorizedApiRequest<RemoteSessionRecord>(`/remote-access/sessions/${sessionId}/end`, {
    method: 'POST'
  });
}

export async function updateRemoteSessionInteractionMode(sessionId: string, interactionMode: RemoteInteractionMode) {
  return authorizedApiRequest<RemoteSessionRecord>(`/remote-access/sessions/${sessionId}/interaction-mode`, {
    method: 'PATCH',
    body: JSON.stringify({ interactionMode })
  });
}

export async function listIntegrations(query: { type?: 'webhook' | 'smtp' } = {}) {
  return authorizedApiRequest<IntegrationRecord[]>(`/integrations${toQuery(query)}`);
}

export async function createIntegration(payload: {
  name: string;
  type: 'webhook' | 'smtp';
  config?: Record<string, unknown>;
  enabled?: boolean;
}) {
  return authorizedApiRequest<IntegrationRecord>('/integrations', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateIntegration(
  integrationId: string,
  payload: Partial<{
    name: string;
    type: 'webhook' | 'smtp';
    config: Record<string, unknown>;
    enabled: boolean;
  }>
) {
  return authorizedApiRequest<IntegrationRecord>(`/integrations/${integrationId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function deleteIntegration(integrationId: string) {
  return authorizedApiRequest<{ deleted: boolean }>(`/integrations/${integrationId}`, {
    method: 'DELETE'
  });
}

export async function testWebhookIntegration(payload: { event: string; payload?: Record<string, unknown> }) {
  return authorizedApiRequest<{
    delivered: number;
    failed: number;
    results: Array<{ integrationId: string; success: boolean; message: string }>;
  }>('/integrations/test/webhook', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function testEmailIntegration(payload: { to: string; subject: string; html: string }) {
  return authorizedApiRequest<{ provider: string; accepted: boolean; message: string }>(
    '/integrations/test/email',
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}

export async function listSettings() {
  return authorizedApiRequest<SettingRecord[]>('/settings');
}

export async function getSetting(key: string) {
  return authorizedApiRequest<SettingRecord>(`/settings/${key}`);
}

export async function upsertSetting(payload: { key: string; value: Record<string, unknown> }) {
  return authorizedApiRequest<SettingRecord>('/settings', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function listApiKeys() {
  return authorizedApiRequest<ApiKeyRecord[]>('/api-keys');
}

export async function createApiKey(payload: { name: string; scopes?: string[]; expiresAt?: string }) {
  return authorizedApiRequest<{
    id: string;
    name: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt: string | null;
    plainKey: string;
  }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function revokeApiKey(keyId: string) {
  return authorizedApiRequest<{ revoked: boolean; key: ApiKeyRecord }>(`/api-keys/${keyId}/revoke`, {
    method: 'POST'
  });
}

export async function reportTicketsByPeriod(
  query: { from?: string; to?: string; groupBy?: 'day' | 'week'; format?: 'json' | 'csv' } = {}
) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/tickets-by-period${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    range: { from: string; to: string };
    groupBy: 'day' | 'week';
    rows: Array<{ period: string; total: number; open: number; resolved: number }>;
  }>(`/reports/tickets-by-period${toQuery(query)}`);
}

export async function reportAlertsBySeverity(
  query: { from?: string; to?: string; format?: 'json' | 'csv' } = {}
) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/alerts-by-severity${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    range: { from: string; to: string };
    rows: Array<{ severity: string; total: number }>;
  }>(`/reports/alerts-by-severity${toQuery(query)}`);
}

export async function reportAssetsByClient(query: { format?: 'json' | 'csv' } = {}) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/assets-by-client${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    rows: Array<{
      clientId: string;
      clientName: string;
      clientStatus: string;
      devices: number;
      contacts: number;
    }>;
    summary: {
      clients: number;
      devices: number;
      contacts: number;
    };
  }>(`/reports/assets-by-client${toQuery(query)}`);
}

export async function reportSlaCompliance(
  query: { from?: string; to?: string; format?: 'json' | 'csv' } = {}
) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/sla-compliance${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    range: { from: string; to: string };
    firstResponse: { met: number; breached: number; compliance: number };
    resolution: { met: number; breached: number; compliance: number };
    totals: { evaluatedTickets: number };
  }>(`/reports/sla-compliance${toQuery(query)}`);
}

export async function reportScriptExecutionStats(
  query: { from?: string; to?: string; format?: 'json' | 'csv' } = {}
) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/script-execution-stats${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    range: { from: string; to: string };
    totals: {
      total: number;
      queued: number;
      running: number;
      success: number;
      failed: number;
      avgDurationSeconds: number;
    };
  }>(`/reports/script-execution-stats${toQuery(query)}`);
}

export async function reportRevenueSummary(
  query: { from?: string; to?: string; format?: 'json' | 'csv' } = {}
) {
  if (query.format === 'csv') {
    return authorizedApiTextRequest(`/reports/revenue-summary${toQuery(query)}`);
  }
  return authorizedApiRequest<{
    range: { from: string; to: string };
    totals: {
      invoices: number;
      billed: number;
      paid: number;
      overdue: number;
      recurringMonthly: number;
    };
  }>(`/reports/revenue-summary${toQuery(query)}`);
}

interface PortalAuthEnvelope {
  tokens: {
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: string;
  };
  user: MeResponse;
}

export async function portalSignIn(input: { email: string; password: string }) {
  const response = await apiRequest<PortalAuthEnvelope>('/customer-portal/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  setAuthSession({
    accessToken: response.tokens.accessToken,
    refreshToken: response.tokens.refreshToken
  });

  return response.user;
}

export async function portalSignOut() {
  clearAuthSession();
}

export async function portalMe() {
  return authorizedApiRequest<MeResponse>('/customer-portal/me');
}

export async function portalListTickets(
  query: {
    page?: number;
    limit?: number;
    status?: 'open' | 'in_progress' | 'resolved' | 'closed' | 'reopened';
  } = {}
) {
  return authorizedApiRequest<PaginatedResponse<TicketRecord>>(`/customer-portal/tickets${toQuery(query)}`);
}

export async function portalCreateTicket(payload: {
  subject: string;
  description: string;
  clientId?: string;
  deviceId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}) {
  return authorizedApiRequest<TicketRecord>('/customer-portal/tickets', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function portalGetTicket(ticketId: string) {
  return authorizedApiRequest<TicketRecord>(`/customer-portal/tickets/${ticketId}`);
}

export async function portalListTicketComments(ticketId: string) {
  return authorizedApiRequest<TicketCommentRecord[]>(`/customer-portal/tickets/${ticketId}/comments`);
}

export async function portalAddTicketComment(ticketId: string, body: string) {
  return authorizedApiRequest<TicketCommentRecord>(`/customer-portal/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body })
  });
}
