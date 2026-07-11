export type AiPresetId = "vinyl" | "neon" | "minimal" | "custom";

export interface AiPreset {
  id: AiPresetId;
  label: string;
  prompt: string;
}

export const AI_PRESETS: AiPreset[] = [
  {
    id: "vinyl",
    label: "Винил",
    prompt:
      "dark vinyl record aesthetic, warm amber club lighting, abstract bokeh, DJ atmosphere, cinematic, no text, no logos",
  },
  {
    id: "neon",
    label: "Неон клуб",
    prompt:
      "neon club lights purple and cyan, abstract cinematic music visual, fog and lasers, dark background, no text",
  },
  {
    id: "minimal",
    label: "Минимал",
    prompt:
      "minimal dark background, subtle warm geometric light shapes, soft gradient, modern clean, no text",
  },
];

export const DEFAULT_AI_PROMPT = AI_PRESETS[0].prompt;

export const DEFAULT_NEGATIVE_PROMPT =
  "text, watermark, logo, signature, blurry, low quality, jpeg artifacts, " +
  "deformed, ugly, disfigured, poorly drawn, mutation, " +
  "bad anatomy, wrong anatomy, anatomical errors, bad proportions, distorted body, " +
  "asymmetrical, lopsided, unnatural pose, twisted limbs, " +
  "extra limbs, missing limbs, fused limbs, duplicate limbs, extra arms, extra legs, " +
  "malformed hands, extra fingers, missing fingers, deformed hands, " +
  "extra eyes, missing eyes, distorted face, misaligned facial features, " +
  "extra ears, three ears, duplicate ears, missing ears, asymmetrical ears, " +
  "crooked ears, malformed ears, merged ears, wrong ear placement, " +
  "wrong number of body parts, duplicate body parts, conjoined, chimera deformity, " +
  "malformed object, warped geometry, impossible geometry, broken object, " +
  "deformed machinery, incorrect mechanism, broken mechanism, melted metal, " +
  "wrong number of wheels, floating parts, disconnected parts, misaligned parts, " +
  "distorted vehicle, deformed motorcycle, broken phone, malformed headphones, " +
  "extra headphone cups, wrong device shape, incorrect equipment, nonsensical apparatus";

export function resolveAiPrompt(presetId: AiPresetId, customPrompt: string): string {
  const extra = customPrompt.trim();
  if (presetId === "custom") {
    return extra || DEFAULT_AI_PROMPT;
  }
  const preset = AI_PRESETS.find((p) => p.id === presetId);
  const base = preset?.prompt ?? DEFAULT_AI_PROMPT;
  return extra ? `${base}, ${extra}` : base;
}
