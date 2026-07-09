import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  return NextResponse.json({
    stats: { mixCount, jobCount, videoCount, scheduledCount },
    recentJobs,
  });
}
