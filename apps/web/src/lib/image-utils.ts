export type ImageFitMode = "cover" | "stretch" | "contain";

export function probeImageFile(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

export function imageNeedsFitChoice(
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number
): boolean {
  return sourceW !== targetW || sourceH !== targetH;
}

export function fitModeLabel(mode: ImageFitMode): string {
  const labels: Record<ImageFitMode, string> = {
    cover: "Обрезать по краям",
    stretch: "Растянуть под видео",
    contain: "Вписать с полями",
  };
  return labels[mode];
}
