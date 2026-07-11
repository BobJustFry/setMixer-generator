import json
import logging
import subprocess
from pathlib import Path

from worker.ffmpeg_progress import run_ffmpeg_with_progress

log = logging.getLogger("renderer")

WF_HEIGHT = 280
WF_BOTTOM_MARGIN = 48
MARGIN_X = 56
PLAYHEAD_W = 2
# showwavespic draws bars in the center band; playhead must match that band, not full PNG height
VISIBLE_BAR_RATIO = 0.38
PLAYHEAD_COLOR = "0xFFF4E8@0.5"

VALID_VIDEO_EFFECTS = frozenset({
    "none",
    "film_grain",
    "heavy_grain",
    "vignette",
    "vintage_film",
    "8mm",
    "sepia",
    "cinematic",
    "noir",
    "vhs",
    "retro_tv",
    "warm_glow",
    "cool_blue",
    "sunset",
    "dreamy",
    "faded",
    "high_contrast",
    "bleach_bypass",
    "analog",
    "neon",
    "matrix",
    "horror",
    "scanlines",
    "chromatic",
    "glitch",
    "flicker",
})

# FFmpeg filter chains applied after waveform compositing.
EFFECT_FILTERS: dict[str, str] = {
    "film_grain": "noise=alls=7:allf=t+u",
    "heavy_grain": "noise=alls=15:allf=t+u",
    "vignette": "vignette=angle=PI/4:mode=forward",
    "vintage_film": (
        "eq=saturation=0.85:contrast=1.05:brightness=0.03,"
        "colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:"
        "gr=0.349:gg=0.686:gb=0.168:br=0.272:bg=0.534:bb=0.131,"
        "vignette=angle=PI/3:mode=forward,"
        "noise=alls=8:allf=t+u"
    ),
    "8mm": (
        "eq=saturation=0.8:contrast=1.1:brightness=0.04:gamma_r=1.08:gamma_b=0.92,"
        "vignette=angle=PI/3:mode=forward,"
        "noise=alls=12:allf=t+u,"
        "geq=lum='lum(X,Y)*(0.96+0.04*sin(N/5))'"
    ),
    "sepia": (
        "colorchannelmixer=rr=0.393:rg=0.769:rb=0.189:"
        "gr=0.349:gg=0.686:gb=0.168:br=0.272:bg=0.534:bb=0.131"
    ),
    "cinematic": (
        "eq=contrast=1.12:brightness=0.02:saturation=1.1,"
        "curves=r='0/0.05 0.5/0.55 1/0.92':g='0/0 0.5/0.5 1/1':b='0/0.08 0.5/0.48 1/0.88',"
        "vignette=angle=PI/4:mode=forward"
    ),
    "noir": (
        "hue=s=0,"
        "eq=contrast=1.35:brightness=-0.03,"
        "vignette=angle=PI/4:mode=forward"
    ),
    "vhs": (
        "noise=alls=10:allf=t,"
        "eq=saturation=0.75:contrast=1.15,"
        "drawgrid=w=iw:h=3:t=1:c=black@0.12"
    ),
    "retro_tv": (
        "eq=saturation=0.82:contrast=1.08:brightness=0.02,"
        "vignette=angle=PI/4:mode=forward,"
        "drawgrid=w=iw:h=4:t=1:c=black@0.15"
    ),
    "warm_glow": (
        "eq=saturation=1.2:contrast=1.05:gamma=1.05,"
        "unsharp=5:5:0.4:5:5:0"
    ),
    "cool_blue": (
        "eq=saturation=0.95:contrast=1.08,"
        "colorbalance=bs=0.18:bm=0.1:bb=-0.08"
    ),
    "sunset": (
        "eq=saturation=1.15:contrast=1.05:gamma_r=1.12:gamma_g=1.04:gamma_b=0.88,"
        "colorbalance=rs=0.12:rm=0.08:rh=0.05"
    ),
    "dreamy": "gblur=sigma=1.5,eq=saturation=1.25:brightness=0.04",
    "faded": "eq=contrast=0.9:brightness=0.06:saturation=0.75",
    "high_contrast": "eq=contrast=1.35:saturation=1.15:brightness=-0.03",
    "bleach_bypass": "eq=saturation=0.4:contrast=1.25:brightness=0.02",
    "analog": (
        "noise=alls=9:allf=t+u,"
        "vignette=angle=PI/4:mode=forward,"
        "eq=saturation=0.9:contrast=1.08"
    ),
    "neon": (
        "eq=saturation=1.45:contrast=1.2:brightness=0.02,"
        "unsharp=5:5:0.6:5:5:0"
    ),
    "matrix": (
        "eq=saturation=0.7:contrast=1.15,"
        "colorbalance=gs=0.15:gm=0.1:gh=0.05,"
        "colorbalance=bs=-0.1:bm=-0.08:bb=-0.12"
    ),
    "horror": (
        "eq=saturation=0.55:contrast=1.3:brightness=-0.05:gamma_b=1.1,"
        "vignette=angle=PI/3:mode=forward,"
        "noise=alls=10:allf=t+u"
    ),
    "scanlines": "drawgrid=w=iw:h=4:t=2:c=black@0.22",
    "chromatic": (
        "split=2[a][b];"
        "[a]geq=r='r(X-2,Y)':g='g(X-2,Y)':b='b(X-2,Y)'[shifted];"
        "[b][shifted]blend=all_mode=normal:all_opacity=0.65"
    ),
    "glitch": (
        "noise=alls=22:allf=t,"
        "eq=saturation=0.85:contrast=1.2,"
        "colorbalance=rs=0.1:bs=-0.1"
    ),
    "flicker": "geq=lum='lum(X,Y)*(0.94+0.06*sin(N/6))'",
}


def parse_encode_settings(raw) -> dict:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            raw = {}
    if not raw:
        raw = {}
    quality = raw.get("quality", "standard")
    crf_map = {"high": 18, "standard": 20, "fast": 23}
    preset_map = {"high": "medium", "standard": "medium", "fast": "fast"}
    width = int(raw.get("width", 1920))
    height = int(raw.get("height", 1080))
    video_effect = raw.get("videoEffect", "none")
    if video_effect not in VALID_VIDEO_EFFECTS:
        video_effect = "none"

    return {
        "width": width,
        "height": height,
        "fps": int(raw.get("fps", 30)),
        "crf": crf_map.get(quality, 20),
        "preset": preset_map.get(quality, "medium"),
        "audio_bitrate": int(raw.get("audioBitrateKbps", 192)),
        "video_effect": video_effect,
    }


def _layout(height: int) -> dict:
    scale = height / 1080
    wf_height = max(int(WF_HEIGHT * scale), 120)
    wf_bottom = max(int(WF_BOTTOM_MARGIN * scale), 24)
    margin_x = max(int(MARGIN_X * scale), 32)
    wf_y = height - wf_height - wf_bottom
    bar_h = max(int(wf_height * VISIBLE_BAR_RATIO), 20)
    bar_offset = (wf_height - bar_h) // 2
    wf_overlay_y = wf_y + bar_offset
    return {
        "wf_height": wf_height,
        "wf_bottom": wf_bottom,
        "margin_x": margin_x,
        "bar_h": bar_h,
        "bar_offset": bar_offset,
        "wf_overlay_y": wf_overlay_y,
        "wf_y": wf_y,
        "ph_y": wf_overlay_y,
    }


def _bg_scale_filter(fit_mode: str, width: int, height: int) -> str:
    if fit_mode == "stretch":
        return f"scale={width}:{height}"
    if fit_mode == "contain":
        return (
            f"scale={width}:{height}:force_original_aspect_ratio=decrease,"
            f"pad={width}:{height}:(ow-iw)/2:(oh-ih)/2:black"
        )
    return f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height}"


def _effect_filter_chain(effect: str, input_label: str, output_label: str = "outv") -> tuple[str, str]:
    if not effect or effect == "none":
        return "", input_label

    filters = EFFECT_FILTERS.get(effect)
    if not filters:
        return "", input_label

    if ";" in filters and "[" in filters:
        return f"[{input_label}]{filters}[{output_label}]", output_label

    return f"[{input_label}]{filters}[{output_label}]", output_label


def _build_bg_chain(
    bg_fit_mode: str,
    width: int,
    height: int,
    video_effect: str,
) -> tuple[str, str]:
    """Scale background, apply effect to background only (waveform stays clean)."""
    scale = f"[0:v]{_bg_scale_filter(bg_fit_mode, width, height)}[bg_raw];"
    effect_part, bg_label = _effect_filter_chain(video_effect, "bg_raw", "bg")
    if effect_part:
        return scale + effect_part + ";", bg_label
    return f"[0:v]{_bg_scale_filter(bg_fit_mode, width, height)}[bg];", "bg"


def render_waveform_video(
    audio_path: str,
    waveform_path: str,
    output_path: str,
    duration: float,
    template: str = "waveform_dark",
    encode_settings: dict | None = None,
    prebuilt_bg_path: str | None = None,
    bg_fit_mode: str = "cover",
    on_prep_progress=None,
    on_encode_progress=None,
    cancel_check=None,
) -> tuple[float, str]:
    enc = encode_settings or parse_encode_settings(None)
    width = enc["width"]
    height = enc["height"]
    fps = enc["fps"]
    layout = _layout(height)

    tmp_dir = Path(output_path).parent / f".tmp_{Path(output_path).stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    bg_path = prebuilt_bg_path or str(tmp_dir / "bg.png")

    try:
        if not prebuilt_bg_path:
            if on_prep_progress:
                on_prep_progress(0, "Создание фона...")
            _create_background(bg_path, template, width, height)
            if on_prep_progress:
                on_prep_progress(100, "Фон готов")
        elif on_prep_progress:
            on_prep_progress(100, "Фон готов")

        if cancel_check and cancel_check():
            raise RuntimeError("Отменено пользователем")

        inner_w = width - layout["margin_x"] * 2
        dur = max(duration, 0.001)
        playhead_x = f"{layout['margin_x']}+(t/{dur})*({inner_w}-{PLAYHEAD_W})"

        video_effect = enc.get("video_effect", "none")
        bg_chain, bg_label = _build_bg_chain(bg_fit_mode, width, height, video_effect)

        bar_h = layout["bar_h"]
        bar_offset = layout["bar_offset"]
        wf_overlay_y = layout["wf_overlay_y"]
        final_label = "outv"

        filter_complex = (
            bg_chain
            + f"[1:v]scale={inner_w}:{layout['wf_height']},crop=iw:{bar_h}:0:{bar_offset}[wf];"
            + f"[{bg_label}][wf]overlay={layout['margin_x']}:{wf_overlay_y}[comp];"
            + f"[3:v]scale={PLAYHEAD_W}:{bar_h},format=yuva420p[ph];"
            + f"[comp][ph]overlay=x='{playhead_x}':y={layout['ph_y']}:eval=frame:format=auto[{final_label}]"
        )

        cmd = [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            bg_path,
            "-loop",
            "1",
            "-i",
            waveform_path,
            "-i",
            audio_path,
            "-f",
            "lavfi",
            "-i",
            f"color=c={PLAYHEAD_COLOR}:s={PLAYHEAD_W}x{bar_h}:r={fps}",
            "-filter_complex",
            filter_complex,
            "-map",
            f"[{final_label}]",
            "-map",
            "2:a",
            "-c:v",
            "libx264",
            "-preset",
            enc["preset"],
            "-crf",
            str(enc["crf"]),
            "-r",
            str(fps),
            "-c:a",
            "aac",
            "-b:a",
            f"{enc['audio_bitrate']}k",
            "-pix_fmt",
            "yuv420p",
            "-t",
            str(duration),
            "-movflags",
            "+faststart",
            output_path,
        ]

        def on_tick(pct: int, detail: str):
            if on_encode_progress:
                on_encode_progress(pct, f"Кадр: {detail}")

        run_ffmpeg_with_progress(cmd, duration, on_tick, cancel_check=cancel_check)

        out_duration = _probe_duration(output_path)
        return out_duration, ""

    finally:
        if not prebuilt_bg_path:
            for f in tmp_dir.iterdir():
                f.unlink(missing_ok=True)
            if tmp_dir.exists():
                tmp_dir.rmdir()


def _create_background(output_path: str, template: str, width: int, height: int):
    if template == "waveform_gradient":
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            (
                f"gradients=s={width}x{height}"
                ":c0=0x0d0b12:c1=0x2a1810"
                ":nb_colors=2"
                ":t=radial"
            ),
            "-frames:v",
            "1",
            output_path,
        ]
    else:
        cmd = [
            "ffmpeg",
            "-y",
            "-f",
            "lavfi",
            "-i",
            f"color=c=0x0e0e14:s={width}x{height}",
            "-frames:v",
            "1",
            output_path,
        ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Background failed: {result.stderr[-300:]}")


def _probe_duration(filepath: str) -> float:
    cmd = [
        "ffprobe",
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_format",
        filepath,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])
