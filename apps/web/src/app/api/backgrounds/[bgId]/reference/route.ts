import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";

import { getBackgroundImage } from "@/lib/backgrounds";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bgId: string }> }
) {
  const { bgId } = await params;
  const bg = await getBackgroundImage(bgId);

  if (!bg?.referenceImagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await readFile(bg.referenceImagePath);
    const ext = bg.referenceImagePath.toLowerCase();
    const type = ext.endsWith(".png")
      ? "image/png"
      : ext.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File missing" }, { status: 404 });
  }
}
