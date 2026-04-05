import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/platform/login'];

const SUPER_ADMIN_ROUTES = ['/platform'];
const TENANT_ROUTES = ['/dashboard', '/home', '/employees', '/leave', '/payroll'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;

  // Allow public routes
  if (PUBLIC_ROUTES.some((r) => pathname.endsWith(r))) {
    return NextResponse.next();
  }

  // Allow tenant login routes /:tenantSlug/login
  if (pathname.match(/^\/[^/]+\/login$/)) {
    return NextResponse.next();
  }

  // Allow accept-invite and reset-password routes
  if (
    pathname.includes('/accept-invite') ||
    pathname.includes('/reset-password') ||
    pathname.includes('/verify-account')
  ) {
    return NextResponse.next();
  }

  // Redirect to login if no token
  if (!accessToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
