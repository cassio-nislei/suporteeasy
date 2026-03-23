import { NextRequest, NextResponse } from 'next/server';

const protectedPaths = ['/dashboard', '/onboarding', '/clients', '/devices', '/alerts', '/tickets'];
const authPaths = ['/sign-in'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('accessToken')?.value;

  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));
  const isAuthPath = authPaths.some((path) => pathname.startsWith(path));

  if (isProtected && !accessToken) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  if (isAuthPath && accessToken) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/onboarding',
    '/clients/:path*',
    '/devices/:path*',
    '/alerts/:path*',
    '/tickets/:path*',
    '/sign-in'
  ]
};
