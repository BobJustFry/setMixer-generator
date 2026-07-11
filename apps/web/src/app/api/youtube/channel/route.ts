import { NextRequest, NextResponse } from "next/server";
import { setActiveYouTubeChannel } from "@/lib/youtube";

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
    if (!channelId) {
      return NextResponse.json({ error: "Укажите channelId" }, { status: 400 });
    }

    const channel = await setActiveYouTubeChannel(channelId);
    return NextResponse.json({ ok: true, channel });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось сменить канал";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
