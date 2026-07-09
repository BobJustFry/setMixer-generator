import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const job = await prisma.videoJob.findUnique({
    where: { id },
    include: {
      mix: true,
      segments: { orderBy: { index: "asc" } },
      generatedVideo: true,
      youtubeUpload: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json(job);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const job = await prisma.videoJob.update({
    where: { id },
    data: {
      title: body.title,
      stylePrompt: body.stylePrompt,
      template: body.template,
      status: body.status,
    },
  });

  return NextResponse.json(job);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.videoJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
