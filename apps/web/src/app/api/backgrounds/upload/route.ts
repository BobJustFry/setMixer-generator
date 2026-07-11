import { NextRequest } from "next/server";

import { createUploadedBackground } from "@/lib/backgrounds";
import { toJsonResponse } from "@/lib/utils";
import type { ImageFitMode } from "@/lib/image-utils";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const VALID_FIT_MODES = new Set<ImageFitMode>(["cover", "stretch", "contain"]);

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const resolution = form.get("resolution")?.toString() || "1080p";
  const fitModeRaw = form.get("fitMode")?.toString() || "cover";
  const fitMode = VALID_FIT_MODES.has(fitModeRaw as ImageFitMode)
    ? (fitModeRaw as ImageFitMode)
    : "cover";
  const sourceWidth = Number(form.get("sourceWidth"));
  const sourceHeight = Number(form.get("sourceHeight"));
  const mixId = form.get("mixId")?.toString() || null;

  if (!file || !(file instanceof File)) {
    return toJsonResponse({ error: "file required" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return toJsonResponse({ error: "Допустимы PNG, JPEG, WebP" }, { status: 400 });
  }

  try {
    const updated = await createUploadedBackground({
      file,
      resolution,
      fitMode,
      sourceWidth: Number.isFinite(sourceWidth) ? sourceWidth : null,
      sourceHeight: Number.isFinite(sourceHeight) ? sourceHeight : null,
      mixId,
    });
    return toJsonResponse(updated, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ошибка записи";
    return toJsonResponse(
      { error: `Не удалось сохранить файл: ${msg}. Перезапустите контейнеры (docker compose up).` },
      { status: 500 }
    );
  }
}
