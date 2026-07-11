import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const mix = await prisma.mix.findUnique({ where: { id } });
  if (!mix?.waveformPath) {
    return NextResponse.json({ error: "Waveform not found" }, { status: 404 });
  }

  try {
    const fileStat = await stat(mix.waveformPath);
    const buf = await readFile(mix.waveformPath);
    const etag = `"wf-${fileStat.mtimeMs.toString(36)}-${fileStat.size.toString(36)}"`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-cache, must-revalidate",
        ETag: etag,
        "Last-Modified": fileStat.mtime.toUTCString(),
      },
    });
  } catch {
    return NextResponse.json({ error: "Waveform file missing" }, { status: 404 });
  }
}
