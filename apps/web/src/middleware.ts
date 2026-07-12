import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { getSessionOptions, type SessionData } from "@/lib/session";

const publicPaths = ["/login", "/api/auth/login", "/api/auth/config", "/api/youtube/callback"];

const publicAssets = ["/logo.png", "/icon.png", "/apple-icon.png", "/favicon.ico"];

function isAppPasswordConfigured(): boolean {
  return Boolean(process.env.APP_PASSWORD?.trim());
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    publicAssets.includes(pathname) ||
    pathname.startsWith("/_next")
  ) {
    return NextResponse.next();
  }

  if (!isAppPasswordConfigured()) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "APP_PASSWORD is not configured on the server" },
        { status: 503 }
      );
    }
    return new NextResponse("APP_PASSWORD is not configured", { status: 503 });
  }

  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(
    request,
    response,
    getSessionOptions()
  );

  if (!session.isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
