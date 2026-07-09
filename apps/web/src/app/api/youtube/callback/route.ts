import { NextRequest, NextResponse } from "next/server";
import { saveYouTubeTokens } from "@/lib/youtube";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/settings?youtube_error=no_code`);
  }

  try {
    await saveYouTubeTokens(code);
    return NextResponse.redirect(`${baseUrl}/settings?youtube_connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=${encodeURIComponent(msg)}`
    );
  }
}
