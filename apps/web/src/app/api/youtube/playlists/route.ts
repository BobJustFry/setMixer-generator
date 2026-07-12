import { NextResponse } from "next/server";
import { listYouTubePlaylists } from "@/lib/youtube";

export async function GET() {
  try {
    const playlists = await listYouTubePlaylists();
    return NextResponse.json(playlists);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Не удалось загрузить плейлисты";
    const needsReauth =
      message.includes("insufficient") ||
      message.includes("Insufficient") ||
      message.includes("403");
    return NextResponse.json(
      {
        error: needsReauth
          ? "Нужна повторная авторизация Google (добавлен доступ к плейлистам). Настройки → Авторизоваться в Google."
          : message,
        needsReauth,
      },
      { status: needsReauth ? 403 : 500 }
    );
  }
}
