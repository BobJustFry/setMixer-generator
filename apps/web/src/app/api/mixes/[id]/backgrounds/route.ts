import { NextRequest } from "next/server";

import {
  createAiBackground,
  listBackgrounds,
  parseSeed,
} from "@/lib/backgrounds";
import { prisma } from "@/lib/prisma";
import { toJsonResponse } from "@/lib/utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params;
  const result = await listBackgrounds();
  return toJsonResponse(result.items);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: mixId } = await params;
  const body = await request.json();
  const { prompt, negativePrompt, label, coverText, resolution, seed: seedRaw } = body;

  const mix = await prisma.mix.findUnique({ where: { id: mixId } });
  if (!mix) {
    return toJsonResponse({ error: "Mix not found" }, { status: 404 });
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!settings?.comfyuiUrl?.trim()) {
    return toJsonResponse({ error: "ComfyUI не настроен — укажите URL в Настройках" }, { status: 400 });
  }

  const seed = parseSeed(seedRaw);
  if (seed === "invalid") {
    return toJsonResponse(
      { error: "Seed должен быть целым числом от 0 до 2147483647" },
      { status: 400 }
    );
  }

  const bg = await createAiBackground({
    prompt: typeof prompt === "string" ? prompt : "",
    negativePrompt: typeof negativePrompt === "string" ? negativePrompt : null,
    label: typeof label === "string" ? label : null,
    coverText: typeof coverText === "string" ? coverText : null,
    resolution: typeof resolution === "string" ? resolution : undefined,
    seed,
    mixId,
    taskTitle: `AI-обложка: ${mix.title || mix.filename}`,
  });

  return toJsonResponse(bg, { status: 201 });
}
