import { NextResponse } from "next/server";
import os from "os";

export async function GET() {
  let publicIp: string | null = null;
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as { ip?: string };
      publicIp = data.ip ?? null;
    }
  } catch {
    /* offline or blocked */
  }

  let lanIp: string | null = null;
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        lanIp = net.address;
        break;
      }
    }
    if (lanIp) break;
  }

  const port = process.env.PORT || "3000";
  const localhostUrl = `http://localhost:${port}`;
  const lanUrl = lanIp ? `http://${lanIp}:${port}` : null;
  const publicUrl = publicIp ? `http://${publicIp}:${port}` : null;

  return NextResponse.json({
    localhostUrl,
    lanIp,
    lanUrl,
    publicIp,
    publicUrl,
    port,
    comfyuiUsesWebhooks: false,
    notes: {
      oauth:
        "OAuth YouTube идёт через ваш браузер. Для localhost Google перенаправляет на этот ПК — внешний доступ не нужен.",
      comfyui:
        "ComfyUI: worker обращается к ComfyUI на вашем ПК (host.docker.internal:8000). ComfyUI Desktop обычно слушает порт 8000.",
      youtubeUpload:
        "Загрузка на YouTube — исходящие запросы с вашего ПК, YouTube не подключается к вам.",
      portForward:
        "Проброс порта 3000 нужен только если открываете UI с другого устройства или используете App URL с LAN/внешним IP в Google Console.",
    },
  });
}
