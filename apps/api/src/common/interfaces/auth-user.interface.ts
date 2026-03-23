export interface AuthUser {
  sub: string;
  tenantId: string | null;
  email: string;
  roleIds: string[];
  permissions: string[];
  isPortalUser?: boolean;
}
