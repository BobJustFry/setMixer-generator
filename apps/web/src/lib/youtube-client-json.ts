export interface ParsedClientSecrets {
  clientId: string;
  clientSecret: string;
}

export function parseGoogleClientJson(raw: string): ParsedClientSecrets {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("Невалидный JSON");
  }

  if (!data || typeof data !== "object") {
    throw new Error("Ожидается объект JSON из Google Cloud");
  }

  const obj = data as Record<string, Record<string, unknown>>;
  const block = obj.web || obj.installed;
  if (!block) {
    throw new Error('В JSON нет секции "web" или "installed" — скачайте OAuth client JSON из Google Cloud');
  }

  const clientId = block.client_id;
  const clientSecret = block.client_secret;
  if (typeof clientId !== "string" || !clientId.trim()) {
    throw new Error("В JSON отсутствует client_id");
  }
  if (typeof clientSecret !== "string" || !clientSecret.trim()) {
    throw new Error("В JSON отсутствует client_secret");
  }

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() };
}
