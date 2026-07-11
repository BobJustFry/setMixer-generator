import subprocess
from pathlib import Path

from analyzer.denon_waveform import save_denon_waveform_png
from worker.ffmpeg_progress import format_time

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
    """Build a Denon-style 3-band waveform PNG (blue bass · green mid · white highs)."""
    out = Path(output_png)
    out.parent.mkdir(parents=True, exist_ok=True)

    if progress_callback:
        progress_callback(0, "Чтение метаданных...")

    duration = get_duration(filepath)

    if progress_callback:
        progress_callback(2, f"Длительность: {format_time(duration)}")

    def on_progress(pct: int, detail: str):
        if progress_callback:
            # Map internal 0–100 to decode/render band (2–99)
            mapped = 2 + int(pct * 0.97)
            progress_callback(mapped, detail)

    save_denon_waveform_png(
        filepath,
        output_png,
        progress_callback=on_progress,
        cancel_check=cancel_check,
    )

    return duration
