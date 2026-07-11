import { setComfyuiStatus } from "./settings";
import { normalizeComfyuiUrl } from "./comfyui-url";
import {
  COMFYUI_MODELS,
  DEFAULT_COMFYUI_MODEL,
  getComfyuiModelMeta,
  normalizeComfyuiModel,
} from "./comfyui-models";

export { normalizeComfyuiUrl } from "./comfyui-url";

async function _modelExistsInComfyui(
  base: string,
  loader: "checkpoint" | "unet",
  modelId: string
): Promise<{ ok: boolean; models: string[] }> {
  const node = loader === "checkpoint" ? "CheckpointLoaderSimple" : "UNETLoader";
  const field = loader === "checkpoint" ? "ckpt_name" : "unet_name";
  try {
    const res = await fetch(`${base}/object_info/${node}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { ok: false, models: [] };
    const data = await res.json();
    const models: string[] = data?.[node]?.input?.required?.[field]?.[0] ?? [];
    return { ok: models.includes(modelId), models };
  } catch {
    return { ok: false, models: [] };
  }
}

export async function verifyComfyui(
  url: string,
  model: string
): Promise<{ ok: boolean; error?: string; warning?: string }> {
  const base = normalizeComfyuiUrl(url);
  if (!base) {
    return { ok: false, error: "Укажите URL ComfyUI" };
  }

  try {
    const res = await fetch(`${base}/system_stats`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const error = `ComfyUI недоступен (HTTP ${res.status}). Запустите ComfyUI на ПК.`;
      await setComfyuiStatus(false, error);
      return { ok: false, error };
    }
  } catch (e) {
    const error = `Не удалось подключиться к ComfyUI: ${
      e instanceof Error ? e.message : "ошибка сети"
    }. Проверьте URL (${base}) и что ComfyUI запущен.`;
    await setComfyuiStatus(false, error);
    return { ok: false, error };
  }

  const modelId = normalizeComfyuiModel(model || DEFAULT_COMFYUI_MODEL);
  const meta = getComfyuiModelMeta(modelId);
  const { ok: found, models } = await _modelExistsInComfyui(base, meta.loader, modelId);

  if (models.length > 0 && !found) {
    const preview = models.slice(0, 6).join(", ");
    const error = `Модель «${modelId}» не найдена в ComfyUI. Доступные: ${preview}${
      models.length > 6 ? "…" : ""
    }`;
    await setComfyuiStatus(false, error);
    return { ok: false, error };
  }

  await setComfyuiStatus(true, null);
  return { ok: true };
}

export async function getComfyuiStatus() {
  const { prisma } = await import("./prisma");
  const row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  return {
    configured: !!row?.comfyuiUrl,
    connected: row?.comfyuiConnected ?? false,
    lastError: row?.comfyuiLastError ?? null,
  };
}
