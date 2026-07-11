import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteVideoJob } from "@/lib/job-cleanup";
import { toJsonResponse } from "@/lib/utils";

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
    return toJsonResponse({ error: "Job not found" }, { status: 404 });
  }

  return toJsonResponse(job);
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

  return toJsonResponse(job);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await deleteVideoJob(id);
  if ("error" in result) {
    return toJsonResponse({ error: result.error }, { status: result.status });
  }
  return toJsonResponse({ ok: true });
}
