import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

const PUBLIC_PATHS = [
  "/login",
  "/icon",
  "/apple-icon",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/site.webmanifest",
  "/manifest.webmanifest",
];
const STATIC_FILE_PATTERN = /\.(?:ico|png|jpg|jpeg|gif|webp|svg|css|js|map|txt|xml|webmanifest)$/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    pathname.startsWith("/_next/") ||
    STATIC_FILE_PATTERN.test(pathname)
  );
}
