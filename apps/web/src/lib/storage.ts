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

export function getBackgroundsDir(): string {
  return path.join(getDataDir(), "backgrounds");
}

export function getReferencesDir(): string {
  return path.join(getDataDir(), "references");
}

export async function ensureReferencesDir(): Promise<string> {
  const dir = getReferencesDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o777 });
  try {
    await fs.chmod(dir, 0o777);
  } catch {
    // Windows bind mounts may ignore chmod
  }
  return dir;
}

export async function ensureBackgroundsDir(): Promise<string> {
  const dir = getBackgroundsDir();
  await fs.mkdir(dir, { recursive: true, mode: 0o777 });
  try {
    await fs.chmod(dir, 0o777);
  } catch {
    // Windows bind mounts may ignore chmod
  }
  return dir;
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
    fs.mkdir(getBackgroundsDir(), { recursive: true }),
    fs.mkdir(getReferencesDir(), { recursive: true }),
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
