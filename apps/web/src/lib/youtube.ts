import { google } from "googleapis";
import { prisma } from "./prisma";
import { decrypt, encrypt } from "./crypto";
import { getDecryptedSecrets } from "./settings";
import { normalizeAppUrl, youtubeRedirectUri } from "./youtube-oauth-errors";

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
  const channels = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = channels.data.items?.[0];

  await prisma.youTubeCredential.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      encryptedRefreshToken: encrypt(tokens.refresh_token, secrets.encryptionKey),
      channelTitle: channel?.snippet?.title || null,
      channelId: channel?.id || null,
    },
    update: {
      encryptedRefreshToken: encrypt(tokens.refresh_token, secrets.encryptionKey),
      channelTitle: channel?.snippet?.title || null,
      channelId: channel?.id || null,
    },
  });
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

export async function getYouTubeStatus() {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  const secrets = await getDecryptedSecrets();
  return {
    configured: !!(secrets.youtubeClientId && secrets.youtubeClientSecret),
    connected: !!cred,
    channelTitle: cred?.channelTitle || null,
    channelId: cred?.channelId || null,
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
