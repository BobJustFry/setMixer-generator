import { NextResponse } from "next/server";
import { disconnectYouTube, getYouTubeAuthUrl } from "@/lib/youtube";

export async function DELETE() {
  await disconnectYouTube();
  let authUrl: string | null = null;
  try {
    authUrl = await getYouTubeAuthUrl();
  } catch {
    authUrl = null;
  }
  return NextResponse.json({ ok: true, authUrl });
}
