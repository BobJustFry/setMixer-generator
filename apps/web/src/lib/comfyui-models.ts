export const DEFAULT_COMFYUI_MODEL = "flux1-dev-fp8.safetensors";

export const COMFYUI_MODELS = [
  {
    id: "flux1-dev-fp8.safetensors",
    label: "Flux 1 Dev — макс. качество (~1–3 мин)",
    steps: 28,
    loader: "checkpoint" as const,
  },
  {
    id: "flux-2-klein-base-4b-fp8.safetensors",
    label: "Flux 2 Klein 4B — баланс (~40 с)",
    steps: 20,
    loader: "unet" as const,
  },
  {
    id: "flux-2-klein-4b-fp8.safetensors",
    label: "Flux 2 Klein 4B — быстрый (~15 с)",
    steps: 4,
    loader: "unet" as const,
  },
] as const;

export type ComfyuiModelId = (typeof COMFYUI_MODELS)[number]["id"];

export function normalizeComfyuiModel(value: string | null | undefined): ComfyuiModelId {
  const known = COMFYUI_MODELS.some((m) => m.id === value);
  return known ? (value as ComfyuiModelId) : DEFAULT_COMFYUI_MODEL;
}

export function getComfyuiModelMeta(id: ComfyuiModelId) {
  return COMFYUI_MODELS.find((m) => m.id === id)!;
}
