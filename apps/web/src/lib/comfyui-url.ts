/** Docker worker/web cannot reach host ComfyUI via 127.0.0.1 or localhost. */
export function normalizeComfyuiUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "http://host.docker.internal:8000";
  try {
    const u = new URL(trimmed);
    if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
      const port = u.port || "8000";
      return `http://host.docker.internal:${port}`;
    }
    return trimmed.replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}
