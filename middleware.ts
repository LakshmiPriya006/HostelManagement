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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
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
  let userRole: 'owner' | 'hosteller' | null = null;
  let ownerHasHostel: boolean | null = null;

  if (user) {
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (roleData?.role === 'owner' || roleData?.role === 'hosteller') {
      userRole = roleData.role;
    }

    if (userRole === 'owner') {
      const { data: firstHostel } = await supabase
        .from('hostels')
        .select('id')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      ownerHasHostel = !!firstHostel;
    }
  }

  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';
  const path = url.pathname;

  // Determine domain
  const isOwnerDomain = hostname.startsWith('owner.');
  const isHostellerDomain = hostname.startsWith('app.');

  // Handle Owner Domain Rewrites & Protection
  if (isOwnerDomain) {
    if (user && userRole !== 'owner') {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/owner/login?error=Wrong portal account', request.url));
    }

    // Redirect/Rewrite root based on auth
    if (path === '/') {
      if (user && userRole === 'owner') {
        return NextResponse.rewrite(new URL(ownerHasHostel ? '/owner/dashboard' : '/owner/setup', request.url));
      }
      return NextResponse.rewrite(new URL('/owner/login', request.url));
    }
    
    // Prefix paths with /owner if not already prefixed
    if (!path.startsWith('/owner') && !path.startsWith('/_next') && !path.startsWith('/api')) {
      const rewrittenUrl = new URL(`/owner${path}`, request.url);
      const isPublicOwnerPath = path.startsWith('/login') || path.startsWith('/signup');

      if (user && userRole === 'owner' && !isPublicOwnerPath) {
        if (!ownerHasHostel && !path.startsWith('/setup')) {
          return NextResponse.redirect(new URL('/owner/setup', request.url));
        }
        if (ownerHasHostel && path.startsWith('/setup')) {
          return NextResponse.redirect(new URL('/owner/dashboard', request.url));
        }
      }
      
      // Protect the rewritten route
      if (!isPublicOwnerPath && !user) {
        return NextResponse.redirect(new URL('/owner/login', request.url));
      }
      return NextResponse.rewrite(rewrittenUrl);
    }

    // Protect explicit /owner routes
    if (path.startsWith('/owner') && !path.startsWith('/owner/login') && !path.startsWith('/owner/signup')) {
      if (!user || userRole !== 'owner') {
        return NextResponse.redirect(new URL('/owner/login', request.url));
      }

      if (!ownerHasHostel && !path.startsWith('/owner/setup')) {
        return NextResponse.redirect(new URL('/owner/setup', request.url));
      }

      if (ownerHasHostel && path.startsWith('/owner/setup')) {
        return NextResponse.redirect(new URL('/owner/dashboard', request.url));
      }
    }
  }

  // Handle Hosteller Domain Rewrites & Protection
  if (isHostellerDomain) {
    if (user && userRole !== 'hosteller') {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/hosteller/login?error=Wrong portal account', request.url));
    }

    if (path === '/') {
      return NextResponse.rewrite(new URL(user && userRole === 'hosteller' ? '/hosteller/home' : '/hosteller/login', request.url));
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
      if (!user || userRole !== 'hosteller') {
        return NextResponse.redirect(new URL('/hosteller/login', request.url));
      }
    }
  }

  // Fallback protection for paths directly accessed without domain matching (e.g. localhost testing)
  if (path.startsWith('/owner') && !path.startsWith('/owner/login') && !path.startsWith('/owner/signup') && (!user || userRole !== 'owner')) {
    return NextResponse.redirect(new URL('/owner/login', request.url));
  }
  if (path.startsWith('/owner') && user && userRole === 'owner') {
    if (!ownerHasHostel && !path.startsWith('/owner/setup')) {
      return NextResponse.redirect(new URL('/owner/setup', request.url));
    }
    if (ownerHasHostel && path.startsWith('/owner/setup')) {
      return NextResponse.redirect(new URL('/owner/dashboard', request.url));
    }
  }
  if (path.startsWith('/hosteller') && !path.startsWith('/hosteller/login') && (!user || userRole !== 'hosteller')) {
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
