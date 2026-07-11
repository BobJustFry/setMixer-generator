import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueWithTask } from "@/lib/tasks";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await prisma.videoJob.findUnique({
    where: { id },
    include: { mix: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (!job.mix.waveformPath) {
    return NextResponse.json({ error: "Waveform not ready" }, { status: 400 });
  }

  await prisma.videoJob.update({
    where: { id },
    data: { status: "rendering", progress: 0, errorMessage: null, cancelRequested: false },
  });

  const { taskId } = await enqueueWithTask(
    { type: "render", videoJobId: id },
    {
      type: "render",
      title: `Рендер: ${job.title || job.mix.filename}`,
      videoJobId: id,
    }
  );

  return NextResponse.json({ ok: true, status: "rendering", taskId });
}
