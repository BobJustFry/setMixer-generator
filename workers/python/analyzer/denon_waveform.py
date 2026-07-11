"""Denon Engine DJ-style 3-band unipolar waveform (blue · green · white)."""

from __future__ import annotations

import logging
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

log = logging.getLogger("analyzer")

WAVEFORM_WIDTH = 3840
WAVEFORM_HEIGHT = 360
# Must match renderer.waveform_video.VISIBLE_BAR_RATIO
VISIBLE_BAR_RATIO = 0.38

SAMPLE_RATE = 22050
LOW_HZ = 250
MID_HZ = 4000

# Denon Prime / Engine DJ palette (bass · mid · treble)
COLOR_BASS = (34, 102, 255, 255)
COLOR_MID = (88, 255, 48, 255)
COLOR_HIGH = (255, 255, 255, 255)


def _load_mono_f32(filepath: str, cancel_check=None) -> np.ndarray:
    cmd = [
        "ffmpeg",
        "-v",
        "error",
        "-i",
        filepath,
        "-ac",
        "1",
        "-ar",
        str(SAMPLE_RATE),
        "-f",
        "f32le",
        "pipe:1",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    chunks: list[bytes] = []
    while True:
        if cancel_check and cancel_check():
            proc.kill()
            raise RuntimeError("Отменено пользователем")
        block = proc.stdout.read(1 << 20)
        if not block:
            break
        chunks.append(block)
    proc.wait()
    if proc.returncode != 0:
        err = (proc.stderr.read() if proc.stderr else b"").decode(errors="replace")
        raise RuntimeError(err.strip() or "ffmpeg decode failed")
    if not chunks:
        raise RuntimeError("Пустой аудиопоток")
    audio = np.frombuffer(b"".join(chunks), dtype=np.float32)
    if audio.size == 0:
        raise RuntimeError("Пустой аудиопоток")
    return np.clip(audio, -1.0, 1.0)


def _band_energies(audio: np.ndarray, n_cols: int) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Per-column low / mid / high band energy from windowed FFT."""
    n = audio.size
    chunk = min(4096, max(512, n // max(n_cols, 1)))
    hop = max(1, n // max(n_cols, 1))

    low = np.zeros(n_cols, dtype=np.float32)
    mid = np.zeros(n_cols, dtype=np.float32)
    high = np.zeros(n_cols, dtype=np.float32)

    window = np.hanning(chunk).astype(np.float32)

    for i in range(n_cols):
        start = min(i * hop, max(0, n - chunk))
        segment = audio[start : start + chunk]
        if segment.size < chunk:
            segment = np.pad(segment, (0, chunk - segment.size))
        spectrum = np.abs(np.fft.rfft(segment * window))
        freqs = np.fft.rfftfreq(chunk, 1.0 / SAMPLE_RATE)

        low[i] = spectrum[freqs < LOW_HZ].sum()
        mid[i] = spectrum[(freqs >= LOW_HZ) & (freqs < MID_HZ)].sum()
        high[i] = spectrum[freqs >= MID_HZ].sum()

    return low, mid, high


def _normalize_band(values: np.ndarray, power: float = 0.72) -> np.ndarray:
    scaled = np.power(np.maximum(values, 0), power)
    peak = float(scaled.max()) or 1.0
    return np.clip(scaled / peak, 0.0, 1.0)


def _allocate_heights(
    bass: np.ndarray,
    mid: np.ndarray,
    treble: np.ndarray,
    visible_h: int,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Stack band heights — bass block at bottom, green mids, white treble tips."""
    max_bass = visible_h * 0.62
    max_mid = visible_h * 0.38
    max_high = max(4, visible_h * 0.22)

    bass_h = np.clip(bass * max_bass, 0, max_bass).astype(np.int32)
    mid_h = np.clip(mid * max_mid, 0, max_mid).astype(np.int32)
    high_h = np.clip(treble * max_high, 0, max_high).astype(np.int32)

    # Treble only on peaks — thin white spikes like Denon
    high_h = np.where(treble > 0.42, high_h, 0)

    total = bass_h + mid_h + high_h
    overflow = total > visible_h
    if overflow.any():
        scale = np.where(overflow, visible_h / np.maximum(total, 1), 1.0)
        bass_h = (bass_h * scale).astype(np.int32)
        mid_h = (mid_h * scale).astype(np.int32)
        high_h = (high_h * scale).astype(np.int32)

    return bass_h, mid_h, high_h


def render_denon_waveform(
    audio: np.ndarray,
    width: int = WAVEFORM_WIDTH,
    height: int = WAVEFORM_HEIGHT,
    cancel_check=None,
) -> Image.Image:
    visible_h = max(int(height * VISIBLE_BAR_RATIO), 20)
    visible_top = (height - visible_h) // 2
    baseline = visible_top + visible_h - 1

    low, mid, high = _band_energies(audio, width)
    if cancel_check and cancel_check():
        raise RuntimeError("Отменено пользователем")

    bass = _normalize_band(low, power=0.68)
    mid_n = _normalize_band(mid, power=0.78)
    treble = _normalize_band(high, power=0.85)

    bass_h, mid_h, high_h = _allocate_heights(bass, mid_n, treble, visible_h)

    rgba = np.zeros((height, width, 4), dtype=np.uint8)

    for x in range(width):
        if cancel_check and x % 256 == 0 and cancel_check():
            raise RuntimeError("Отменено пользователем")

        y = baseline
        bh = int(bass_h[x])
        mh = int(mid_h[x])
        hh = int(high_h[x])

        if bh > 0:
            y1 = y - bh + 1
            rgba[y1 : y + 1, x] = COLOR_BASS
            y = y1 - 1

        if mh > 0 and y >= visible_top:
            y1 = max(visible_top, y - mh + 1)
            rgba[y1 : y + 1, x] = COLOR_MID
            y = y1 - 1

        if hh > 0 and y >= visible_top:
            y1 = max(visible_top, y - hh + 1)
            rgba[y1 : y + 1, x] = COLOR_HIGH

    return Image.fromarray(rgba, mode="RGBA")


def save_denon_waveform_png(
    filepath: str,
    output_png: str,
    progress_callback=None,
    cancel_check=None,
) -> None:
    if progress_callback:
        progress_callback(5, "Декодирование аудио…")

    audio = _load_mono_f32(filepath, cancel_check=cancel_check)

    if progress_callback:
        progress_callback(40, "Построение 3-band waveform…")

    img = render_denon_waveform(audio, cancel_check=cancel_check)

    if progress_callback:
        progress_callback(90, "Сохранение PNG…")

    out = Path(output_png)
    out.parent.mkdir(parents=True, exist_ok=True)
    img.save(out, format="PNG", optimize=True)

    log.info("Denon waveform saved: %s (%dx%d)", output_png, img.width, img.height)

    if progress_callback:
        progress_callback(100, "Waveform сохранён")
