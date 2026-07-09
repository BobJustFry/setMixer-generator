import { google } from "googleapis";
import { prisma } from "./prisma";
import { decrypt, encrypt } from "./crypto";

function getOAuth2Client() {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri =
    process.env.YOUTUBE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL}/api/youtube/callback`;

  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth not configured");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getYouTubeAuthUrl(): string {
  const oauth2 = getOAuth2Client();
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
  const oauth2 = getOAuth2Client();
  const { tokens } = await oauth2.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error("No refresh token received. Revoke access and try again.");
  }

  oauth2.setCredentials(tokens);
  const youtube = google.youtube({ version: "v3", auth: oauth2 });
  const channels = await youtube.channels.list({ part: ["snippet"], mine: true });
  const channel = channels.data.items?.[0];

  await prisma.youTubeCredential.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      channelTitle: channel?.snippet?.title || null,
      channelId: channel?.id || null,
    },
    update: {
      encryptedRefreshToken: encrypt(tokens.refresh_token),
      channelTitle: channel?.snippet?.title || null,
      channelId: channel?.id || null,
    },
  });
}

export async function getYouTubeClient() {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  if (!cred) throw new Error("YouTube not connected");

  const oauth2 = getOAuth2Client();
  oauth2.setCredentials({
    refresh_token: decrypt(cred.encryptedRefreshToken),
  });
  return google.youtube({ version: "v3", auth: oauth2 });
}

export async function getYouTubeStatus() {
  const cred = await prisma.youTubeCredential.findUnique({
    where: { id: "default" },
  });
  return {
    connected: !!cred,
    channelTitle: cred?.channelTitle || null,
    channelId: cred?.channelId || null,
  };
}
