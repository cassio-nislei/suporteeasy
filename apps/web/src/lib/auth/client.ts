import { clearAuthSession, getAccessToken, getRefreshToken, setAuthSession } from './storage';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/backend-api';

export interface PaginatedResponse<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: string;
}

export interface MeResponse {
  id: string;
  email: string;
  tenantId: string | null;
  status: string;
  isPortalUser?: boolean;
  portalClientIds?: string[];
  roleIds: string[];
  permissions: string[];
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
  } | null;
  roles: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
}

interface AuthEnvelope {
  tokens: AuthTokens;
  user: MeResponse;
}

function normalizeRequestError(error: unknown, path: string): Error {
  if (error instanceof TypeError) {
    return new Error(
      `Unable to reach API at ${API_URL}${path}. Check whether the backend is running and accessible.`
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error(String(error));
}

async function fetchApi(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    throw normalizeRequestError(error, path);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetchApi(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  if (!response.ok) {
    const message = await extractErrorMessage(response);
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join(', ');
    }

    return body.message ?? `Request failed with status ${response.status}`;
  } catch {
    return `Request failed with status ${response.status}`;
  }
}

export async function signIn(input: LoginInput): Promise<MeResponse> {
  const response = await apiRequest<AuthEnvelope>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  setAuthSession({
    accessToken: response.tokens.accessToken,
    refreshToken: response.tokens.refreshToken
  });

  return response.user;
}

export async function refreshSession(): Promise<AuthTokens> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearAuthSession();
    throw new Error('No refresh token found');
  }

  let response: AuthEnvelope;

  try {
    response = await apiRequest<AuthEnvelope>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    });
  } catch (error) {
    clearAuthSession();
    throw error;
  }

  setAuthSession({
    accessToken: response.tokens.accessToken,
    refreshToken: response.tokens.refreshToken
  });

  return response.tokens;
}

export async function authorizedApiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  let accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('No session token');
  }

  let response = await fetchApi(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {})
    }
  });

  if (response.status === 401) {
    try {
      const tokens = await refreshSession();
      accessToken = tokens.accessToken;
    } catch (error) {
      clearAuthSession();
      throw error;
    }

    response = await fetchApi(path, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {})
      }
    });
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function authorizedApiTextRequest(path: string, init: RequestInit = {}): Promise<string> {
  let accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('No session token');
  }

  let response = await fetchApi(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.headers ?? {})
    }
  });

  if (response.status === 401) {
    try {
      const tokens = await refreshSession();
      accessToken = tokens.accessToken;
    } catch (error) {
      clearAuthSession();
      throw error;
    }

    response = await fetchApi(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(init.headers ?? {})
      }
    });
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return response.text();
}

export async function getMe(): Promise<MeResponse> {
  let accessToken = getAccessToken();

  if (!accessToken) {
    throw new Error('No session token');
  }

  let response = await fetchApi('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (response.status === 401) {
    try {
      const tokens = await refreshSession();
      accessToken = tokens.accessToken;
    } catch (error) {
      clearAuthSession();
      throw error;
    }

    response = await fetchApi('/auth/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  }

  if (!response.ok) {
    throw new Error(await extractErrorMessage(response));
  }

  return (await response.json()) as MeResponse;
}

export async function signOut(): Promise<void> {
  const accessToken = getAccessToken();

  if (accessToken) {
    await fetchApi('/auth/logout', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }).catch(() => undefined);
  }

  clearAuthSession();
}
