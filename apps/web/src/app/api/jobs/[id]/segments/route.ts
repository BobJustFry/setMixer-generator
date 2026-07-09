import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { segments } = body as {
    segments: Array<{
      id?: string;
      index: number;
      startSec: number;
      endSec: number;
      label?: string;
      thumbPrompt?: string;
    }>;
  };

  if (!segments?.length) {
    return NextResponse.json({ error: "segments required" }, { status: 400 });
  }

  await prisma.segment.deleteMany({ where: { videoJobId: id } });

  await prisma.segment.createMany({
    data: segments.map((s) => ({
      videoJobId: id,
      index: s.index,
      startSec: s.startSec,
      endSec: s.endSec,
      label: s.label || `Track ${s.index + 1}`,
      thumbPrompt: s.thumbPrompt,
      confidence: 1,
      source: "manual",
    })),
  });

  return NextResponse.json({ ok: true });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const job = await prisma.videoJob.findUnique({
    where: { id },
    include: { segments: true },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.segments.length === 0) {
    return NextResponse.json({ error: "No segments defined" }, { status: 400 });
  }

  await prisma.videoJob.update({
    where: { id },
    data: { status: "rendering", progress: 0, errorMessage: null },
  });

  await enqueueJob({ type: "render", videoJobId: id });

  return NextResponse.json({ ok: true, status: "rendering" });
}
