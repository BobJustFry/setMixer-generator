import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { scanMixesFolder } from "@/lib/storage";
import { enqueueJob } from "@/lib/queue";

export async function GET() {
  const mixes = await prisma.mix.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { videoJobs: true } } },
  });
  return NextResponse.json(mixes);
}

export async function POST() {
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

  await enqueueJob({ type: "scan_mixes" });

  return NextResponse.json({ scanned: files.length, added });
}
