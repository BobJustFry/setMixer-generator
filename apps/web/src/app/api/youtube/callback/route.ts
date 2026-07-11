import { NextRequest, NextResponse } from "next/server";
import { saveYouTubeTokens } from "@/lib/youtube";
import { getDecryptedSecrets } from "@/lib/settings";
import { decodeYouTubeError, normalizeAppUrl } from "@/lib/youtube-oauth-errors";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  const secrets = await getDecryptedSecrets();
  const baseUrl = normalizeAppUrl(secrets.appUrl);

  if (error) {
    const msg = decodeYouTubeError(error) || error;
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=${encodeURIComponent(msg)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=${encodeURIComponent("no_code")}`
    );
  }

  try {
    await saveYouTubeTokens(code);
    return NextResponse.redirect(`${baseUrl}/settings?youtube_connected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const decoded = decodeYouTubeError(msg) || msg;
    return NextResponse.redirect(
      `${baseUrl}/settings?youtube_error=${encodeURIComponent(decoded)}`
    );
  }
}
