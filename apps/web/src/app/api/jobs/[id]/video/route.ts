import { NextRequest, NextResponse } from "next/server";
import { createReadStream, statSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.videoJob.findUnique({
    where: { id },
    include: { generatedVideo: true },
  });

  if (!job?.generatedVideo?.outputPath) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const filePath = job.generatedVideo.outputPath;
  let stat;
  try {
    stat = statSync(filePath);
  } catch {
    return NextResponse.json({ error: "Video file missing" }, { status: 404 });
  }

  const range = request.headers.get("range");
  const fileSize = stat.size;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize || end >= fileSize) {
      return new NextResponse(null, { status: 416 });
    }
    const chunkSize = end - start + 1;
    const stream = createReadStream(filePath, { start, end });
    return new NextResponse(stream as unknown as BodyInit, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const stream = createReadStream(filePath);
  return new NextResponse(stream as unknown as BodyInit, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${path.basename(filePath)}"`,
    },
  });
}
