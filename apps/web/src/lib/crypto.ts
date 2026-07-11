import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function deriveKey(key: string): Buffer {
  return crypto.createHash("sha256").update(key).digest();
}

export function encrypt(text: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, deriveKey(encryptionKey), iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted}`;
}

export function decrypt(encrypted: string, encryptionKey: string): string {
  const [ivHex, tagHex, data] = encrypted.split(":");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    deriveKey(encryptionKey),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  let decrypted = decipher.update(data, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function maskSecret(value: string | null | undefined): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••${value.slice(-4)}`;
}
