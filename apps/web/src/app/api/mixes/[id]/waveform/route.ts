import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "..", "..", "data");

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
    const buf = await readFile(mix.waveformPath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Waveform file missing" }, { status: 404 });
  }
}
