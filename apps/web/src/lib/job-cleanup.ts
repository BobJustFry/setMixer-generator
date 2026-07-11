import { unlink } from "fs/promises";
import { prisma } from "./prisma";

export const ACTIVE_JOB_STATUSES = ["pending", "analyzing", "rendering"] as const;

export async function deleteGeneratedVideoFiles(video: {
  outputPath: string;
  previewPath: string | null;
}) {
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
}

export async function deleteVideoJob(
  jobId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const job = await prisma.videoJob.findUnique({
    where: { id: jobId },
    include: { generatedVideo: true, youtubeUpload: true },
  });

  if (!job) {
    return { error: "Задача не найдена", status: 404 };
  }

  if (ACTIVE_JOB_STATUSES.includes(job.status as (typeof ACTIVE_JOB_STATUSES)[number])) {
    return { error: "Нельзя удалить задачу в процессе выполнения", status: 400 };
  }

  if (job.youtubeUpload?.youtubeVideoId) {
    return { error: "Видео уже загружено на YouTube — удаление запрещено", status: 400 };
  }

  if (job.generatedVideo) {
    await deleteGeneratedVideoFiles(job.generatedVideo);
  }

  await prisma.backgroundTask.deleteMany({ where: { videoJobId: jobId } });
  await prisma.videoJob.delete({ where: { id: jobId } });

  return { ok: true };
}

export async function clearFinishedVideoJobs(): Promise<number> {
  const jobs = await prisma.videoJob.findMany({
    where: {
      status: { notIn: [...ACTIVE_JOB_STATUSES] },
      NOT: {
        youtubeUpload: {
          youtubeVideoId: { not: null },
        },
      },
    },
    include: { generatedVideo: true },
  });

  for (const job of jobs) {
    if (job.generatedVideo) {
      await deleteGeneratedVideoFiles(job.generatedVideo);
    }
  }

  const jobIds = jobs.map((j) => j.id);
  if (jobIds.length === 0) return 0;

  await prisma.backgroundTask.deleteMany({
    where: { videoJobId: { in: jobIds } },
  });

  const result = await prisma.videoJob.deleteMany({
    where: { id: { in: jobIds } },
  });

  return result.count;
}
