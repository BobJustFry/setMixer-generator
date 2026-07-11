import { NextResponse } from "next/server";
import { getYouTubeAuthUrl, getYouTubeStatus } from "@/lib/youtube";

export async function GET() {
  const status = await getYouTubeStatus();
  let authUrl: string | null = null;
  if (status.configured && !status.connected) {
    try {
      authUrl = await getYouTubeAuthUrl();
    } catch {
      authUrl = null;
    }
  }
  return NextResponse.json({ ...status, authUrl });
}
