import { google } from "googleapis";
import { prisma } from "./prisma";
import { decrypt, encrypt } from "./crypto";
import { getDecryptedSecrets } from "./settings";
import { normalizeAppUrl, youtubeRedirectUri } from "./youtube-oauth-errors";

export interface YouTubeChannel {
  id: string;
  title: string;
  thumbnailUrl: string | null;
}

function isInvalidGrantError(e: unknown): boolean {
  if (e && typeof e === "object") {
    const err = e as { message?: string; response?: { data?: { error?: string } } };
    if (err.message?.includes("invalid_grant")) return true;
    if (err.response?.data?.error === "invalid_grant") return true;
  }
  return false;
}

async function getOAuth2Client() {
  const secrets = await getDecryptedSecrets();
  const clientId = secrets.youtubeClientId;
  const clientSecret = secrets.youtubeClientSecret;
  const redirectUri = youtubeRedirectUri(secrets.appUrl);

  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth не настроен. Заполните Client ID и Secret в настройках.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function mapChannelItem(ch: {
  id?: string | null;
  snippet?: { title?: string | null; thumbnails?: { default?: { url?: string | null } } };
}): YouTubeChannel | null {
  if (!ch.id) return null;
  return {
    id: ch.id,
    title: ch.snippet?.title || ch.id,
    thumbnailUrl: ch.snippet?.thumbnails?.default?.url ?? null,
  };
}

async function listYouTubeChannels(
  youtube: ReturnType<typeof google.youtube>
): Promise<YouTubeChannel[]> {
  const byId = new Map<string, YouTubeChannel>();

  async function mergeQuery(params: { mine?: boolean; managedByMe?: boolean }) {
    const res = await youtube.channels.list({
      part: ["snippet"],
      maxResults: 50,
      ...params,
    });
    for (const ch of res.data.items ?? []) {
      const mapped = mapChannelItem(ch);
      if (mapped) byId.set(mapped.id, mapped);
    }
  }

  // Owned channels (personal + brand accounts owned by this Google login)
  await mergeQuery({ mine: true });
  // Managed brand channels (not always included in mine=true)
  try {
    await mergeQuery({ managedByMe: true });
  } catch {
    /* some tokens cannot use managedByMe — ignore */
  }

  return [...byId.values()].sort((a, b) => a.title.localeCompare(b.title, "ru"));
}

export async function getYouTubeAuthUrl(): Promise<string> {
  const oauth2 = await getOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/youtube.upload",
      "https://www.googleapis.com/auth/youtube.readonly",
    ],
  });
}

export async function saveYouTubeTokens(code: string): Promise<void> {
  const oauth2 = await getOAuth2Client();
  const secrets = await getDecryptedSecrets();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("Refresh token не получен. Отзовите доступ в Google и попробуйте снова.");
  }

  oauth2.setCredentials(tokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const channels = await listYouTubeChannels(youtube);
  if (!channels.length) {
    throw new Error("YouTube-каналы не найдены для этого аккаунта.");
  }

  const existing = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  const active =
    channels.find((ch) => ch.id === existing?.channelId) ?? channels[0];

  await prisma.youTubeCredential.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      encryptedRefreshToken: encrypt(tokens.refresh_token, secrets.encryptionKey),
      channelTitle: active.title,
      channelId: active.id,
    },
    update: {
      encryptedRefreshToken: encrypt(tokens.refresh_token, secrets.encryptionKey),
      channelTitle: active.title,
      channelId: active.id,
    },
  });
}

export async function setActiveYouTubeChannel(channelId: string): Promise<YouTubeChannel> {
  const youtube = await getYouTubeClient();
  const channels = await listYouTubeChannels(youtube);
  const picked = channels.find((ch) => ch.id === channelId);
  if (!picked) {
    throw new Error("Канал не найден среди доступных для этого Google-аккаунта.");
  }

  await prisma.youTubeCredential.update({
    where: { id: "default" },
    data: {
      channelId: picked.id,
      channelTitle: picked.title,
    },
  });

  return picked;
}

export async function getYouTubeClient() {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  if (!cred) throw new Error("YouTube не подключён");

  const secrets = await getDecryptedSecrets();
  const oauth2 = await getOAuth2Client();
  oauth2.setCredentials({
    refresh_token: decrypt(cred.encryptedRefreshToken, secrets.encryptionKey),
  });
  return google.youtube({ version: "v3", auth: oauth2 });
}

export async function getActiveYouTubeChannelId(): Promise<string | null> {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
    select: { channelId: true },
  });
  return cred?.channelId ?? null;
}

export async function getYouTubeStatus() {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  const secrets = await getDecryptedSecrets();

  let channels: YouTubeChannel[] = [];
  let channelsError: string | null = null;
  if (cred) {
    try {
      const youtube = await getYouTubeClient();
      channels = await listYouTubeChannels(youtube);
      const active = channels.find((ch) => ch.id === cred.channelId);
      if (active && active.title !== cred.channelTitle) {
        await prisma.youTubeCredential.update({
          where: { id: "default" },
          data: { channelTitle: active.title },
        });
      }
    } catch (e) {
      if (isInvalidGrantError(e)) {
        await disconnectYouTube();
        channelsError =
          "Доступ Google отозван или истёк. Нажмите «Сохранить и проверить», затем «Авторизоваться в Google».";
      } else {
        channelsError = e instanceof Error ? e.message : "Не удалось загрузить список каналов";
        if (cred.channelId) {
          channels = [
            {
              id: cred.channelId,
              title: cred.channelTitle || cred.channelId,
              thumbnailUrl: null,
            },
          ];
        }
      }
    }
  }

  const credAfter = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  const activeChannel = channels.find((ch) => ch.id === credAfter?.channelId);

  let authUrl: string | null = null;
  if (
    secrets.youtubeClientId &&
    secrets.youtubeClientSecret &&
    !credAfter
  ) {
    try {
      authUrl = await getYouTubeAuthUrl();
    } catch {
      authUrl = null;
    }
  }

  return {
    configured: !!(secrets.youtubeClientId && secrets.youtubeClientSecret),
    connected: !!credAfter,
    channelTitle: activeChannel?.title ?? credAfter?.channelTitle ?? null,
    channelId: credAfter?.channelId ?? null,
    channels,
    channelsError,
    authUrl,
  };
}

export async function verifyYouTubeCredentials(): Promise<{ ok: boolean; error?: string }> {
  try {
    const secrets = await getDecryptedSecrets();
    const clientId = secrets.youtubeClientId?.trim();
    if (!clientId?.includes(".apps.googleusercontent.com")) {
      return {
        ok: false,
        error: "Client ID должен быть вида xxx.apps.googleusercontent.com",
      };
    }
    if (!secrets.youtubeClientSecret?.trim()) {
      return { ok: false, error: "Укажите Client Secret" };
    }
    normalizeAppUrl(secrets.appUrl);
    await getYouTubeAuthUrl();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ошибка проверки" };
  }
}

export async function disconnectYouTube() {
  await prisma.youTubeCredential.deleteMany({ where: { id: "default" } });
}
