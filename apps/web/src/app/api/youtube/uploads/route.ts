import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueWithTask, getActiveTaskForJob } from "@/lib/tasks";
import { parsePublishAt, validateYouTubePublishAt } from "@/lib/youtube-schedule";

export async function GET() {
  const uploads = await prisma.youTubeUpload.findMany({
    orderBy: { updatedAt: "desc" },
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
  const { videoJobId, title, description, tags, categoryId, privacyStatus, publishAt, playlistId, playlistTitle } =
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

  const existing = await prisma.youTubeUpload.findUnique({
    where: { videoJobId },
  });
  if (existing?.youtubeVideoId) {
    return NextResponse.json({ error: "Видео уже загружено на YouTube" }, { status: 409 });
  }

  const activeTask = await getActiveTaskForJob(videoJobId);
  if (activeTask?.type === "youtube_upload") {
    return NextResponse.json(
      { error: "Загрузка на YouTube уже выполняется" },
      { status: 409 }
    );
  }

  const parsedPublishAt = parsePublishAt(publishAt);
  const publishAtError = validateYouTubePublishAt(parsedPublishAt);
  if (publishAtError) {
    return NextResponse.json({ error: publishAtError }, { status: 400 });
  }

  // YouTube requires private visibility when publishAt is set.
  const effectivePrivacy = parsedPublishAt ? "private" : privacyStatus || "private";
  const effectivePlaylistId =
    typeof playlistId === "string" && playlistId.trim() ? playlistId.trim() : null;
  const effectivePlaylistTitle =
    typeof playlistTitle === "string" && playlistTitle.trim() ? playlistTitle.trim() : null;

  const upload = await prisma.youTubeUpload.upsert({
    where: { videoJobId },
    create: {
      videoJobId,
      title,
      description: description || "",
      tags: tags || [],
      categoryId: categoryId || "10",
      privacyStatus: effectivePrivacy,
      publishAt: parsedPublishAt,
      playlistId: effectivePlaylistId,
      playlistTitle: effectivePlaylistTitle,
      uploadStatus: "scheduled",
    },
    update: {
      title,
      description: description || "",
      tags: tags || [],
      categoryId: categoryId || "10",
      privacyStatus: effectivePrivacy,
      publishAt: parsedPublishAt,
      playlistId: effectivePlaylistId,
      playlistTitle: effectivePlaylistTitle,
      uploadStatus: "scheduled",
      errorMessage: null,
    },
  });

  const { taskId } = await enqueueWithTask(
    { type: "youtube_upload", videoJobId, uploadId: upload.id },
    { type: "youtube_upload", title: `YouTube: ${title}`, videoJobId, uploadId: upload.id }
  );

  return NextResponse.json({ ...upload, taskId }, { status: 201 });
}
