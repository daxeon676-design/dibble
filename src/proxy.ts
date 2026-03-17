import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });

  if (pathname.startsWith("/admin")) {
    if (!token) return redirectToLogin(request);

    if (token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }

    if (!token.mfaEnabled && pathname !== "/admin/mfa-setup") {
      return NextResponse.redirect(new URL("/admin/mfa-setup", request.url));
    }

    return NextResponse.next();
  }

  if (pathname.startsWith("/seller")) {
    if (!token) return redirectToLogin(request);
    if (token.role !== "SELLER" && token.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/buyer")) {
    if (!token) return redirectToLogin(request);
    if (!token.role || !["BUYER", "SELLER", "ADMIN"].includes(String(token.role))) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/buyer/:path*", "/seller/:path*", "/admin/:path*"],
};
