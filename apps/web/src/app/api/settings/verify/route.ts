import { NextRequest, NextResponse } from "next/server";

import { saveSettings, getDecryptedSecrets } from "@/lib/settings";

import { verifyYouTubeCredentials, getYouTubeAuthUrl, getYouTubeStatus } from "@/lib/youtube";

import { verifyComfyui } from "@/lib/comfyui";



export async function POST(request: NextRequest) {

  const body = await request.json();



  await saveSettings({

    youtubeClientId: body.youtubeClientId,

    youtubeClientSecret: body.youtubeClientSecret,

    comfyuiUrl: body.comfyuiUrl,

    comfyuiCheckpoint: body.comfyuiCheckpoint,

    appUrl: body.appUrl,

  });



  const secrets = await getDecryptedSecrets();

  const results: {

    youtube: {

      configured: boolean;

      connected: boolean;

      credentialsValid: boolean;

      authUrl: string | null;

      channelTitle: string | null;

      error: string | null;

    };

    comfyui: {

      configured: boolean;

      connected: boolean;

      error: string | null;

      warning: string | null;

    };

  } = {

    youtube: {

      configured: false,

      connected: false,

      credentialsValid: false,

      authUrl: null,

      channelTitle: null,

      error: null,

    },

    comfyui: {

      configured: false,

      connected: false,

      error: null,

      warning: null,

    },

  };



  if (secrets.comfyuiUrl) {

    const comfy = await verifyComfyui(secrets.comfyuiUrl, secrets.comfyuiCheckpoint);

    results.comfyui.configured = !!secrets.comfyuiUrl;

    results.comfyui.connected = comfy.ok;

    results.comfyui.error = comfy.error || null;

    results.comfyui.warning = comfy.warning || null;

  }



  const ytStatus = await getYouTubeStatus();

  results.youtube.configured = ytStatus.configured;

  results.youtube.connected = ytStatus.connected;

  results.youtube.channelTitle = ytStatus.channelTitle;



  if (secrets.youtubeClientId && secrets.youtubeClientSecret) {

    const ytVerify = await verifyYouTubeCredentials();

    results.youtube.credentialsValid = ytVerify.ok;

    results.youtube.error = ytVerify.error || null;



    if (ytVerify.ok && !ytStatus.connected) {

      try {

        results.youtube.authUrl = await getYouTubeAuthUrl();

      } catch (e) {

        results.youtube.error = e instanceof Error ? e.message : "Не удалось создать OAuth URL";

      }

    }

  } else if (!secrets.youtubeClientId || !secrets.youtubeClientSecret) {

    results.youtube.error = "Укажите Client ID и Client Secret";

  }



  return NextResponse.json(results);

}


