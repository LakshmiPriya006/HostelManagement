import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const path = url.pathname;

  // Determine domain
  const isOwnerDomain = hostname.startsWith('owner.');
  const isHostellerDomain = hostname.startsWith('app.');

  // Handle Owner Domain Rewrites & Protection
  if (isOwnerDomain) {
    // Redirect/Rewrite root based on auth
    if (path === '/') {
      return NextResponse.rewrite(new URL(user ? '/owner/dashboard' : '/owner/login', request.url));
    }
    
    // Prefix paths with /owner if not already prefixed
    if (!path.startsWith('/owner') && !path.startsWith('/_next') && !path.startsWith('/api')) {
      const rewrittenUrl = new URL(`/owner${path}`, request.url);
      
      // Protect the rewritten route
      if (!path.startsWith('/login') && !path.startsWith('/signup') && !user) {
        return NextResponse.redirect(new URL('/owner/login', request.url));
      }
      return NextResponse.rewrite(rewrittenUrl);
    }

    // Protect explicit /owner routes
    if (path.startsWith('/owner') && !path.startsWith('/owner/login') && !path.startsWith('/owner/signup')) {
      if (!user) {
        return NextResponse.redirect(new URL('/owner/login', request.url));
      }
    }
  }

  // Handle Hosteller Domain Rewrites & Protection
  if (isHostellerDomain) {
    if (path === '/') {
      return NextResponse.rewrite(new URL(user ? '/hosteller/home' : '/hosteller/login', request.url));
    }

    if (!path.startsWith('/hosteller') && !path.startsWith('/_next') && !path.startsWith('/api')) {
      const rewrittenUrl = new URL(`/hosteller${path}`, request.url);
      
      if (!path.startsWith('/login') && !user) {
        return NextResponse.redirect(new URL('/hosteller/login', request.url));
      }
      return NextResponse.rewrite(rewrittenUrl);
    }

    // Protect explicit /hosteller routes
    if (path.startsWith('/hosteller') && !path.startsWith('/hosteller/login')) {
      if (!user) {
        return NextResponse.redirect(new URL('/hosteller/login', request.url));
      }
    }
  }

  // Fallback protection for paths directly accessed without domain matching (e.g. localhost testing)
  if (path.startsWith('/owner') && !path.startsWith('/owner/login') && !path.startsWith('/owner/signup') && !user) {
    return NextResponse.redirect(new URL('/owner/login', request.url));
  }
  if (path.startsWith('/hosteller') && !path.startsWith('/hosteller/login') && !user) {
    return NextResponse.redirect(new URL('/hosteller/login', request.url));
  }
  if (path === '/') {
    // Generic fallback redirect if accessed via localhost without subdomains
    if (!user) return NextResponse.redirect(new URL('/owner/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
