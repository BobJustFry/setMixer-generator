import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  REFERENCE_IMAGE_TYPES,
  createAiBackground,
  listBackgrounds,
  parseBackgroundListParams,
  parseSeed,
} from "@/lib/backgrounds";
import { toJsonResponse } from "@/lib/utils";

async function handleCreate(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";
  let prompt = "";
  let negativePrompt: string | null = null;
  let label: string | null = null;
  let coverText: string | null = null;
  let resolution: string | undefined;
  let mixId: string | null = null;
  let seedRaw: unknown;
  let referenceFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    prompt = form.get("prompt")?.toString() || "";
    negativePrompt = form.get("negativePrompt")?.toString() || null;
    label = form.get("label")?.toString() || null;
    coverText = form.get("coverText")?.toString() || null;
    resolution = form.get("resolution")?.toString();
    mixId = form.get("mixId")?.toString() || null;
    const seedField = form.get("seed");
    seedRaw = seedField === null ? undefined : seedField.toString();
    const ref = form.get("reference");
    if (ref instanceof File && ref.size > 0) {
      referenceFile = ref;
    }
  } else {
    const body = await request.json();
    prompt = typeof body.prompt === "string" ? body.prompt : "";
    negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : null;
    label = typeof body.label === "string" ? body.label : null;
    coverText = typeof body.coverText === "string" ? body.coverText : null;
    resolution = typeof body.resolution === "string" ? body.resolution : undefined;
    mixId = typeof body.mixId === "string" ? body.mixId : null;
    seedRaw = body.seed;
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

  if (referenceFile && !REFERENCE_IMAGE_TYPES.has(referenceFile.type)) {
    return toJsonResponse({ error: "Референс: допустимы PNG, JPEG, WebP" }, { status: 400 });
  }

  let taskTitle = referenceFile ? "AI-обложка (с референсом)" : "AI-обложка";
  if (mixId) {
    const mix = await prisma.mix.findUnique({ where: { id: mixId } });
    if (mix) {
      taskTitle = referenceFile
        ? `AI-обложка + референс: ${mix.title || mix.filename}`
        : `AI-обложка: ${mix.title || mix.filename}`;
    }
  }

  try {
    const bg = await createAiBackground({
      prompt,
      negativePrompt,
      label,
      coverText,
      resolution,
      seed,
      mixId,
      taskTitle,
      referenceFile,
    });
    return toJsonResponse(bg, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ошибка сохранения";
    return toJsonResponse({ error: `Не удалось сохранить референс: ${msg}` }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const params = parseBackgroundListParams(request.nextUrl.searchParams);
  const result = await listBackgrounds(params);
  return toJsonResponse(result);
}

export async function POST(request: NextRequest) {
  return handleCreate(request);
}
