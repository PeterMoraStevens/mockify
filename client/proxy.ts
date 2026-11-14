import { NextResponse, type NextRequest } from "next/server";

// Cheap cookie-presence gate for pages. Real session validation happens in
// server components and every API route via requireUser().
const PROTECTED = ["/room", "/match", "/profile", "/problems/new"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }
  if (request.cookies.has("mockify_session")) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/room/:path*", "/match", "/profile", "/problems/new"],
};
