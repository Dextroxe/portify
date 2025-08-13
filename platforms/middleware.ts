import { type NextRequest, NextResponse } from 'next/server';
import { rootDomain } from '@/lib/utils';

function extractSubdomain(request: NextRequest): string | null {
  const url = request.url;
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];

  // Local development environment
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    // Try to extract subdomain from the full URL
    const fullUrlMatch = url.match(/http:\/\/([^.]+)\.localhost/);
    if (fullUrlMatch && fullUrlMatch[1]) {
      return fullUrlMatch[1];
    }

    // Fallback to host header approach
    if (hostname.includes('.localhost')) {
      return hostname.split('.')[0];
    }

    return null;
  }

  // Production environment
  const rootDomainFormatted = rootDomain.split(':')[0];

  // Handle Vercel preview deployment URLs (tenant---branch-name.vercel.app)
  if (hostname.includes('---') && hostname.endsWith('.vercel.app')) {
    const parts = hostname.split('---');
    return parts.length > 0 ? parts[0] : null;
  }

  // Handle Vercel production wildcard subdomains (subdomain.project-name.vercel.app)
  if (hostname.endsWith('.vercel.app')) {
    const vercelPattern = /^([^.]+)\.(.+)\.vercel\.app$/;
    const match = hostname.match(vercelPattern);
    if (match && match[1] && match[2]) {
      const subdomain = match[1];
      const projectDomain = `${match[2]}.vercel.app`;
      
      // Check if this matches our root domain
      if (projectDomain === rootDomainFormatted) {
        return subdomain;
      }
    }
    return null;
  }

  // Regular subdomain detection for custom domains
  const isSubdomain =
    hostname !== rootDomainFormatted &&
    hostname !== `www.${rootDomainFormatted}` &&
    hostname.endsWith(`.${rootDomainFormatted}`);

  return isSubdomain ? hostname.replace(`.${rootDomainFormatted}`, '') : null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const subdomain = extractSubdomain(request);

  // Debug logging (remove in production)
  console.log('Middleware Debug:', {
    host: request.headers.get('host'),
    pathname,
    subdomain,
    rootDomain
  });

  if (subdomain) {
    // Block access to admin page from subdomains
    if (pathname.startsWith('/admin')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // For the root path on a subdomain, rewrite to the subdomain page
    if (pathname === '/') {
      return NextResponse.rewrite(new URL(`/s/${subdomain}`, request.url));
    }

    // For other paths on subdomains, you might want to handle them differently
    // For now, let them pass through normally
  }

  // On the root domain, allow normal access
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /_vercel (Vercel internals)
     * 4. all root files inside /public (e.g. /favicon.ico)
     */
    '/((?!api|_next|_vercel|[\\w-]+\\.\\w+).*)'
  ]
};