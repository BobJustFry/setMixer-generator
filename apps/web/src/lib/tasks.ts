import { prisma } from "./prisma";
import { getRedisConnection, QUEUE_KEY, type JobType, type QueueJobPayload } from "./queue";

export type TaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface CreateTaskInput {
  type: JobType;
  title: string;
  videoJobId?: string;
  uploadId?: string;
  mixBackgroundId?: string;
}

export async function createBackgroundTask(input: CreateTaskInput) {
  return prisma.backgroundTask.create({
    data: {
      type: input.type,
      title: input.title,
      videoJobId: input.videoJobId,
      uploadId: input.uploadId,
      mixBackgroundId: input.mixBackgroundId,
      status: "pending",
      progress: 0,
    },
  });
}

export async function enqueueWithTask(
  payload: QueueJobPayload,
  meta: CreateTaskInput
): Promise<{ taskId: string; queueId: string }> {
  const task = await createBackgroundTask(meta);
  const redis = getRedisConnection();
  const queueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await redis.lpush(
    QUEUE_KEY,
    JSON.stringify({ id: queueId, taskId: task.id, ...payload })
  );
  return { taskId: task.id, queueId };
}

export async function getActiveTaskForJob(videoJobId: string) {
  return prisma.backgroundTask.findFirst({
    where: {
      videoJobId,
      status: { in: ["pending", "running"] },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function ensureAnalyzeQueued(
  job: { id: string; title: string | null },
  mix: { title: string | null; filename: string }
): Promise<{ taskId: string; requeued: boolean }> {
  const jobTitle = job.title || mix.title || mix.filename;
  const activeTask = await getActiveTaskForJob(job.id);
  if (activeTask) {
    return { taskId: activeTask.id, requeued: false };
  }

  const { taskId } = await enqueueWithTask(
    { type: "analyze", videoJobId: job.id },
    { type: "analyze", title: `Создание видео: ${jobTitle}`, videoJobId: job.id }
  );
  return { taskId, requeued: true };
}

export async function getActiveTasks() {
  const tasks = await prisma.backgroundTask.findMany({
    where: {
      status: { in: ["pending", "running"] },
    },
    orderBy: { createdAt: "asc" },
  });
  return tasks;
}

export async function getRecentTasks(limit = 10) {
  return prisma.backgroundTask.findMany({
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function requestCancelTask(taskId: string) {
  const task = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
  if (!task) return null;
  if (!["pending", "running"].includes(task.status)) return task;

  const cancelledMessage = "Отменено пользователем";

  await prisma.backgroundTask.update({
    where: { id: taskId },
    data: {
      cancelRequested: true,
      status: "cancelled",
      errorMessage: cancelledMessage,
    },
  });

  if (task.videoJobId) {
    await prisma.videoJob.update({
      where: { id: task.videoJobId },
      data: {
        cancelRequested: true,
        status: "failed",
        errorMessage: cancelledMessage,
      },
    });
  }

  return prisma.backgroundTask.findUnique({ where: { id: taskId } });
}

export async function clearFinishedTasks() {
  const result = await prisma.backgroundTask.deleteMany({
    where: {
      status: { in: ["completed", "failed", "cancelled"] },
    },
  });
  return result.count;
}

export async function deleteBackgroundTask(
  taskId: string
): Promise<{ ok: true } | { error: string; status: number }> {
  const task = await prisma.backgroundTask.findUnique({ where: { id: taskId } });
  if (!task) {
    return { error: "Задача не найдена", status: 404 };
  }
  if (ACTIVE_TASK_STATUSES.includes(task.status as (typeof ACTIVE_TASK_STATUSES)[number])) {
    return { error: "Сначала отмените активную задачу", status: 400 };
  }

  await prisma.backgroundTask.delete({ where: { id: taskId } });
  return { ok: true };
}

export const ACTIVE_TASK_STATUSES = ["pending", "running"] as const;
