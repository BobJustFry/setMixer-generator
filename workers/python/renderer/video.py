import logging
import subprocess
import json
from pathlib import Path

log = logging.getLogger("renderer")

WIDTH = 1920
HEIGHT = 1080
FPS = 30
FADE_SEC = 1.0


def render_video(
    audio_path: str,
    segments: list[dict],
    thumb_paths: list[str],
    output_path: str,
    template: str = "kenburns_fade",
    progress_callback=None,
) -> tuple[float, str]:
    if template != "kenburns_fade":
        template = "kenburns_fade"

    tmp_dir = Path(output_path).parent / f".tmp_{Path(output_path).stem}"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    clip_paths = []
    total = len(segments)

    for i, (seg, thumb) in enumerate(zip(segments, thumb_paths)):
        duration = seg["endSec"] - seg["startSec"]
        clip_path = str(tmp_dir / f"clip_{i:03d}.mp4")
        _render_segment_clip(thumb, duration, clip_path)
        clip_paths.append(clip_path)
        if progress_callback:
            progress_callback((i + 1) / total * 0.7)

    concat_list = tmp_dir / "concat.txt"
    with open(concat_list, "w") as f:
        for cp in clip_paths:
            f.write(f"file '{cp}'\n")

    video_only = str(tmp_dir / "video_only.mp4")
    _concat_clips(str(concat_list), video_only)

    if progress_callback:
        progress_callback(0.85)

    cmd = [
        "ffmpeg", "-y",
        "-i", video_only,
        "-i", audio_path,
        "-c:v", "libx264", "-preset", "medium", "-crf", "20",
        "-c:a", "aac", "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-shortest",
        "-movflags", "+faststart",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg mux failed: {result.stderr[-500:]}")

    duration = _probe_duration(output_path)

    for f in tmp_dir.iterdir():
        f.unlink()
    tmp_dir.rmdir()

    if progress_callback:
        progress_callback(1.0)

    return duration, result.stderr[-1000:]


def _render_segment_clip(thumb_path: str, duration: float, output_path: str):
    frames = max(int(duration * FPS), 1)
    zoom_end = 1.08

    vf = (
        f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,"
        f"crop={WIDTH}:{HEIGHT},"
        f"zoompan=z='min(zoom+0.0003,{zoom_end})':"
        f"x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
        f"d={frames}:s={WIDTH}x{HEIGHT}:fps={FPS},"
        f"format=yuv420p"
    )

    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", thumb_path,
        "-vf", vf,
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Clip render failed: {result.stderr[-500:]}")


def _concat_clips(concat_file: str, output_path: str):
    cmd = [
        "ffmpeg", "-y",
        "-f", "concat", "-safe", "0",
        "-i", concat_file,
        "-c:v", "libx264", "-preset", "fast", "-crf", "22",
        "-pix_fmt", "yuv420p",
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Concat failed: {result.stderr[-500:]}")


def _probe_duration(filepath: str) -> float:
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", filepath,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    data = json.loads(result.stdout)
    return float(data["format"]["duration"])
