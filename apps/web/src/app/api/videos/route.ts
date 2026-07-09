import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const videos = await prisma.generatedVideo.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      videoJob: {
        include: {
          mix: true,
          youtubeUpload: true,
        },
      },
    },
  });
  return NextResponse.json(videos);
}
