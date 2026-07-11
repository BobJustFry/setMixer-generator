import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; bgId: string }> }
) {
  const { id: mixId, bgId } = await params;

  const bg = await prisma.mixBackground.findFirst({
    where: { id: bgId, mixId },
  });

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
  { params }: { params: Promise<{ id: string; bgId: string }> }
) {
  const { id: mixId, bgId } = await params;

  const inUse = await prisma.videoJob.count({
    where: { backgroundId: bgId },
  });
  if (inUse > 0) {
    return NextResponse.json(
      { error: "Обложка используется в задаче видео" },
      { status: 409 }
    );
  }

  await prisma.mixBackground.deleteMany({ where: { id: bgId, mixId } });
  return NextResponse.json({ ok: true });
}
