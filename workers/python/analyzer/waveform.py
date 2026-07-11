import subprocess
from pathlib import Path

from worker.ffmpeg_progress import format_time, run_ffmpeg_with_progress

# Denon Prime / SC waveform palette: bass · mid · treble
DENON_WAVEFORM_COLORS = "0xff6622|0x44dd88|0x4499ff"

WAVEFORM_WIDTH = 3840
WAVEFORM_HEIGHT = 360


def get_duration(filepath: str) -> float:
    import json

    proc = subprocess.run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "json",
            filepath,
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "ffprobe failed")
    data = json.loads(proc.stdout)
    return float(data["format"]["duration"])


def generate_waveform(
    filepath: str,
    output_png: str,
    progress_callback=None,
    cancel_check=None,
) -> float:
    """Build a full-mix waveform PNG via ffmpeg with decode progress."""
    out = Path(output_png)
    out.parent.mkdir(parents=True, exist_ok=True)

    if progress_callback:
        progress_callback(0, "Чтение метаданных...")

    duration = get_duration(filepath)

    if progress_callback:
        progress_callback(2, f"Длительность: {format_time(duration)}")

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        filepath,
        "-filter_complex",
        (
            f"showwavespic=s={WAVEFORM_WIDTH}x{WAVEFORM_HEIGHT}"
            f":colors={DENON_WAVEFORM_COLORS}:scale=lin"
        ),
        "-frames:v",
        "1",
        str(out),
    ]

    def on_tick(pct: int, detail: str):
        if progress_callback:
            progress_callback(pct, f"Декодирование: {detail}")

    run_ffmpeg_with_progress(cmd, duration, on_tick, cancel_check=cancel_check)

    if progress_callback:
        progress_callback(100, "Waveform сохранён")

    return duration
