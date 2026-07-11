import { prisma } from "./prisma";
import { getYouTubeStatus } from "./youtube";
import { decrypt, encrypt, generateEncryptionKey } from "./crypto";
import { normalizeComfyuiUrl } from "./comfyui-url";
import { DEFAULT_COMFYUI_MODEL } from "./comfyui-models";
import type { YouTubeChannel } from "./youtube";

export interface SettingsInput {
  youtubeClientId?: string;
  youtubeClientSecret?: string;
  comfyuiUrl?: string;
  comfyuiCheckpoint?: string;
  appUrl?: string;
}

export interface SettingsView {
  youtubeClientId: string;
  youtubeClientSecret: string;
  comfyuiUrl: string;
  comfyuiCheckpoint: string;
  appUrl: string;
  hasYoutubeClientSecret: boolean;
  youtube: {
    configured: boolean;
    connected: boolean;
    channelTitle: string | null;
    channelId: string | null;
    channels: YouTubeChannel[];
    channelsError: string | null;
    authUrl: string | null;
  };
  comfyui: {
    configured: boolean;
    connected: boolean;
    lastError: string | null;
  };
}

type SettingsRow = {
  id: string;
  encryptionKey: string;
  youtubeClientId: string | null;
  youtubeClientSecret: string | null;
  comfyuiUrl: string | null;
  comfyuiCheckpoint: string | null;
  comfyuiConnected: boolean;
  comfyuiLastError: string | null;
  appUrl: string;
  updatedAt: Date;
};

export async function getOrCreateSettings(): Promise<SettingsRow> {
  let row = await prisma.appSettings.findUnique({ where: { id: "default" } });
  if (!row) {
    row = await prisma.appSettings.create({
      data: {
        id: "default",
        encryptionKey: generateEncryptionKey(),
        appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
        comfyuiUrl: "http://host.docker.internal:8000",
        comfyuiCheckpoint: DEFAULT_COMFYUI_MODEL,
      },
    });
  }
  return row;
}

export async function getDecryptedSecrets(): Promise<{
  encryptionKey: string;
  youtubeClientId: string | null;
  youtubeClientSecret: string | null;
  comfyuiUrl: string;
  comfyuiCheckpoint: string;
  appUrl: string;
}> {
  const row = await getOrCreateSettings();
  const key = row.encryptionKey;
  return {
    encryptionKey: key,
    youtubeClientId: row.youtubeClientId,
    youtubeClientSecret: row.youtubeClientSecret
      ? decrypt(row.youtubeClientSecret, key)
      : null,
    comfyuiUrl: row.comfyuiUrl || "http://host.docker.internal:8000",
    comfyuiCheckpoint: row.comfyuiCheckpoint || DEFAULT_COMFYUI_MODEL,
    appUrl: row.appUrl,
  };
}

export async function getSettingsView(): Promise<SettingsView> {
  const row = await getOrCreateSettings();
  const ytStatus = await getYouTubeStatus();

  return {
    youtubeClientId: row.youtubeClientId || "",
    youtubeClientSecret: "",
    comfyuiUrl: row.comfyuiUrl || "http://host.docker.internal:8000",
    comfyuiCheckpoint: row.comfyuiCheckpoint || DEFAULT_COMFYUI_MODEL,
    appUrl: row.appUrl,
    hasYoutubeClientSecret: !!row.youtubeClientSecret,
    youtube: {
      configured: ytStatus.configured,
      connected: ytStatus.connected,
      channelTitle: ytStatus.channelTitle,
      channelId: ytStatus.channelId,
      channels: ytStatus.channels,
      channelsError: ytStatus.channelsError,
      authUrl: ytStatus.authUrl,
    },
    comfyui: {
      configured: !!row.comfyuiUrl,
      connected: row.comfyuiConnected,
      lastError: row.comfyuiLastError,
    },
  };
}

export async function saveSettings(input: SettingsInput): Promise<SettingsView> {
  const row = await getOrCreateSettings();
  const key = row.encryptionKey;

  const data: Record<string, unknown> = {};

  if (input.youtubeClientId !== undefined) {
    data.youtubeClientId = input.youtubeClientId.trim() || null;
  }
  if (input.youtubeClientSecret !== undefined && input.youtubeClientSecret.trim()) {
    data.youtubeClientSecret = encrypt(input.youtubeClientSecret.trim(), key);
  }
  if (input.comfyuiUrl !== undefined) {
    data.comfyuiUrl = normalizeComfyuiUrl(input.comfyuiUrl);
    data.comfyuiConnected = false;
    data.comfyuiLastError = null;
  }
  if (input.comfyuiCheckpoint !== undefined) {
    data.comfyuiCheckpoint = input.comfyuiCheckpoint.trim() || DEFAULT_COMFYUI_MODEL;
    data.comfyuiConnected = false;
    data.comfyuiLastError = null;
  }
  if (input.appUrl !== undefined) {
    data.appUrl = input.appUrl.trim() || "http://localhost:3000";
  }

  if (Object.keys(data).length > 0) {
    await prisma.appSettings.update({ where: { id: "default" }, data });
  }

  return getSettingsView();
}

export async function setComfyuiStatus(connected: boolean, error: string | null) {
  await prisma.appSettings.update({
    where: { id: "default" },
    data: { comfyuiConnected: connected, comfyuiLastError: error },
  });
}
