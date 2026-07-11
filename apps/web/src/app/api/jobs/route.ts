import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueWithTask, ensureAnalyzeQueued } from "@/lib/tasks";
import { parseEncodeSettings, type EncodeSettings } from "@/lib/encode-settings";
import { toJsonResponse } from "@/lib/utils";

const ACTIVE_JOB_STATUSES = ["pending", "analyzing", "rendering"] as const;
const VALID_TEMPLATES = ["waveform_dark", "waveform_gradient", "waveform_image"] as const;

export async function GET() {
  const jobs = await prisma.videoJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      mix: true,
      background: true,
      generatedVideo: true,
      youtubeUpload: true,
      _count: { select: { segments: true } },
    },
  });
  return toJsonResponse(jobs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mixId, title, template, backgroundId, encodeSettings: rawEncode } = body;

  const bgTemplate = (VALID_TEMPLATES as readonly string[]).includes(template)
    ? template
    : "waveform_dark";

  if (!mixId) {
    return toJsonResponse({ error: "mixId required" }, { status: 400 });
  }

  if (bgTemplate === "waveform_image") {
    if (!backgroundId) {
      return toJsonResponse({ error: "Выберите обложку" }, { status: 400 });
    }
    const bg = await prisma.mixBackground.findFirst({
      where: { id: backgroundId, mixId, status: "ready", imagePath: { not: null } },
    });
    if (!bg) {
      return toJsonResponse({ error: "Обложка не найдена или ещё генерируется" }, { status: 400 });
    }
  }

  const mix = await prisma.mix.findUnique({ where: { id: mixId } });
  if (!mix) {
    return toJsonResponse({ error: "Mix not found" }, { status: 404 });
  }

  const encodeSettings: EncodeSettings = parseEncodeSettings(rawEncode);

  const existingJob = await prisma.videoJob.findFirst({
    where: {
      mixId,
      status: { in: [...ACTIVE_JOB_STATUSES] },
      cancelRequested: false,
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingJob) {
    const { taskId, requeued } = await ensureAnalyzeQueued(existingJob, mix);
    const job = requeued
      ? await prisma.videoJob.update({
          where: { id: existingJob.id },
          data: {
            status: "analyzing",
            progress: 0,
            errorMessage: null,
            cancelRequested: false,
          },
        })
      : existingJob;
    return toJsonResponse({ ...job, taskId, existing: true, requeued });
  }

  await prisma.videoJob.updateMany({
    where: {
      mixId,
      cancelRequested: true,
      status: { in: [...ACTIVE_JOB_STATUSES] },
    },
    data: {
      status: "failed",
      errorMessage: "Отменено пользователем",
    },
  });

  const job = await prisma.videoJob.create({
    data: {
      mixId,
      title: title || mix.title || mix.filename,
      template: bgTemplate,
      backgroundId: bgTemplate === "waveform_image" ? backgroundId : null,
      encodeSettings: encodeSettings as object,
      status: "analyzing",
      progress: 0,
    },
  });

  const jobTitle = title || mix.title || mix.filename;
  const { taskId } = await enqueueWithTask(
    { type: "analyze", videoJobId: job.id },
    { type: "analyze", title: `Создание видео: ${jobTitle}`, videoJobId: job.id }
  );

  return toJsonResponse({ ...job, taskId }, { status: 201 });
}
