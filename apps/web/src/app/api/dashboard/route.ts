import { prisma } from "@/lib/prisma";
import { toJsonResponse } from "@/lib/utils";

export async function GET() {
  const [mixCount, jobCount, videoCount, scheduledCount] = await Promise.all([
    prisma.mix.count(),
    prisma.videoJob.count(),
    prisma.generatedVideo.count(),
    prisma.youTubeUpload.count({ where: { uploadStatus: "scheduled" } }),
  ]);

  const recentJobs = await prisma.videoJob.findMany({
    take: 5,
    orderBy: { updatedAt: "desc" },
    include: { mix: true },
  });

  return toJsonResponse({
    stats: { mixCount, jobCount, videoCount, scheduledCount },
    recentJobs,
  });
}
