import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  // Protect /admin/* and /api/admin/*
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (isAdminRoute && pathname !== "/admin/login") {
    if (!isLoggedIn) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Only STAFF, ADMIN, SUPER_ADMIN can access admin routes
    if (userRole === "GUEST") {
      return NextResponse.redirect(new URL("/admin/login", req.url));
    }
  }

  // Redirect logged-in admin away from login page
  if (pathname === "/admin/login" && isLoggedIn && userRole !== "GUEST") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Forward the pathname to server components so the admin layout can exempt the
  // /admin/pending-approval holding page from the SALES approval redirect.
  // NOTE: the SALES status gate itself runs in the admin layout (Node runtime),
  // which reads the *fresh* status from the DB — status is not in the JWT here.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
});

export const config = {
  matcher: [
    // /admin root and all sub-paths except /admin/login
    "/admin",
    "/admin/((?!login$).+)",
    "/api/admin/:path*",
  ],
};
