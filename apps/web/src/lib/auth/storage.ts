export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_KEY = 'easyli.access_token';
const REFRESH_TOKEN_KEY = 'easyli.refresh_token';

function cookieSecurityFlags(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '; secure';
  }

  return '';
}

export function setAuthSession(tokens: SessionTokens): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);

  const securityFlags = cookieSecurityFlags();
  document.cookie = `accessToken=${tokens.accessToken}; path=/; max-age=900; samesite=lax${securityFlags}`;
  document.cookie = `refreshToken=${tokens.refreshToken}; path=/; max-age=604800; samesite=lax${securityFlags}`;
}

export function clearAuthSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  const securityFlags = cookieSecurityFlags();
  document.cookie = `accessToken=; path=/; max-age=0; samesite=lax${securityFlags}`;
  document.cookie = `refreshToken=; path=/; max-age=0; samesite=lax${securityFlags}`;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem(REFRESH_TOKEN_KEY);
}
