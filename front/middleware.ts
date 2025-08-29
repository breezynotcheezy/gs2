import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Prevent direct access to API routes from the client
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL('/api/not-found', request.url));
  }
  
  return NextResponse.next();
}

export const config = {
  // Match all API routes
  matcher: ['/api/:path*'],
};
