import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";

export async function GET() {
  const uploads = await prisma.youTubeUpload.findMany({
    orderBy: { publishAt: "asc" },
    include: {
      videoJob: {
        include: { mix: true, generatedVideo: true },
      },
    },
  });
  return NextResponse.json(uploads);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { videoJobId, title, description, tags, categoryId, privacyStatus, publishAt } =
    body;

  if (!videoJobId || !title) {
    return NextResponse.json(
      { error: "videoJobId and title required" },
      { status: 400 }
    );
  }

  const job = await prisma.videoJob.findUnique({
    where: { id: videoJobId },
    include: { generatedVideo: true },
  });

  if (!job?.generatedVideo) {
    return NextResponse.json({ error: "Video not ready" }, { status: 400 });
  }

  const upload = await prisma.youTubeUpload.upsert({
    where: { videoJobId },
    create: {
      videoJobId,
      title,
      description: description || "",
      tags: tags || [],
      categoryId: categoryId || "10",
      privacyStatus: privacyStatus || "private",
      publishAt: publishAt ? new Date(publishAt) : null,
      uploadStatus: "scheduled",
    },
    update: {
      title,
      description: description || "",
      tags: tags || [],
      categoryId: categoryId || "10",
      privacyStatus: privacyStatus || "private",
      publishAt: publishAt ? new Date(publishAt) : null,
      uploadStatus: "scheduled",
    },
  });

  await enqueueJob({ type: "youtube_upload", videoJobId, uploadId: upload.id });

  return NextResponse.json(upload, { status: 201 });
}
