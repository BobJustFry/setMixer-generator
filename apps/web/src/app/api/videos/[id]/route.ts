import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const video = await prisma.generatedVideo.findUnique({
    where: { id },
    include: {
      videoJob: { include: { youtubeUpload: true } },
    },
  });

  if (!video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  if (video.videoJob.youtubeUpload?.youtubeVideoId) {
    return NextResponse.json(
      { error: "Видео уже загружено на YouTube — удаление запрещено" },
      { status: 400 }
    );
  }

  try {
    await unlink(video.outputPath);
  } catch {
    /* file may already be missing */
  }

  if (video.previewPath) {
    try {
      await unlink(video.previewPath);
    } catch {
      /* ignore */
    }
  }

  await prisma.generatedVideo.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
