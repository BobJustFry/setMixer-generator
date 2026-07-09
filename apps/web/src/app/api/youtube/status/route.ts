import { NextResponse } from "next/server";
import { getYouTubeAuthUrl, getYouTubeStatus } from "@/lib/youtube";

export async function GET() {
  const status = await getYouTubeStatus();
  let authUrl: string | null = null;
  try {
    authUrl = getYouTubeAuthUrl();
  } catch {
    authUrl = null;
  }
  return NextResponse.json({ ...status, authUrl });
}
