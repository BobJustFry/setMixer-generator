import { NextRequest } from "next/server";
import { readFile } from "fs/promises";
import { NextResponse } from "next/server";

import { deleteBackground, getBackgroundImage } from "@/lib/backgrounds";
import { toJsonResponse } from "@/lib/utils";
import type { ImageFitMode } from "@/lib/image-utils";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const VALID_FIT_MODES = new Set<ImageFitMode>(["cover", "stretch", "contain"]);

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bgId: string }> }
) {
  const { bgId } = await params;
  const bg = await getBackgroundImage(bgId);

  if (!bg?.imagePath) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const buf = await readFile(bg.imagePath);
    const ext = bg.imagePath.toLowerCase();
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ bgId: string }> }
) {
  const { bgId } = await params;
  const result = await deleteBackground(bgId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
