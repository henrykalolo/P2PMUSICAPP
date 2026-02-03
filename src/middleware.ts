import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Routes that require authentication
const protectedRoutes = [
  '/api/onboarding',
  '/api/social',
  '/api/upload',
];

// Routes that require onboarding completion
const onboardingRequiredRoutes = [
  '/api/upload',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { method } = request;

  // Allow unauthenticated GET requests to /api/tracks and /api/social/profile
  if ((pathname.startsWith('/api/tracks') && method === 'GET') || 
      (pathname.startsWith('/api/social/profile') && method === 'GET') ||
      (pathname.startsWith('/api/social/likes') && method === 'GET')) {
    return NextResponse.next();
  }

  // Check if route is protected
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route));
  
  if (!isProtected) {
    return NextResponse.next();
  }

  // Get token from header
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return NextResponse.json(
      { error: 'Invalid token' },
      { status: 401 }
    );
  }

  // Check if route requires onboarding
  const requiresOnboarding = onboardingRequiredRoutes.some(route => 
    pathname.startsWith(route)
  );

  if (requiresOnboarding && !payload.onboardingCompleted) {
    return NextResponse.json(
      { error: 'Onboarding incomplete' },
      { status: 403 }
    );
  }

  // Add user info to request headers for downstream use
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-id', payload.userId);
  requestHeaders.set('x-user-role', payload.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: '/api/:path*',
};
