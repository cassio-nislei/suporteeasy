import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_PUBLIC_PATHS = new Set(['/sign-in', '/onboarding']);
const PORTAL_SIGN_IN_PATH = '/portal/sign-in';

function hasSession(request: NextRequest): boolean {
  const accessToken = request.cookies.get('accessToken')?.value;
  const refreshToken = request.cookies.get('refreshToken')?.value;
  return Boolean(accessToken || refreshToken);
}

function isStaticPath(pathname: string): boolean {
  return (
    pathname.startsWith('/backend-api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/images') ||
    pathname === '/favicon.ico' ||
    pathname.includes('.')
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isStaticPath(pathname)) {
    return NextResponse.next();
  }

  const sessionExists = hasSession(request);

  if (pathname.startsWith('/portal')) {
    if (pathname === PORTAL_SIGN_IN_PATH) {
      if (sessionExists) {
        return NextResponse.redirect(new URL('/portal/tickets', request.url));
      }
      return NextResponse.next();
    }

    if (!sessionExists) {
      return NextResponse.redirect(new URL(PORTAL_SIGN_IN_PATH, request.url));
    }

    return NextResponse.next();
  }

  if (pathname === '/sign-in') {
    if (sessionExists) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (INTERNAL_PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (!sessionExists) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!backend-api|_next/static|_next/image|favicon.ico).*)']
};
