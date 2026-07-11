import { prisma } from "@/lib/prisma";
import { toJsonResponse } from "@/lib/utils";

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
  return toJsonResponse(videos);
}
