import path from "path";
import fs from "fs/promises";

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "..", "..", "data");
}

export function getMixesDir(): string {
  return path.join(getDataDir(), "mixes");
}

export function getRendersDir(): string {
  return path.join(getDataDir(), "renders");
}

export function getThumbsDir(): string {
  return path.join(getDataDir(), "thumbs");
}

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"]);

export function isAudioFile(filename: string): boolean {
  return AUDIO_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

export async function ensureDataDirs(): Promise<void> {
  await Promise.all([
    fs.mkdir(getMixesDir(), { recursive: true }),
    fs.mkdir(getRendersDir(), { recursive: true }),
    fs.mkdir(getThumbsDir(), { recursive: true }),
  ]);
}

export async function scanMixesFolder(): Promise<
  Array<{ filename: string; filepath: string; fileSize: bigint }>
> {
  await ensureDataDirs();
  const dir = getMixesDir();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return [];
  }

  const results: Array<{ filename: string; filepath: string; fileSize: bigint }> = [];
  for (const filename of entries) {
    if (!isAudioFile(filename)) continue;
    const filepath = path.join(dir, filename);
    const stat = await fs.stat(filepath);
    if (!stat.isFile()) continue;
    results.push({ filename, filepath, fileSize: BigInt(stat.size) });
  }
  return results;
}
