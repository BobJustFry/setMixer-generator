import { NextRequest } from "next/server";

import { writeFile } from "fs/promises";

import path from "path";

import { prisma } from "@/lib/prisma";

import { ensureBackgroundsDir } from "@/lib/storage";

import { toJsonResponse } from "@/lib/utils";

import { resolutionToSize } from "@/lib/encode-settings";

import type { ImageFitMode } from "@/lib/image-utils";



const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const VALID_FIT_MODES = new Set<ImageFitMode>(["cover", "stretch", "contain"]);



export async function POST(

  request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id: mixId } = await params;



  const mix = await prisma.mix.findUnique({ where: { id: mixId } });

  if (!mix) {

    return toJsonResponse({ error: "Mix not found" }, { status: 404 });

  }



  const form = await request.formData();

  const file = form.get("file");

  const resolution = form.get("resolution")?.toString() || "1080p";

  const fitModeRaw = form.get("fitMode")?.toString() || "cover";

  const fitMode = VALID_FIT_MODES.has(fitModeRaw as ImageFitMode)

    ? (fitModeRaw as ImageFitMode)

    : "cover";

  const sourceWidth = Number(form.get("sourceWidth"));

  const sourceHeight = Number(form.get("sourceHeight"));



  if (!file || !(file instanceof File)) {

    return toJsonResponse({ error: "file required" }, { status: 400 });

  }



  if (!ALLOWED_TYPES.has(file.type)) {

    return toJsonResponse({ error: "Допустимы PNG, JPEG, WebP" }, { status: 400 });

  }



  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg";

  const { width, height } =

    resolution === "720p" ? resolutionToSize("720p") : resolutionToSize("1080p");



  const bg = await prisma.mixBackground.create({

    data: {

      mixId,

      source: "upload",

      label: file.name,

      width,

      height,

      sourceWidth: Number.isFinite(sourceWidth) && sourceWidth > 0 ? sourceWidth : null,

      sourceHeight: Number.isFinite(sourceHeight) && sourceHeight > 0 ? sourceHeight : null,

      fitMode,

      status: "ready",

    },

  });



  const dir = await ensureBackgroundsDir(mixId);

  const imagePath = path.join(dir, `${bg.id}${ext}`);



  try {

    const buf = Buffer.from(await file.arrayBuffer());

    await writeFile(imagePath, buf);

  } catch (e) {

    await prisma.mixBackground.delete({ where: { id: bg.id } }).catch(() => {});

    const msg = e instanceof Error ? e.message : "ошибка записи";

    return toJsonResponse(

      { error: `Не удалось сохранить файл: ${msg}. Перезапустите контейнеры (docker compose up).` },

      { status: 500 }

    );

  }



  const updated = await prisma.mixBackground.update({

    where: { id: bg.id },

    data: { imagePath },

  });



  return toJsonResponse(updated, { status: 201 });

}


