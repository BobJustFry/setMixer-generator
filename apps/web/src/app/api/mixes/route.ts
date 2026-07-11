import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { removeStaleMixes } from "@/lib/mix-cleanup";
import { scanMixesFolder } from "@/lib/storage";
import { enqueueWithTask } from "@/lib/tasks";
import { toJsonResponse } from "@/lib/utils";

export async function GET() {
  const mixes = await prisma.mix.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { videoJobs: true } } },
  });
  return toJsonResponse(mixes);
}

export async function POST() {
  const removed = await removeStaleMixes();
  const files = await scanMixesFolder();
  let added = 0;

  for (const file of files) {
    const existing = await prisma.mix.findUnique({
      where: { filepath: file.filepath },
    });
    if (!existing) {
      await prisma.mix.create({
        data: {
          filename: file.filename,
          filepath: file.filepath,
          fileSize: file.fileSize,
          title: file.filename.replace(/\.[^.]+$/, ""),
          scanStatus: "pending",
        },
      });
      added++;
    }
  }

  const { taskId } = await enqueueWithTask(
    { type: "scan_mixes" },
    { type: "scan_mixes", title: `Сканирование миксов (${files.length} файлов)` }
  );

  return NextResponse.json({ scanned: files.length, added, removed, taskId });
}
