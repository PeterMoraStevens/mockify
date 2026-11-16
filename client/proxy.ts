import { NextResponse, type NextRequest } from "next/server";

// Cheap cookie-presence gate for pages. Real session validation happens in
// server components and every API route via requireUser().
const PROTECTED = ["/room", "/rooms", "/friends", "/interviews", "/profile", "/problems/new", "/problems/library"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (request.cookies.has("mockify_session")) return NextResponse.next();

  const login = `/login?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(new URL(login, publicOrigin(request)), 307);
}

/**
 * The origin the browser actually used. request.nextUrl carries the server's
 * bind address (e.g. http://0.0.0.0:3000) behind Coolify/Traefik/cloudflared,
 * and middleware redirects must be absolute, so rebuild it from the headers.
 */
function publicOrigin(request: NextRequest): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || request.nextUrl.host;
  const https =
    h.get("cf-visitor")?.includes('"https"') ||
    h.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https" ||
    request.nextUrl.protocol === "https:";
  return `${https ? "https" : "http"}://${host}`;
}

export const config = {
  matcher: ["/room/:path*", "/rooms", "/friends", "/interviews/:path*", "/profile", "/problems/new", "/problems/library"],
};
