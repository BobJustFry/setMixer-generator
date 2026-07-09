import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enqueueJob } from "@/lib/queue";

export async function GET() {
  const jobs = await prisma.videoJob.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      mix: true,
      generatedVideo: true,
      youtubeUpload: true,
      _count: { select: { segments: true } },
    },
  });
  return NextResponse.json(jobs);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { mixId, title, stylePrompt, template } = body;

  if (!mixId) {
    return NextResponse.json({ error: "mixId required" }, { status: 400 });
  }

  const mix = await prisma.mix.findUnique({ where: { id: mixId } });
  if (!mix) {
    return NextResponse.json({ error: "Mix not found" }, { status: 404 });
  }

  const job = await prisma.videoJob.create({
    data: {
      mixId,
      title: title || mix.title || mix.filename,
      stylePrompt:
        stylePrompt ||
        "abstract cinematic music visual, vinyl aesthetic, muted warm colors, no text, atmospheric",
      template: template || "kenburns_fade",
      status: "pending",
    },
  });

  await enqueueJob({ type: "analyze", videoJobId: job.id });

  return NextResponse.json(job, { status: 201 });
}
