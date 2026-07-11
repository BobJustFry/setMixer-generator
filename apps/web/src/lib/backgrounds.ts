import path from "path";
import { unlink, writeFile } from "fs/promises";
import type { Prisma } from "@prisma/client";

import { prisma } from "./prisma";
import { ensureBackgroundsDir, ensureReferencesDir } from "./storage";
import { enqueueWithTask } from "./tasks";
import { resolutionToSize } from "./encode-settings";
import type { ImageFitMode } from "./image-utils";

import { BACKGROUNDS_PAGE_SIZE } from "./backgrounds-constants";

export type BackgroundListParams = {
  q?: string;
  source?: "ai" | "upload";
  limit?: number;
  offset?: number;
};

export async function listBackgrounds(params: BackgroundListParams = {}) {
  const limit = Math.min(Math.max(params.limit ?? BACKGROUNDS_PAGE_SIZE, 1), 200);
  const offset = Math.max(params.offset ?? 0, 0);
  const q = params.q?.trim();

  const where: Prisma.MixBackgroundWhereInput = {};
  if (params.source) where.source = params.source;
  if (q) {
    where.OR = [
      { label: { contains: q, mode: "insensitive" } },
      { prompt: { contains: q, mode: "insensitive" } },
      { coverText: { contains: q, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.mixBackground.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.mixBackground.count({ where }),
  ]);

  return { items, total, limit, offset };
}

export const REFERENCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function createAiBackground(input: {
  prompt: string;
  negativePrompt?: string | null;
  label?: string | null;
  coverText?: string | null;
  resolution?: string;
  seed?: number | null;
  mixId?: string | null;
  taskTitle?: string;
  referenceFile?: File | null;
}) {
  const { width, height } =
    input.resolution === "720p" ? resolutionToSize("720p") : resolutionToSize("1080p");

  const bg = await prisma.mixBackground.create({
    data: {
      mixId: input.mixId ?? null,
      source: "ai",
      prompt: input.prompt.trim() || null,
      negativePrompt: input.negativePrompt?.trim() || null,
      label: input.label?.trim() || null,
      coverText: input.coverText?.trim().slice(0, 80) || null,
      width,
      height,
      seed: input.seed ?? null,
      status: "generating",
    },
  });

  if (input.referenceFile) {
    const refExt =
      input.referenceFile.type === "image/png"
        ? ".png"
        : input.referenceFile.type === "image/webp"
          ? ".webp"
          : ".jpg";
    const refDir = await ensureReferencesDir();
    const referenceImagePath = path.join(refDir, `${bg.id}${refExt}`);
    try {
      await writeFile(referenceImagePath, Buffer.from(await input.referenceFile.arrayBuffer()));
      await prisma.mixBackground.update({
        where: { id: bg.id },
        data: { referenceImagePath },
      });
    } catch (e) {
      await prisma.mixBackground.delete({ where: { id: bg.id } }).catch(() => {});
      throw e;
    }
  }

  const { taskId } = await enqueueWithTask(
    { type: "generate_background", mixBackgroundId: bg.id },
    {
      type: "generate_background",
      title: input.taskTitle ?? "AI-обложка",
      mixBackgroundId: bg.id,
    }
  );

  const fresh = await prisma.mixBackground.findUnique({ where: { id: bg.id } });
  return { ...(fresh ?? bg), taskId };
}

export async function createUploadedBackground(input: {
  file: File;
  resolution?: string;
  fitMode: ImageFitMode;
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  mixId?: string | null;
}) {
  const ext =
    input.file.type === "image/png"
      ? ".png"
      : input.file.type === "image/webp"
        ? ".webp"
        : ".jpg";

  const { width, height } =
    input.resolution === "720p" ? resolutionToSize("720p") : resolutionToSize("1080p");

  const bg = await prisma.mixBackground.create({
    data: {
      mixId: input.mixId ?? null,
      source: "upload",
      label: input.file.name,
      width,
      height,
      sourceWidth:
        input.sourceWidth != null && Number.isFinite(input.sourceWidth) && input.sourceWidth > 0
          ? input.sourceWidth
          : null,
      sourceHeight:
        input.sourceHeight != null &&
        Number.isFinite(input.sourceHeight) &&
        input.sourceHeight > 0
          ? input.sourceHeight
          : null,
      fitMode: input.fitMode,
      status: "ready",
    },
  });

  const dir = await ensureBackgroundsDir();
  const imagePath = path.join(dir, `${bg.id}${ext}`);

  const buf = Buffer.from(await input.file.arrayBuffer());
  try {
    await writeFile(imagePath, buf);
  } catch (e) {
    await prisma.mixBackground.delete({ where: { id: bg.id } }).catch(() => {});
    throw e;
  }

  return prisma.mixBackground.update({
    where: { id: bg.id },
    data: { imagePath },
  });
}

export async function getBackgroundImage(bgId: string) {
  return prisma.mixBackground.findUnique({ where: { id: bgId } });
}

export async function deleteBackground(bgId: string) {
  const inUse = await prisma.videoJob.count({ where: { backgroundId: bgId } });
  if (inUse > 0) {
    return { ok: false as const, error: "Обложка используется в задаче видео", status: 409 };
  }

  const bg = await prisma.mixBackground.findUnique({ where: { id: bgId } });
  await prisma.mixBackground.delete({ where: { id: bgId } });
  if (bg?.imagePath) await unlink(bg.imagePath).catch(() => {});
  if (bg?.referenceImagePath) await unlink(bg.referenceImagePath).catch(() => {});
  return { ok: true as const };
}

export function parseBackgroundListParams(searchParams: URLSearchParams): BackgroundListParams {
  const sourceRaw = searchParams.get("source");
  const source = sourceRaw === "ai" || sourceRaw === "upload" ? sourceRaw : undefined;
  const limit = Number(searchParams.get("limit"));
  const offset = Number(searchParams.get("offset"));

  return {
    q: searchParams.get("q") ?? undefined,
    source,
    limit: Number.isFinite(limit) ? limit : undefined,
    offset: Number.isFinite(offset) ? offset : undefined,
  };
}

export function parseSeed(raw: unknown): number | null | "invalid" {
  if (raw === undefined || raw === null || raw === "") return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) return "invalid";
  return parsed;
}
