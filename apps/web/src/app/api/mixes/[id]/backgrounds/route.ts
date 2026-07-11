import { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";

import { enqueueWithTask } from "@/lib/tasks";

import { toJsonResponse } from "@/lib/utils";

import { resolutionToSize } from "@/lib/encode-settings";



export async function GET(

  _request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id } = await params;

  const backgrounds = await prisma.mixBackground.findMany({

    where: { mixId: id },

    orderBy: { createdAt: "desc" },

  });

  return toJsonResponse(backgrounds);

}



export async function POST(

  request: NextRequest,

  { params }: { params: Promise<{ id: string }> }

) {

  const { id: mixId } = await params;

  const body = await request.json();

  const { prompt, negativePrompt, label, resolution, seed: seedRaw } = body;



  const mix = await prisma.mix.findUnique({ where: { id: mixId } });

  if (!mix) {

    return toJsonResponse({ error: "Mix not found" }, { status: 404 });

  }



  const settings = await prisma.appSettings.findUnique({ where: { id: "default" } });

  if (!settings?.comfyuiUrl?.trim()) {

    return toJsonResponse({ error: "ComfyUI не настроен — укажите URL в Настройках" }, { status: 400 });

  }



  const { width, height } =

    resolution === "720p" ? resolutionToSize("720p") : resolutionToSize("1080p");



  let seed: number | null = null;

  if (seedRaw !== undefined && seedRaw !== null && seedRaw !== "") {

    const parsed = Number(seedRaw);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2_147_483_647) {

      return toJsonResponse({ error: "Seed должен быть целым числом от 0 до 2147483647" }, { status: 400 });

    }

    seed = parsed;

  }



  const bg = await prisma.mixBackground.create({

    data: {

      mixId,

      source: "ai",

      prompt: typeof prompt === "string" ? prompt.trim() : null,

      negativePrompt: typeof negativePrompt === "string" ? negativePrompt.trim() || null : null,

      label: typeof label === "string" ? label.trim() || null : null,

      width,

      height,

      seed,

      status: "generating",

    },

  });



  const { taskId } = await enqueueWithTask(

    { type: "generate_background", mixBackgroundId: bg.id },

    {

      type: "generate_background",

      title: `AI-обложка: ${mix.title || mix.filename}`,

      mixBackgroundId: bg.id,

    }

  );



  return toJsonResponse({ ...bg, taskId }, { status: 201 });

}


