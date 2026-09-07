import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const PROTECTED_PREFIXES = ["/onboarding", "/recommendations", "/dashboard", "/explore", "/groups", "/mi-super", "/mar-antonia"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // "/" is the super-app hub now -- someone already logged in who lands on
  // /login or /register belongs there, not funneled straight into MovieMatch.
  if ((pathname === "/login" || pathname === "/register") && req.auth) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/recommendations/:path*",
    "/dashboard/:path*",
    "/explore/:path*",
    "/groups/:path*",
    "/mi-super/:path*",
    "/mar-antonia/:path*",
    "/login",
    "/register",
  ],
};
