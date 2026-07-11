import { NextRequest, NextResponse } from "next/server";

import { getSettingsView, saveSettings } from "@/lib/settings";



export async function GET() {

  const settings = await getSettingsView();

  return NextResponse.json(settings);

}



export async function PUT(request: NextRequest) {

  const body = await request.json();

  const settings = await saveSettings({

    youtubeClientId: body.youtubeClientId,

    youtubeClientSecret: body.youtubeClientSecret,

    comfyuiUrl: body.comfyuiUrl,

    comfyuiCheckpoint: body.comfyuiCheckpoint,

    appUrl: body.appUrl,

  });

  return NextResponse.json(settings);

}


