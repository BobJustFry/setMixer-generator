import IORedis from "ioredis";

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export const QUEUE_KEY = "setmixer:job_queue";

export type JobType = "scan_mixes" | "analyze" | "render" | "youtube_upload";

export interface QueueJobPayload {
  type: JobType;
  videoJobId?: string;
  mixId?: string;
  uploadId?: string;
}

export async function enqueueJob(payload: QueueJobPayload): Promise<string> {
  const redis = getConnection();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await redis.lpush(QUEUE_KEY, JSON.stringify({ id, ...payload }));
  return id;
}
